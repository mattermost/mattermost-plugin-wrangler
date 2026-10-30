// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import {expect, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';
import type {Page} from '@playwright/test';

import {PLUGIN_ID, USERNAMES} from '../support/constants';
import {createPost, createThread, findPostByMessage, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser as loginUser} from '../support/fixtures';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

async function openChannel(pw: PlaywrightExtended, channelName: string, team = s.fx.teamA.name, user: Suite['adminUser'] = s.adminUser) {
    const {channelsPage, page} = await pw.testBrowser.login(user);
    await channelsPage.goto(team, channelName);
    await channelsPage.toBeVisible();
    return {channelsPage, page};
}

// Plugin post menu items live in the "Message actions" menu, not the dot menu.
async function openPostActionsMenu(page: Page, postId: string) {
    const post = page.locator(`#post_${postId}`);
    await expect(post).toBeVisible();
    await post.hover();
    await page.locator(`#CENTER_actions_button_${postId}`).click();
}

function menuItem(page: Page, name: string | RegExp) {
    return page.getByRole('menuitem', {name, exact: true});
}

async function openMoreActions(page: Page) {
    await page.locator('#channelHeaderDropdownButton').click();
    await page.getByRole('menuitem', {name: 'More actions'}).hover();
}

async function pluginSettingsFor(client: Client4) {
    const response = await fetch(`${client.getUrl()}/plugins/${PLUGIN_ID}/api/v1/settings`, {
        headers: {Authorization: `Bearer ${client.getToken()}`, 'X-Requested-With': 'XMLHttpRequest'},
    });
    return response.json() as Promise<{enable_web_ui: boolean; enable_merge_thread: boolean}>;
}

