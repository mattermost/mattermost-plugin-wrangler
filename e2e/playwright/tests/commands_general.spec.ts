// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {CHANNELS, TEAM_A} from '../support/constants';
import {runCommand} from '../support/commands';
import {createPost} from '../support/posts';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe('General commands', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify help is shown for the bare command, the help subcommand and unknown subcommands
     */
    test('shows help for /wrangler and unknown subcommands', {tag: '@wrangler_commands'}, async () => {
        for (const cmd of ['/wrangler', '/wrangler help', '/wrangler bogus']) {
            // # Run the command
            // eslint-disable-next-line no-await-in-loop
            const text = await runCommand(s.admin, s.fx.source.id, cmd);

            // * Verify the help lists every default subcommand and hides merge
            expect(text).toContain('Wrangler Plugin - Slash Command Help');
            expect(text).toContain('/wrangler move thread');
            expect(text).toContain('/wrangler copy thread');
            expect(text).toContain('/wrangler attach message');
            expect(text).not.toContain('/wrangler merge thread');
        }
    });

    /**
     * @objective Verify help documents the merge subcommand once merging is enabled
     *
     * @precondition
     * Merging is enabled
     */
    test('shows merge usage in help only when merging is enabled', {tag: '@wrangler_commands'}, async () => {
        // # Run help with merging enabled
        const text = await withSettings(s.admin, {mergethreadenable: true}, () => runCommand(s.admin, s.fx.source.id, '/wrangler help'));

        // * Verify merge usage is listed
        expect(text).toContain('/wrangler merge thread');
    });

    /**
     * @objective Verify the info subcommand reports the plugin version
     */
    test('shows plugin version with /wrangler info', {tag: '@wrangler_commands'}, async () => {
        // # Run info
        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler info');

        // * Verify the version is reported
        expect(text).toContain('Wrangler plugin version:');
    });

    /**
     * @objective Verify list channels returns all channels and honors team and channel filters
     */
    test('lists channels with team and channel filters', {tag: '@wrangler_commands'}, async () => {
        // # List all channels
        const all = await runCommand(s.admin, s.fx.source.id, '/wrangler list channels');

        // * Verify channels from both teams are listed
        expect(all).toContain(`${s.fx.source.id} - ${CHANNELS.source}`);
        expect(all).toContain(`${s.fx.teamBChannel.id} - ${CHANNELS.teamB}`);

        // # Filter by team
        const byTeam = await runCommand(s.admin, s.fx.source.id, `/wrangler list channels --team-filter ${TEAM_A}`);

        // * Verify only that team's channels are listed
        expect(byTeam).toContain(CHANNELS.source);
        expect(byTeam).not.toContain(CHANNELS.teamB);

        // # Filter by channel name
        const byChannel = await runCommand(s.admin, s.fx.source.id, `/wrangler list channels --channel-filter ${CHANNELS.target}`);

        // * Verify only the matching channel is listed
        expect(byChannel).toContain(s.fx.target.id);
        expect(byChannel).not.toContain(s.fx.source.id);

        // # Filter by a channel name that does not exist
        const none = await runCommand(s.admin, s.fx.source.id, '/wrangler list channels --channel-filter no-such-channel-xyz');

        // * Verify no results are reported
        expect(none).toContain('No results found');
    });

    /**
     * @objective Verify list messages honors the count and trim length flags
     */
    test('lists recent messages honoring count and trim length', {tag: '@wrangler_commands'}, async () => {
        const post = await createPost(s.admin, s.fx.source.id, 'a-rather-long-message-for-trimming-purposes-in-list-output');

        // # List the last five messages
        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 5');

        // * Verify the new post is listed
        expect(text).toContain('The last 5 messages in this channel');
        expect(text).toContain(post.id);

        // # List again with a short trim length
        const trimmed = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 5 --trim-length 10');

        // * Verify the post is listed with its message trimmed
        expect(trimmed).toContain(post.id);
        expect(trimmed).not.toContain(post.message);
    });

    /**
     * @objective Verify list messages rejects a count outside the allowed range
     */
    test('rejects out-of-range list messages flags', {tag: '@wrangler_commands'}, async () => {
        // # List messages with an excessive count
        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 100000');

        // * Verify a range error is returned
        expect(text).toContain('Error');
        expect(text).toContain('must be between');
    });
});
