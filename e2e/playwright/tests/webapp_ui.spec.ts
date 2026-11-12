// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {USERNAMES} from '../support/constants';
import {createPost, createThread, findPostByMessage, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser} from '../support/fixtures';
import {getUserPluginSettings, withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';
import {openChannel, openThreadInThreadsView} from '../support/ui';

let s: Suite;

test.describe('Webapp UI', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify the channel header menu has no Wrangler actions while the web UI is disabled
     */
    test('hides the channel header action when the web UI is disabled', {tag: '@wrangler_ui'}, async ({pw}) => {
        // # Open the channel header menu with default settings
        const channel = await openChannel(pw, s, s.fx.source.name);
        await channel.openChannelMenu();

        // * Verify the menu is open but has no "More actions" submenu
        await expect(channel.menuItem('View Info')).toBeVisible();
        await expect(channel.menuItem('More actions')).toHaveCount(0);
    });

    /**
     * @objective Verify Channel Copy mode can be entered from the channel header and exited from the sidebar banner
     *
     * @precondition
     * Web UI is enabled
     */
    test('enters and exits Channel Copy mode from the channel header menu', {tag: '@wrangler_ui'}, async ({pw}) => {
        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Choose "Copy Messages to Channel" from the channel header
            const channel = await openChannel(pw, s, s.fx.target.name);
            await channel.openChannelMoreActions();
            await channel.menuItem('Copy Messages to Channel').click();

            // * Verify the Channel Copy banner is shown
            await expect(channel.banner.label('Channel Copy')).toBeVisible();

            // # Exit Wrangler mode
            await channel.banner.exit();

            // * Verify the banner is gone
            await expect(channel.banner.label('Channel Copy')).toBeHidden();
        });
    });

    /**
     * @objective Verify the settings endpoint only exposes web UI and merge flags to permitted users
     *
     * @precondition
     * Web UI and merging are enabled
     */
    test('returns per-user web UI and merge flags from the settings endpoint', {tag: '@wrangler_ui'}, async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);

        await withSettings(s.admin, {enablewebui: true, mergethreadenable: true, permittedwranglerusers: 'system-admins'}, async () => {
            // # Request settings as an admin and as a regular user while only admins are permitted
            const adminSettings = await getUserPluginSettings(s.admin);
            const regularSettings = await getUserPluginSettings(regular);

            // * Verify only the admin sees the flags enabled
            expect(adminSettings).toEqual({enable_web_ui: true, enable_merge_thread: true});
            expect(regularSettings).toEqual({enable_web_ui: false, enable_merge_thread: false});
        });

        await withSettings(s.admin, {enablewebui: true, permittedwranglerusers: 'all-users'}, async () => {
            // # Request settings as a regular user while all users are permitted
            const regularSettings = await getUserPluginSettings(regular);

            // * Verify the regular user now sees the web UI enabled
            expect(regularSettings).toEqual({enable_web_ui: true, enable_merge_thread: false});
        });
    });

    /**
     * @objective Verify a thread can be moved to another channel through the post menu modal
     *
     * @precondition
     * Web UI is enabled
     */
    test('moves a thread through the post menu modal', {tag: '@wrangler_ui'}, async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 1, 'ui-move');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Open the move modal from the thread root's Message actions menu
            const channel = await openChannel(pw, s, s.fx.source.name);
            await channel.openPostActions(root.id);

            // The webapp labels threads by the replies loaded into Redux, which collapsed
            // reply threads leave out of the channel view, so either label can show.
            await channel.menuItem(/^Move\/Copy (Message|Thread)$/).click();

            // * Verify the move modal opens
            await expect(channel.modal.heading).toHaveText(/^Wrangler - Move /);

            // # Move the thread to the target channel
            await channel.modal.submitTo(s.fx.teamA.display_name, s.fx.target.id);

            // * Verify the modal closes
            await channel.modal.toBeHidden();
        });

        // * Verify the thread now lives in the target channel
        await expect.poll(() => isPostDeleted(s.admin, root.id)).toBe(true);
        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(moved).toBeDefined();
        expect((await getThreadMessages(s.admin, moved!.id))?.length).toBeGreaterThanOrEqual(2);
    });

    /**
     * @objective Verify a thread opened in the global Threads view can be moved to a channel in another team
     *
     * @precondition
     * Web UI and moving threads to another team are enabled
     */
    test('moves a thread to another team from the Threads view', {tag: '@wrangler_ui'}, async ({pw}) => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 1, 'ui-move-threads-view');

        await withSettings(s.admin, {enablewebui: true, movethreadtoanotherteamenable: true}, async () => {
            // # Open the thread in the Threads view, which has no current channel
            const threads = await openThreadInThreadsView(pw, s, root.id);

            // # Open the move modal from the thread root's Message actions menu
            await threads.openPostActions(root.id);
            await threads.menuItem('Move/Copy Thread').click();

            // * Verify the move modal opens for the thread
            await expect(threads.modal.heading).toHaveText('Wrangler - Move Thread to Another Channel');

            // # Move the thread to the other team's channel
            await threads.modal.submitTo(s.fx.teamB.display_name, s.fx.teamBChannel.id);

            // * Verify the modal closes
            await threads.modal.toBeHidden();
        });

        // * Verify the thread and its reply now live in the other team's channel
        await expect.poll(() => isPostDeleted(s.admin, root.id)).toBe(true);
        const moved = await findPostByMessage(s.admin, s.fx.teamBChannel.id, root.message);
        expect(moved).toBeDefined();
        const messages = await getThreadMessages(s.admin, moved!.id);
        expect(messages?.slice(0, posts.length)).toEqual(posts.map((p) => p.message));
    });

    /**
     * @objective Verify a message can be copied to another channel through the post menu modal
     *
     * @precondition
     * Web UI is enabled
     */
    test('copies a message through the post menu modal', {tag: '@wrangler_ui'}, async ({pw}) => {
        const root = await createPost(s.admin, s.fx.source.id, 'ui-copy');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Open the modal and switch it to Copy
            const channel = await openChannel(pw, s, s.fx.source.name);
            await channel.openPostActions(root.id);
            await channel.menuItem('Move/Copy Message').click();
            await channel.modal.copyOption.check();

            // * Verify the modal is in Copy mode
            await expect(channel.modal.heading).toHaveText('Wrangler - Copy Message to Another Channel');

            // # Copy the message to the target channel
            await channel.modal.submitTo(s.fx.teamA.display_name, s.fx.target.id);

            // * Verify the modal closes
            await channel.modal.toBeHidden();
        });

        // * Verify the copy exists and the original is kept
        await expect.poll(async () => findPostByMessage(s.admin, s.fx.target.id, root.message)).toBeDefined();
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
    });

    /**
     * @objective Verify a standalone message can be attached to a thread through Wrangler mode
     *
     * @precondition
     * Web UI is enabled
     */
    test('attaches a message to a thread through Wrangler mode', {tag: '@wrangler_ui'}, async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'ui-attach-root');
        const loose = await createPost(s.admin, s.fx.source.id, 'ui-attach-loose');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Start attaching the standalone message
            const channel = await openChannel(pw, s, s.fx.source.name);
            await channel.openPostActions(loose.id);
            await channel.menuItem('Attach to Thread').click();

            // * Verify the Attaching Message banner is shown
            await expect(channel.banner.label('Attaching Message')).toBeVisible();

            // # Pick the target thread
            await channel.openPostActions(root.id);
            await channel.menuItem('Attach to this Thread').click();

            // * Verify Wrangler mode ends
            await expect(channel.banner.label('Attaching Message')).toBeHidden();
        });

        // * Verify the message was attached to the thread
        await expect.poll(async () => (await findPostByMessage(s.admin, s.fx.source.id, loose.message))?.root_id).toBe(root.id);
    });

    /**
     * @objective Verify the sidebar close button cancels Wrangler mode without changing the message
     *
     * @precondition
     * Web UI is enabled
     */
    test('exits Wrangler mode with the close button', {tag: '@wrangler_ui'}, async ({pw}) => {
        const loose = await createPost(s.admin, s.fx.source.id, 'ui-exit');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Enter attach mode
            const channel = await openChannel(pw, s, s.fx.source.name);
            await channel.openPostActions(loose.id);
            await channel.menuItem('Attach to Thread').click();

            // * Verify the Attaching Message banner is shown
            await expect(channel.banner.label('Attaching Message')).toBeVisible();

            // # Exit Wrangler mode
            await channel.banner.exit();

            // * Verify the banner is gone
            await expect(channel.banner.label('Attaching Message')).toBeHidden();
        });

        // * Verify the message was not changed
        expect(await isPostDeleted(s.admin, loose.id)).toBe(false);
    });

    /**
     * @objective Verify the post menu offers merging instead of attaching when merging is enabled
     *
     * @precondition
     * Web UI and merging are enabled
     */
    test('replaces the attach menu item with merge when merging is enabled', {tag: '@wrangler_ui'}, async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'ui-merge');

        await withSettings(s.admin, {enablewebui: true, mergethreadenable: true}, async () => {
            // # Open the thread root's Message actions menu
            const channel = await openChannel(pw, s, s.fx.source.name);
            await channel.openPostActions(root.id);

            // * Verify merge is offered instead of attach
            await expect(channel.menuItem('Merge to thread')).toBeVisible();
            await expect(channel.menuItem('Attach to Thread')).toHaveCount(0);

            // # Enter merge mode
            await channel.menuItem('Merge to thread').click();

            // * Verify the Merging Thread banner is shown
            await expect(channel.banner.label('Merging Thread')).toBeVisible();

            // # Exit Wrangler mode
            await channel.banner.exit();
        });
    });

    /**
     * @objective Verify messages from another channel can be copied into a channel chosen from its header menu
     *
     * @precondition
     * Web UI is enabled
     */
    test('copies messages into a channel from the channel header menu', {tag: '@wrangler_ui'}, async ({pw}) => {
        const original = await createPost(s.admin, s.fx.source.id, 'ui-channel-copy');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            // # Enter Channel Copy mode from the target channel's header
            const channel = await openChannel(pw, s, s.fx.target.name);
            await channel.openChannelMoreActions();
            await channel.menuItem('Copy Messages to Channel').click();

            // * Verify the Channel Copy banner is shown
            await expect(channel.banner.label('Channel Copy')).toBeVisible();

            // # Copy a message from the source channel
            await channel.switchToChannel(s.fx.source.name);
            await channel.openPostActions(original.id);
            await channel.menuItem('Copy to Channel').click();
        });

        // * Verify the message was copied into the target channel
        await expect.poll(async () => findPostByMessage(s.admin, s.fx.target.id, original.message)).toBeDefined();
    });
});
