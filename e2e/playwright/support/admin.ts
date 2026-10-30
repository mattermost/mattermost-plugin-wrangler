// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {testConfig} from '@mattermost/playwright-lib';

export async function loginAs(username: string, password: string) {
    const client = new Client4();
    client.setUrl(testConfig.baseURL);
    const profile = await client.login(username, password);
    return {client, user: {...profile, password}};
}

export function loginAdmin() {
    return loginAs(testConfig.adminUsername, testConfig.adminPassword);
}
