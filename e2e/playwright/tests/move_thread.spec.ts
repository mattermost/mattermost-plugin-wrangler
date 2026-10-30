// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {DEFAULT_MESSAGES, USERNAMES} from '../support/constants';
import {postLinkId, runCommand} from '../support/commands';
import {createThread, findPostByMessage, getLatestBotDM, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser} from '../support/fixtures';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe.serial('Move thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('moves a thread by post ID and preserves reply order', async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 2, 'move');

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);
        expect(text).toContain('A thread with 3 messages has been moved');
        expect(text).toContain('Original Thread Root Message');

        expect(await isPostDeleted(s.admin, root.id)).toBe(true);
        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(moved).toBeDefined();

        const messages = await getThreadMessages(s.admin, moved!.id);
        expect(messages?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(messages).toContain('This thread was moved from another channel');
    });

    test('moves a thread by permalink', async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-link');
        const link = `http://localhost:8065/${s.fx.teamA.name}/pl/${root.id}`;

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${link} ${s.fx.target.id}`);
        expect(text).toContain('A message has been moved');
        expect(await findPostByMessage(s.admin, s.fx.target.id, root.message)).toBeDefined();
    });

    test('notifies the original author with the configured template', async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-dm');

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);
        const movedId = postLinkId(text);

        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toBe(DEFAULT_MESSAGES.move.replace('{executor}', 'sysadmin').replace('{postLink}', dm!.match(/http\S+/)![0]));
        expect(dm).toContain(movedId);
    });

    test('uses a custom move message template', async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-custom');

        await withSettings(s.admin, {movethreadmessage: 'Custom {executor} says {postLink}'}, async () => {
            await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);
        });

        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^Custom sysadmin says http\S+\/pl\/\w{26}$/);
    });

    test('--silent skips the summary post and DM', async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-silent');
        const dmBefore = await getLatestBotDM(s.admin, s.fx.users.regular.id);

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id} --silent`);
        expect(text).toContain('silently moved');

        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(await getThreadMessages(s.admin, moved!.id)).toEqual([root.message]);
        expect(await getLatestBotDM(s.admin, s.fx.users.regular.id)).toBe(dmBefore);
    });

    test('--show-root-message-in-summary=false omits the root message', async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-nosummary');

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id} --show-root-message-in-summary=false`);
        expect(text).toContain('has been moved');
        expect(text).not.toContain('Original Thread Root Message');
    });

    test('blocks cross-team moves until enabled', async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-xteam');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.teamBChannel.id}`;

        expect(await runCommand(s.admin, s.fx.source.id, cmd)).toContain('not allow moving messages to different teams');
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);

        const text = await withSettings(s.admin, {movethreadtoanotherteamenable: true}, () => runCommand(s.admin, s.fx.source.id, cmd));
        expect(text).toContain('has been moved');
        expect(await findPostByMessage(s.admin, s.fx.teamBChannel.id, root.message)).toBeDefined();
    });

    test('blocks moves from private channels until enabled', async () => {
        const {root} = await createThread(s.admin, s.fx.privateChannel.id, 0, 'move-private');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        expect(await runCommand(s.admin, s.fx.privateChannel.id, cmd)).toContain('not allow moving posts from private channels');

        const text = await withSettings(s.admin, {movethreadfromprivatechannelenable: true}, () => runCommand(s.admin, s.fx.privateChannel.id, cmd));
        expect(text).toContain('has been moved');
    });

    test('blocks moves from direct message channels until enabled', async () => {
        const dm = await s.admin.createDirectChannel([s.fx.users.regular.id, (await s.admin.getMe()).id]);
        const {root} = await createThread(s.admin, dm.id, 0, 'move-dm-channel');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        expect(await runCommand(s.admin, dm.id, cmd)).toContain('not allow moving posts from direct message channels');

        const text = await withSettings(s.admin, {movethreadfromdirectmessagechannelenable: true}, () => runCommand(s.admin, dm.id, cmd));
        expect(text).toContain('has been moved');
    });

    test('blocks moves from group message channels until enabled', async () => {
        const me = await s.admin.getMe();
        const gm = await s.admin.createGroupChannel([me.id, s.fx.users.regular.id, s.fx.users.other.id]);
        const {root} = await createThread(s.admin, gm.id, 0, 'move-gm-channel');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        expect(await runCommand(s.admin, gm.id, cmd)).toContain('not allow moving posts from group message channels');

        const text = await withSettings(s.admin, {movethreadfromgroupmessagechannelenable: true}, () => runCommand(s.admin, gm.id, cmd));
        expect(text).toContain('has been moved');
    });

    test('rejects threads larger than MoveThreadMaxCount', async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 2, 'move-max');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        const text = await withSettings(s.admin, {movethreadmaxcount: '2'}, () => runCommand(s.admin, s.fx.source.id, cmd));
        expect(text).toContain('the thread is 3 posts long');
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
    });

    test('reports usage and validation errors', async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-errors');

        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler move thread')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${'a'.repeat(26)} ${s.fx.target.id}`)).toContain('unable to get post with ID');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${'b'.repeat(26)}`)).toContain("doesn't exist or you are not a member");
        expect(await runCommand(s.admin, s.fx.target.id, `/wrangler move thread ${root.id} ${s.fx.source.id}`)).toContain('must be run from the channel containing the post');
    });
});
