// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import {expect, test} from '@mattermost/playwright-lib';

import {DOMAIN, USERNAMES} from '../support/constants';
import {runCommand} from '../support/commands';
import {loginFixtureUser} from '../support/fixtures';
import {withSettings} from '../support/plugin';
import type {WranglerSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

const DENIED = 'Permission denied';

let s: Suite;
let regular: Client4;
let domainUser: Client4;

async function canRun(client: Client4, settings: WranglerSettings) {
    return withSettings(s.admin, settings, async () => {
        const text = await runCommand(client, s.fx.source.id, '/wrangler info');
        return text.includes('Wrangler plugin version:') && !text.includes(DENIED);
    });
}

test.describe.serial('Permissions', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
        regular = (await loginFixtureUser(USERNAMES.regular)).client;
        domainUser = (await loginFixtureUser(USERNAMES.domain)).client;
    });

    test('system-admins: only admins may run commands', async () => {
        expect(await canRun(s.admin, {permittedwranglerusers: 'system-admins'})).toBe(true);
        expect(await canRun(regular, {permittedwranglerusers: 'system-admins'})).toBe(false);
        expect(await canRun(domainUser, {permittedwranglerusers: 'system-admins'})).toBe(false);
    });

    test('system-admins-and-email-domain: allows matching domain only', async () => {
        const settings: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: DOMAIN};
        expect(await canRun(s.admin, settings)).toBe(true);
        expect(await canRun(domainUser, settings)).toBe(true);
        expect(await canRun(regular, settings)).toBe(false);
    });

    test('allowed email domain supports lists and full addresses', async () => {
        const list: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `example.org,${DOMAIN}`};
        expect(await canRun(domainUser, list)).toBe(true);

        const exact: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `${USERNAMES.regular}@example.com`};
        expect(await canRun(regular, exact)).toBe(true);
        expect(await canRun(domainUser, exact)).toBe(false);
    });

    test('all-users: everyone may run commands', async () => {
        expect(await canRun(regular, {permittedwranglerusers: 'all-users'})).toBe(true);
        expect(await canRun(domainUser, {permittedwranglerusers: 'all-users'})).toBe(true);
    });

    test('command autocomplete follows CommandAutoCompleteEnable', async () => {
        const hasWrangler = async () => {
            const commands = await regular.getAutocompleteCommandsList(s.fx.teamA.id);
            return commands.some((c) => c.trigger === 'wrangler');
        };

        const enabled = await withSettings(s.admin, {permittedwranglerusers: 'all-users', commandautocompleteenable: true}, hasWrangler);
        const disabled = await withSettings(s.admin, {permittedwranglerusers: 'all-users', commandautocompleteenable: false}, hasWrangler);

        expect(enabled).toBe(true);
        expect(disabled).toBe(false);
    });
});
