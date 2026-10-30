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

test.describe('Move thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify moving a thread by post ID recreates it in the target channel in the same order
     */
    test('moves a thread by post ID and preserves reply order', {tag: '@wrangler_move'}, async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 2, 'move');

        // # Move the thread by its root post ID
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);

        // * Verify the move summary is returned
        expect(text).toContain('A thread with 3 messages has been moved');
        expect(text).toContain('Original Thread Root Message');

        // * Verify the original is gone and the target holds the replies in order
        expect(await isPostDeleted(s.admin, root.id)).toBe(true);
        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(moved).toBeDefined();
        const messages = await getThreadMessages(s.admin, moved!.id);
        expect(messages?.slice(0, 3)).toEqual(posts.map((p) => p.message));
        expect(messages).toContain('This thread was moved from another channel');
    });

    /**
     * @objective Verify a thread can be moved by passing its permalink instead of its ID
     */
    test('moves a thread by permalink', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-link');
        const link = `http://localhost:8065/${s.fx.teamA.name}/pl/${root.id}`;

        // # Move the thread by permalink
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${link} ${s.fx.target.id}`);

        // * Verify the message reached the target channel
        expect(text).toContain('A message has been moved');
        expect(await findPostByMessage(s.admin, s.fx.target.id, root.message)).toBeDefined();
    });

    /**
     * @objective Verify the thread author receives the default move DM linking to the new thread
     */
    test('notifies the original author with the configured template', {tag: '@wrangler_move'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-dm');

        // # Move the regular user's thread
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);
        const movedId = postLinkId(text);

        // * Verify the DM uses the default template and links to the moved post
        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toBe(DEFAULT_MESSAGES.move.replace('{executor}', 'sysadmin').replace('{postLink}', dm!.match(/http\S+/)![0]));
        expect(dm).toContain(movedId);
    });

    /**
     * @objective Verify the move DM uses a custom MoveThreadMessage template
     *
     * @precondition
     * MoveThreadMessage is set to a custom template
     */
    test('uses a custom move message template', {tag: '@wrangler_move'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-custom');

        // # Move the thread with a custom template configured
        await withSettings(s.admin, {movethreadmessage: 'Custom {executor} says {postLink}'}, async () => {
            await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`);
        });

        // * Verify the DM is rendered from the custom template
        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^Custom sysadmin says http\S+\/pl\/\w{26}$/);
    });

    /**
     * @objective Verify --silent moves the thread without a summary post or author DM
     */
    test('moves a thread silently without a summary post or DM', {tag: '@wrangler_move'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(regular, s.fx.source.id, 0, 'move-silent');
        const dmBefore = await getLatestBotDM(s.admin, s.fx.users.regular.id);

        // # Move the thread with --silent
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id} --silent`);

        // * Verify the move is reported as silent
        expect(text).toContain('silently moved');

        // * Verify no summary was added and no DM was sent
        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(await getThreadMessages(s.admin, moved!.id)).toEqual([root.message]);
        expect(await getLatestBotDM(s.admin, s.fx.users.regular.id)).toBe(dmBefore);
    });

    /**
     * @objective Verify --show-root-message-in-summary=false leaves the root message out of the summary
     */
    test('omits the root message from the move summary when requested', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-nosummary');

        // # Move the thread with --show-root-message-in-summary=false
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id} --show-root-message-in-summary=false`);

        // * Verify the summary omits the root message
        expect(text).toContain('has been moved');
        expect(text).not.toContain('Original Thread Root Message');
    });

    /**
     * @objective Verify moves to another team are blocked until MoveThreadToAnotherTeamEnable is on
     */
    test('blocks cross-team moves until enabled', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-xteam');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.teamBChannel.id}`;

        // # Move to another team with default settings
        // * Verify the move is blocked and the thread is kept
        expect(await runCommand(s.admin, s.fx.source.id, cmd)).toContain('not allow moving messages to different teams');
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);

        // # Move again with cross-team moves enabled
        const text = await withSettings(s.admin, {movethreadtoanotherteamenable: true}, () => runCommand(s.admin, s.fx.source.id, cmd));

        // * Verify the thread reached the other team
        expect(text).toContain('has been moved');
        expect(await findPostByMessage(s.admin, s.fx.teamBChannel.id, root.message)).toBeDefined();
    });

    /**
     * @objective Verify moves from private channels are blocked until MoveThreadFromPrivateChannelEnable is on
     */
    test('blocks moves from private channels until enabled', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.privateChannel.id, 0, 'move-private');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        // # Move from a private channel with default settings
        // * Verify the move is blocked
        expect(await runCommand(s.admin, s.fx.privateChannel.id, cmd)).toContain('not allow moving posts from private channels');

        // # Move again with private-channel moves enabled
        const text = await withSettings(s.admin, {movethreadfromprivatechannelenable: true}, () => runCommand(s.admin, s.fx.privateChannel.id, cmd));

        // * Verify the thread was moved
        expect(text).toContain('has been moved');
    });

    /**
     * @objective Verify moves from direct message channels are blocked until MoveThreadFromDirectMessageChannelEnable is on
     */
    test('blocks moves from direct message channels until enabled', {tag: '@wrangler_move'}, async () => {
        const dm = await s.admin.createDirectChannel([s.fx.users.regular.id, (await s.admin.getMe()).id]);
        const {root} = await createThread(s.admin, dm.id, 0, 'move-dm-channel');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        // # Move from a DM with default settings
        // * Verify the move is blocked
        expect(await runCommand(s.admin, dm.id, cmd)).toContain('not allow moving posts from direct message channels');

        // # Move again with DM moves enabled
        const text = await withSettings(s.admin, {movethreadfromdirectmessagechannelenable: true}, () => runCommand(s.admin, dm.id, cmd));

        // * Verify the thread was moved
        expect(text).toContain('has been moved');
    });

    /**
     * @objective Verify moves from group message channels are blocked until MoveThreadFromGroupMessageChannelEnable is on
     */
    test('blocks moves from group message channels until enabled', {tag: '@wrangler_move'}, async () => {
        const me = await s.admin.getMe();
        const gm = await s.admin.createGroupChannel([me.id, s.fx.users.regular.id, s.fx.users.other.id]);
        const {root} = await createThread(s.admin, gm.id, 0, 'move-gm-channel');
        const cmd = `/wrangler move thread ${root.id} ${s.fx.target.id}`;

        // # Move from a GM with default settings
        // * Verify the move is blocked
        expect(await runCommand(s.admin, gm.id, cmd)).toContain('not allow moving posts from group message channels');

        // # Move again with GM moves enabled
        const text = await withSettings(s.admin, {movethreadfromgroupmessagechannelenable: true}, () => runCommand(s.admin, gm.id, cmd));

        // * Verify the thread was moved
        expect(text).toContain('has been moved');
    });

    /**
     * @objective Verify threads longer than MoveThreadMaxCount are not moved
     *
     * @precondition
     * MoveThreadMaxCount is set to 2
     */
    test('rejects threads larger than MoveThreadMaxCount', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 2, 'move-max');

        // # Move a three-post thread with a limit of two
        const text = await withSettings(s.admin, {movethreadmaxcount: '2'}, () => runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${s.fx.target.id}`));

        // * Verify the move is rejected and the thread is kept
        expect(text).toContain('the thread is 3 posts long');
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
    });

    /**
     * @objective Verify move reports missing arguments, unknown posts and channels, and the wrong source channel
     */
    test('reports usage and validation errors for invalid move arguments', {tag: '@wrangler_move'}, async () => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'move-errors');

        // # Run move with missing, unknown and mismatched arguments
        // * Verify each request returns the matching error
        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler move thread')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${'a'.repeat(26)} ${s.fx.target.id}`)).toContain('unable to get post with ID');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler move thread ${root.id} ${'b'.repeat(26)}`)).toContain("doesn't exist or you are not a member");
        expect(await runCommand(s.admin, s.fx.target.id, `/wrangler move thread ${root.id} ${s.fx.source.id}`)).toContain('must be run from the channel containing the post');
    });
});
