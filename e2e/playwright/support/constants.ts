// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const PLUGIN_ID = 'com.mattermost.wrangler';

export const TEAM_A = 'wrangler-e2e-a';
export const TEAM_B = 'wrangler-e2e-b';

export const CHANNELS = {
    source: 'wrangler-source',
    target: 'wrangler-target',
    teamB: 'wrangler-team-b',
    private: 'wrangler-private',
    restricted: 'wrangler-restricted',
};

export const PASSWORD = 'Wrangl3r-e2e-pass!';
export const DOMAIN = 'wrangler.test';

export const USERNAMES = {
    regular: 'wrangler-regular',
    domain: 'wrangler-domain',
    other: 'wrangler-other',
};

export const DEFAULT_MESSAGES = {
    attach: '@{executor} wrangled one of your messages into a thread for you: {postLink}',
    move: '@{executor} wrangled a thread you started to a new channel for you: {postLink}',
    copy: '@{executor} copied a thread you started to a new channel for you: {postLink}',
};
