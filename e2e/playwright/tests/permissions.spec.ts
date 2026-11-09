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

test.describe('Permissions', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
        regular = (await loginFixtureUser(USERNAMES.regular)).client;
        domainUser = (await loginFixtureUser(USERNAMES.domain)).client;
    });

    /**
     * @objective Verify only system admins can run commands under the system-admins setting
     *
     * @precondition
     * PermittedWranglerUsers is system-admins
     */
    test('restricts commands to system admins by default', {tag: '@wrangler_permissions'}, async () => {
        const settings: WranglerSettings = {permittedwranglerusers: 'system-admins'};

        // # Run info as an admin, a regular user and a matching-domain user
        // * Verify only the admin is allowed
        expect(await runInfo(s.admin, settings)).toContain(ALLOWED);
        expect(await runInfo(regular, settings)).toContain(DENIED);
        expect(await runInfo(domainUser, settings)).toContain(DENIED);
    });

    /**
     * @objective Verify admins and users from the allowed email domain can run commands
     *
     * @precondition
     * PermittedWranglerUsers is system-admins-and-email-domain with the fixture domain allowed
     */
    test('allows commands for admins and matching email domain users only', {tag: '@wrangler_permissions'}, async () => {
        const settings: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: DOMAIN};

        // # Run info as an admin, a matching-domain user and a regular user
        // * Verify the admin and domain user are allowed and the regular user is denied
        expect(await runInfo(s.admin, settings)).toContain(ALLOWED);
        expect(await runInfo(domainUser, settings)).toContain(ALLOWED);
        expect(await runInfo(regular, settings)).toContain(DENIED);
    });

    /**
     * @objective Verify AllowedEmailDomain accepts comma-separated domains and full email addresses
     *
     * @precondition
     * PermittedWranglerUsers is system-admins-and-email-domain
     */
    test('matches allowed email domains against lists and full addresses', {tag: '@wrangler_permissions'}, async () => {
        const list: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `example.org,${DOMAIN}`};
        const exact: WranglerSettings = {permittedwranglerusers: 'system-admins-and-email-domain', allowedemaildomain: `${USERNAMES.regular}@example.com`};

        // # Run info with a domain list
        // * Verify a user from a listed domain is allowed
        expect(await runInfo(domainUser, list)).toContain(ALLOWED);

        // # Run info with a single full address allowed
        // * Verify only that address is allowed
        expect(await runInfo(regular, exact)).toContain(ALLOWED);
        expect(await runInfo(domainUser, exact)).toContain(DENIED);
    });

    /**
     * @objective Verify every user can run commands under the all-users setting
     *
     * @precondition
     * PermittedWranglerUsers is all-users
     */
    test('allows commands for every user when all users are permitted', {tag: '@wrangler_permissions'}, async () => {
        const settings: WranglerSettings = {permittedwranglerusers: 'all-users'};

        // # Run info as two non-admin users
        // * Verify both are allowed
        expect(await runInfo(regular, settings)).toContain(ALLOWED);
        expect(await runInfo(domainUser, settings)).toContain(ALLOWED);
    });

    /**
     * @objective Verify the slash command appears in autocomplete only when CommandAutoCompleteEnable is on
     *
     * @precondition
     * PermittedWranglerUsers is all-users
     */
    test('toggles slash command autocomplete with CommandAutoCompleteEnable', {tag: '@wrangler_permissions'}, async () => {
        const hasWrangler = async () => {
            const commands = await regular.getAutocompleteCommandsList(s.fx.teamA.id);
            return commands.some((c) => c.trigger === 'wrangler');
        };

        // # Read the autocomplete list with the setting on and off
        const enabled = await withSettings(s.admin, {permittedwranglerusers: 'all-users', commandautocompleteenable: true}, hasWrangler);
        const disabled = await withSettings(s.admin, {permittedwranglerusers: 'all-users', commandautocompleteenable: false}, hasWrangler);

        // * Verify the command is listed only when enabled
        expect(enabled).toBe(true);
        expect(disabled).toBe(false);
    });
});
