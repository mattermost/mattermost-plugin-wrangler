// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {USERNAMES} from '../support/constants';
import {runCommand} from '../support/commands';
import {createPost, createThread, findPostByMessage, getLatestBotDM, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser} from '../support/fixtures';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe('Attach message', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify a standalone message is attached to a thread and its author is notified
     */
    test('attaches a standalone message to a thread and notifies its author', {tag: '@wrangler_attach'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(s.admin, s.fx.source.id, 1, 'attach-root');
        const loose = await createPost(regular, s.fx.source.id, 'attach-loose');

        // # Attach the regular user's message to the thread
        await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${root.id}`);

        // * Verify the original is replaced by a reply in the thread
        expect(await isPostDeleted(s.admin, loose.id)).toBe(true);
        const attached = await findPostByMessage(s.admin, s.fx.source.id, loose.message);
        expect(attached?.root_id).toBe(root.id);
        expect(await getThreadMessages(s.admin, root.id)).toContain(loose.message);

        // * Verify the author receives the default attach DM
        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^@sysadmin wrangled one of your messages into a thread for you: http\S+\/pl\/\w{26}$/);
    });

    /**
     * @objective Verify attaching to a reply attaches the message to that reply's thread root
     */
    test('attaches a message to the thread root when given a reply ID', {tag: '@wrangler_attach'}, async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 1, 'attach-reply');
        const loose = await createPost(s.admin, s.fx.source.id, 'attach-loose2');

        // # Attach using the reply's ID as the target
        await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${posts[1].id}`);

        // * Verify the message joined the root's thread
        const attached = await findPostByMessage(s.admin, s.fx.source.id, loose.message);
        expect(attached?.root_id).toBe(root.id);
    });

    /**
     * @objective Verify invalid attach requests are rejected and leave the message untouched
     */
    test('rejects invalid attach requests', {tag: '@wrangler_attach'}, async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 1, 'attach-invalid');
        const other = await createThread(s.admin, s.fx.target.id, 0, 'attach-other');
        const loose = await createPost(s.admin, s.fx.source.id, 'attach-loose3');

        // # Run attach with missing, identical, unknown, cross-channel and threaded arguments
        // * Verify each request returns the matching error
        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler attach message')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${loose.id}`)).toContain('should not be the same');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${'a'.repeat(26)} ${root.id}`)).toContain('unable to get message with ID');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${other.root.id}`)).toContain('another channel');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${posts[1].id} ${root.id}`)).toContain('already part of a thread');

        // * Verify the standalone message was not changed
        expect(await isPostDeleted(s.admin, loose.id)).toBe(false);
    });
});