test.describe.serial('Webapp UI', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('hides the channel header action when the web UI is disabled', async ({pw}) => {
        const {page} = await openChannel(pw, s.fx.source.name);

        await page.locator('#channelHeaderDropdownButton').click();
        await expect(page.getByRole('menuitem', {name: 'View Info'})).toBeVisible();
        await expect(page.getByRole('menuitem', {name: 'More actions'})).toHaveCount(0);
    });

    test('channel header action enters and exits Channel Copy mode', async ({pw}) => {
        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.target.name);

            await openMoreActions(page);
            await page.getByRole('menuitem', {name: 'Copy Messages to Channel'}).click();
            await expect(page.getByText('Channel Copy')).toBeVisible();

            await page.getByRole('button', {name: 'Exit Wrangler Mode'}).click();
            await expect(page.getByText('Channel Copy')).toBeHidden();
        });
    });

    test('settings endpoint reflects web UI and merge settings per user', async () => {
        const {client: regular} = await loginUser(USERNAMES.regular);
        await withSettings(s.admin, {enablewebui: true, mergethreadenable: true, permittedwranglerusers: 'system-admins'}, async () => {
            expect(await pluginSettingsFor(s.admin)).toEqual({enable_web_ui: true, enable_merge_thread: true});
            expect(await pluginSettingsFor(regular)).toEqual({enable_web_ui: false, enable_merge_thread: false});
        });

        await withSettings(s.admin, {enablewebui: true, permittedwranglerusers: 'all-users'}, async () => {
            expect(await pluginSettingsFor(regular)).toEqual({enable_web_ui: true, enable_merge_thread: false});
        });
    });

    test('moves a thread through the post menu modal', async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 1, 'ui-move');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.source.name);
            await openPostActionsMenu(page, root.id);
            // The webapp labels threads by the replies loaded into Redux, which collapsed
            // reply threads leave out of the channel view, so either label can show.
            await menuItem(page, /^Move\/Copy (Message|Thread)$/).click();

            await expect(page.getByRole('heading', {name: /^Wrangler - Move (Message|Thread) to Another Channel$/})).toBeVisible();
            await page.locator('#wrangler-team-select').selectOption({label: s.fx.teamA.display_name});
            await page.locator('#wrangler-channel-select').selectOption({value: s.fx.target.id});
            await page.locator('#saveSetting').click();
            await expect(page.locator('#saveSetting')).toBeHidden();
        });

        await expect.poll(() => isPostDeleted(s.admin, root.id)).toBe(true);
        const moved = await findPostByMessage(s.admin, s.fx.target.id, root.message);
        expect(moved).toBeDefined();
        expect((await getThreadMessages(s.admin, moved!.id))?.length).toBeGreaterThanOrEqual(2);
    });

    test('copies a message through the post menu modal', async ({pw}) => {
        const root = await createPost(s.admin, s.fx.source.id, 'ui-copy');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.source.name);
            await openPostActionsMenu(page, root.id);
            await menuItem(page, 'Move/Copy Message').click();

            await page.getByLabel('Copy', {exact: true}).check();
            await expect(page.getByRole('heading', {name: 'Wrangler - Copy Message to Another Channel'})).toBeVisible();
            await page.locator('#wrangler-team-select').selectOption({label: s.fx.teamA.display_name});
            await page.locator('#wrangler-channel-select').selectOption({value: s.fx.target.id});
            await page.locator('#saveSetting').click();
            await expect(page.locator('#saveSetting')).toBeHidden();
        });

        await expect.poll(async () => findPostByMessage(s.admin, s.fx.target.id, root.message)).toBeDefined();
        expect(await isPostDeleted(s.admin, root.id)).toBe(false);
    });

    test('attaches a message to a thread through Wrangler mode', async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'ui-attach-root');
        const loose = await createPost(s.admin, s.fx.source.id, 'ui-attach-loose');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.source.name);

            await openPostActionsMenu(page, loose.id);
            await menuItem(page, 'Attach to Thread').click();
            await expect(page.getByText('Attaching Message')).toBeVisible();

            await openPostActionsMenu(page, root.id);
            await menuItem(page, 'Attach to this Thread').click();
            await expect(page.getByText('Attaching Message')).toBeHidden();
        });

        await expect.poll(async () => (await findPostByMessage(s.admin, s.fx.source.id, loose.message))?.root_id).toBe(root.id);
    });

    test('exits Wrangler mode with the close button', async ({pw}) => {
        const loose = await createPost(s.admin, s.fx.source.id, 'ui-exit');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.source.name);
            await openPostActionsMenu(page, loose.id);
            await menuItem(page, 'Attach to Thread').click();
            await expect(page.getByText('Attaching Message')).toBeVisible();

            await page.getByRole('button', {name: 'Exit Wrangler Mode'}).click();
            await expect(page.getByText('Attaching Message')).toBeHidden();
        });

        expect(await isPostDeleted(s.admin, loose.id)).toBe(false);
    });

    test('merge mode replaces the attach menu item', async ({pw}) => {
        const {root} = await createThread(s.admin, s.fx.source.id, 0, 'ui-merge');

        await withSettings(s.admin, {enablewebui: true, mergethreadenable: true}, async () => {
            const {page} = await openChannel(pw, s.fx.source.name);
            await openPostActionsMenu(page, root.id);
            await expect(menuItem(page, 'Merge to thread')).toBeVisible();
            await expect(menuItem(page, 'Attach to Thread')).toHaveCount(0);

            await menuItem(page, 'Merge to thread').click();
            await expect(page.getByText('Merging Thread')).toBeVisible();
            await page.getByRole('button', {name: 'Exit Wrangler Mode'}).click();
        });
    });

    test('copies messages into a channel from the channel header menu', async ({pw}) => {
        const original = await createPost(s.admin, s.fx.source.id, 'ui-channel-copy');

        await withSettings(s.admin, {enablewebui: true}, async () => {
            const {page} = await openChannel(pw, s.fx.target.name);

            await openMoreActions(page);
            await page.getByRole('menuitem', {name: 'Copy Messages to Channel'}).click();
            await expect(page.getByText('Channel Copy')).toBeVisible();

            // Navigate in-app; a full page load would reset the Wrangler mode state.
            await page.locator(`#sidebarItem_${s.fx.source.name}`).click();
            await openPostActionsMenu(page, original.id);
            await menuItem(page, 'Copy to Channel').click();
        });

        await expect.poll(async () => findPostByMessage(s.admin, s.fx.target.id, original.message)).toBeDefined();
    });
});
