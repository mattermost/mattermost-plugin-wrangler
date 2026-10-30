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

const ALLOWED = 'Wrangler plugin version:';
const DENIED = 'Permission denied';

let s: Suite;
let regular: Client4;
let domainUser: Client4;

function runInfo(client: Client4, settings: WranglerSettings) {
    return withSettings(s.admin, settings, () => runCommand(client, s.fx.source.id, '/wrangler info'));
}

test.describe.serial('Permissions', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
        regular = (await loginFixtureUser(USERNAMES.regular)).client;
        domainUser = (await loginFixtureUser(USERNAMES.domain)).client;
    });

    test('system-admins: only admins may run commands', async () => {
        expect(await runInfo(s.admin, {permittedwranglerusers: 'system-admins'})).toContain(ALLOWED);
        expect(await runInfo(regular, {permittedwranglerusers: 'system-admins'})).toContain(DENIED);
        expect(await runInfo(domainUser, {permittedwranglerusers: 'system-admins'})).toContain(DENIED);
    });

    test('system-admins-and-email-domain: allows matching domain only', async () => {
        const settings: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: DOMAIN};
        expect(await runInfo(s.admin, settings)).toContain(ALLOWED);
        expect(await runInfo(domainUser, settings)).toContain(ALLOWED);
        expect(await runInfo(regular, settings)).toContain(DENIED);
    });

    test('allowed email domain supports lists and full addresses', async () => {
        const list: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `example.org,${DOMAIN}`};
        expect(await runInfo(domainUser, list)).toContain(ALLOWED);

        const exact: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `${USERNAMES.regular}@example.com`};
        expect(await runInfo(regular, exact)).toContain(ALLOWED);
        expect(await runInfo(domainUser, exact)).toContain(DENIED);
    });

    test('all-users: everyone may run commands', async () => {
        expect(await runInfo(regular, {permittedwranglerusers: 'all-users'})).toContain(ALLOWED);
        expect(await runInfo(domainUser, {permittedwranglerusers: 'all-users'})).toContain(ALLOWED);
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
