// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {USERNAMES} from '../support/constants';
import {runCommand} from '../support/commands';
import {createThread, findPostByMessage, getLatestBotDM, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser} from '../support/fixtures';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe('Copy thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify copying a thread duplicates it in the target channel and keeps the original
     */
    test('copies a thread and leaves the original intact', {tag: '@wrangler_copy'}, async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 2, 'copy');

        // # Copy the thread to the target channel
        await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${root.id} ${s.fx.target.id}`);

        // * Verify the original thread is intact and links to the copy
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
        const original = await getThreadMessages(s.admin, root.id);
        expect(original?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(original?.some((m) => m.startsWith('A copy of this thread has been made:'))).toBe(true);

        // * Verify the copy has the same messages in order
        const copy = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(copy).toBeDefined();
        const copied = await getThreadMessages(s.admin, copy!.id);
        expect(copied?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(copied).toContain('This thread was copied from another channel');
    });

    /**
     * @objective Verify the thread author receives the default copy DM
     */
    test('notifies the original author with the configured template', {tag: '@wrangler_copy'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'copy-dm');

        // # Copy the regular user's thread
        await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${root.id} ${s.fx.target.id}`);

        // * Verify the author receives the copy DM with a permalink
        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^@sysadmin copied a thread you started to a new channel for you: http\S+\/pl\/\w{26}$/);
    });

    /**
     * @objective Verify copy applies the private-channel and cross-team gates used by move
     */
    test('blocks copies from private channels and across teams until enabled', {tag: '@wrangler_copy'}, async () => {
        const privateThread = await createThread(s.admin, s.fx.privateChannel.id, 0, 'copy-private');
        const crossTeam = await createThread(s.admin, s.fx.source.id, 0, 'copy-xteam');
        const cmd = `/wrangler copy thread ${crossTeam.root.id} ${s.fx.teamBChannel.id}`;

        // # Copy from a private channel and to another team with default settings
        // * Verify both copies are blocked
        expect(await runCommand(s.admin, s.fx.privateChannel.id, `/wrangler copy thread ${privateThread.root.id} ${s.fx.target.id}`)).toContain('not allow moving posts from private channels');
        expect(await runCommand(s.admin, s.fx.source.id, cmd)).toContain('not allow moving messages to different teams');

        // # Copy to another team with cross-team moves enabled
        await withSettings(s.admin, {movethreadtoanotherteamenable: true}, () => runCommand(s.admin, s.fx.source.id, cmd));

        // * Verify the copy reached the other team
        expect(await findPostByMessage(s.admin, s.fx.teamBChannel.id, crossTeam.root.message)).toBeDefined();
    });

    /**
     * @objective Verify copy reports missing arguments and unknown posts
     */
    test('reports usage and validation errors for invalid copy arguments', {tag: '@wrangler_copy'}, async () => {
        // # Run copy without arguments and with an unknown post ID
        // * Verify each request returns the matching error
        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler copy thread')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${'a'.repeat(26)} ${s.fx.target.id}`)).toContain('unable to get post with ID');
    });
});
