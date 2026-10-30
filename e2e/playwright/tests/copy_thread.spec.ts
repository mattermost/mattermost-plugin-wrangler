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

test.describe.serial('Copy thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('copies a thread and leaves the original intact', async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 2, 'copy');

        await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${root.id} ${s.fx.target.id}`);

        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
        const original = await getThreadMessages(s.admin, root.id);
        expect(original?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(original?.some((m) => m.startsWith('A copy of this thread has been made:'))).toBe(true);

        const copy = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(copy).toBeDefined();
        const copied = await getThreadMessages(s.admin, copy!.id);
        expect(copied?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(copied).toContain('This thread was copied from another channel');
    });

    test('notifies the original author with the configured template', async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'copy-dm');

        await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${root.id} ${s.fx.target.id}`);

        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^@sysadmin copied a thread you started to a new channel for you: http\S+\/pl\/\w{26}$/);
    });

    test('enforces the same channel-type and team gates as move', async () => {
        const privateThread = await createThread(s.admin, s.fx.privateChannel.id, 0, 'copy-private');
        expect(await runCommand(s.admin, s.fx.privateChannel.id, `/wrangler copy thread ${privateThread.root.id} ${s.fx.target.id}`)).toContain('not allow moving posts from private channels');

        const crossTeam = await createThread(s.admin, s.fx.source.id, 0, 'copy-xteam');
        const cmd = `/wrangler copy thread ${crossTeam.root.id} ${s.fx.teamBChannel.id}`;
        expect(await runCommand(s.admin, s.fx.source.id, cmd)).toContain('not allow moving messages to different teams');

        await withSettings(s.admin, {movethreadtoanotherteamenable: true}, () => runCommand(s.admin, s.fx.source.id, cmd));
        expect(await findPostByMessage(s.admin, s.fx.teamBChannel.id, crossTeam.root.message)).toBeDefined();
    });

    test('reports usage and validation errors', async () => {
        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler copy thread')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler copy thread ${'a'.repeat(26)} ${s.fx.target.id}`)).toContain('unable to get post with ID');
    });
});
