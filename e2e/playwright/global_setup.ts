// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {baseGlobalSetup, testConfig} from '@mattermost/playwright-lib';

import {loginAdmin} from './support/admin';
import {ensureFixtures} from './support/fixtures';
import {findPluginBundle, installPlugin, resetPluginSettings, restartPlugin} from './support/plugin';

export default async function globalSetup() {
    // Creates the sysadmin on a fresh server and dismisses onboarding tours.
    await baseGlobalSetup();

    const {client: admin} = await loginAdmin();
    await ensureFixtures(admin);

    const bundle = findPluginBundle();
    // eslint-disable-next-line no-console
    console.log(`Installing ${bundle} on ${testConfig.baseURL}`);
    await installPlugin(admin, bundle);

    await restartPlugin(admin);
    await resetPluginSettings(admin);
}
