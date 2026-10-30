// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import {expect} from '@mattermost/playwright-lib';
import type {ChannelsPage} from '@mattermost/playwright-lib';
import type {Page} from '@playwright/test';

// runCommand executes a slash command through the API and returns the plugin's response text.
export async function runCommand(client: Client4, channelId: string, command: string, rootId?: string): Promise<string> {
    const response = await client.executeCommand(command, {channel_id: channelId, root_id: rootId} as Parameters<Client4['executeCommand']>[1]);
    return (response as {text?: string}).text ?? '';
}

export async function runSlashCommand(channelsPage: ChannelsPage, command: string) {
    const postCreate = channelsPage.centerView.postCreate;
    await postCreate.input.fill(command);

    // Pressing Enter would pick a slash-command autocomplete suggestion.
    await postCreate.sendMessageButton.click();
    await expect(postCreate.input).toHaveValue('');
}

export async function expectPost(page: Page, text: string | RegExp) {
    await expect(page.locator('.post-message__text').filter({hasText: text}).last()).toBeVisible();
}

export function postLinkId(text: string): string {
    const match = text.match(/\/pl\/([a-z0-9]{26})/);
    if (!match) {
        throw new Error(`No post link in: ${text}`);
    }
    return match[1];
}
