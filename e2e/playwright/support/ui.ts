// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPost, expect} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightExtended} from '@mattermost/playwright-lib';
import type {Locator, Page} from '@playwright/test';

import type {Suite} from './suite';

export type WranglerMode = 'Attaching Message' | 'Merging Thread' | 'Channel Copy';

// Move/copy modal opened from the post "Message actions" menu.
export class MoveThreadModal {
    readonly container: Locator;
    readonly heading: Locator;
    readonly copyOption: Locator;
    readonly teamSelect: Locator;
    readonly channelSelect: Locator;
    readonly submitButton: Locator;

    constructor(page: Page) {
        this.container = page.getByRole('dialog');
        this.heading = this.container.getByRole('heading', {name: /^Wrangler - (Move|Copy) (Message|Thread) to Another Channel$/});
        this.copyOption = this.container.getByLabel('Copy', {exact: true});
        this.teamSelect = this.container.getByLabel('Team', {exact: true});
        this.channelSelect = this.container.getByLabel('Channel', {exact: true});

        // The button text changes to "Yeehaw!" while hovered.
        this.submitButton = this.container.getByRole('button', {name: /^((Move|Copy) (Message|Thread)|Yeehaw!)$/});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async toBeHidden() {
        await expect(this.container).toBeHidden();
    }

    async submitTo(teamDisplayName: string, channelId: string) {
        await this.teamSelect.selectOption({label: teamDisplayName});
        await this.channelSelect.selectOption({value: channelId});
        await this.submitButton.click();
    }
}

// Left sidebar banner shown while a Wrangler mode is active.
export class WranglerModeBanner {
    readonly exitButton: Locator;

    constructor(private readonly page: Page) {
        this.exitButton = page.getByRole('button', {name: 'Exit Wrangler Mode'});
    }

    label(mode: WranglerMode) {
        return this.page.getByText(mode, {exact: true});
    }

    async exit() {
        await this.exitButton.click();
    }
}

// Wrangler post menu and modal, shared by every view that renders posts.
class WranglerView {
    readonly modal: MoveThreadModal;

    constructor(readonly page: Page) {
        this.modal = new MoveThreadModal(page);
    }

    menuItem(name: string | RegExp) {
        return this.page.getByRole('menuitem', {name, exact: true});
    }

    // Plugin post menu items live in the "Message actions" menu, not the dot menu.
    protected async openActionsFor(post: ChannelsPost) {
        await post.toBeVisible();
        await post.hover();
        await post.postMenu.actionsButton.click();
    }
}

// Wrangler entry points layered on the library's ChannelsPage.
export class WranglerChannel extends WranglerView {
    readonly banner: WranglerModeBanner;

    constructor(readonly channelsPage: ChannelsPage) {
        super(channelsPage.page);
        this.banner = new WranglerModeBanner(this.page);
    }

    async openPostActions(postId: string) {
        await this.openActionsFor(await this.channelsPage.centerView.getPostById(postId));
    }

    async openChannelMenu() {
        await this.channelsPage.centerView.header.openChannelMenu();
    }

    // Plugin channel header actions live in the "More actions" submenu.
    async openChannelMoreActions() {
        await this.openChannelMenu();
        await this.menuItem('More actions').hover();
    }

    // Navigates in-app; a full page load would reset the Wrangler mode state.
    async switchToChannel(channelName: string) {
        await this.channelsPage.sidebarLeft.goToItem(channelName);
    }
}

export async function openChannel(pw: PlaywrightExtended, s: Suite, channelName: string) {
    const {channelsPage} = await pw.testBrowser.login(s.adminUser);
    await channelsPage.goto(s.fx.teamA.name, channelName);
    await channelsPage.toBeVisible();
    return new WranglerChannel(channelsPage);
}

// Global Threads view, which has no current channel while a thread is shown.
export class WranglerThreadsView extends WranglerView {
    async openPostActions(postId: string) {
        await this.openActionsFor(new ChannelsPost(this.page.locator(`[id="rhsPost_${postId}"]`)));
    }
}

export async function openThreadInThreadsView(pw: PlaywrightExtended, s: Suite, rootId: string) {
    const {page, threadsPage} = await pw.testBrowser.login(s.adminUser);
    await page.goto(`/${s.fx.teamA.name}/threads/${rootId}`);
    await threadsPage.toBeVisible();
    await threadsPage.toHaveThreadSelected();
    return new WranglerThreadsView(page);
}
