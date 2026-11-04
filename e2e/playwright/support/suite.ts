// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';

import {loginAdmin} from './admin';
import {TEAM_A, TEAM_B} from './constants';
import {ensureFixtures} from './fixtures';
import type {Fixtures} from './fixtures';
import {resetPluginSettings} from './plugin';

export type Suite = {
    admin: Client4;
    adminUser: UserProfile & {password: string};
    fx: Fixtures;
};

// loadSuite logs in the admin, resolves the seeded fixtures, and restores default plugin settings.
export async function loadSuite(): Promise<Suite> {
    const {client: admin, user: adminUser} = await loginAdmin();
    const fx = await ensureFixtures(admin);
    await resetPluginSettings(admin);
    return {admin, adminUser, fx};
}

export {TEAM_A, TEAM_B};
