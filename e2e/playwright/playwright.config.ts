// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineConfig} from '@playwright/test';
import {testConfig} from '@mattermost/playwright-lib';

// Plugin settings are server-global, so tests run serially in a single worker.
export default defineConfig({
    testDir: './tests',
    globalSetup: require.resolve('./global_setup'),
    outputDir: './results/output',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 90 * 1000,
    expect: {timeout: 15 * 1000},
    reporter: [
        ['list'],
        ['html', {outputFolder: './results/reporter', open: 'never'}],
    ],
    use: {
        baseURL: testConfig.baseURL,
        headless: testConfig.headless,
        launchOptions: {slowMo: testConfig.slowMo},
        viewport: {width: 1280, height: 1024},
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chrome',
            use: {browserName: 'chromium'},
        },
    ],
});
