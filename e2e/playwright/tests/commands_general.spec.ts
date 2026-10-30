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

test.describe.serial('General commands', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('shows help for /wrangler and unknown subcommands', async () => {
        for (const cmd of ['/wrangler', '/wrangler help', '/wrangler bogus']) {
            // eslint-disable-next-line no-await-in-loop
            const text = await runCommand(s.admin, s.fx.source.id, cmd);
            expect(text).toContain('Wrangler Plugin - Slash Command Help');
            expect(text).toContain('/wrangler move thread');
            expect(text).toContain('/wrangler copy thread');
            expect(text).toContain('/wrangler attach message');
            expect(text).not.toContain('/wrangler merge thread');
        }
    });

    test('help includes merge usage only when merging is enabled', async () => {
        const text = await withSettings(s.admin, {mergethreadenable: true}, () => runCommand(s.admin, s.fx.source.id, '/wrangler help'));
        expect(text).toContain('/wrangler merge thread');
    });

    test('shows plugin info', async () => {
        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler info');
        expect(text).toContain('Wrangler plugin version:');
    });

    test('lists channels with team and channel filters', async () => {
        const all = await runCommand(s.admin, s.fx.source.id, '/wrangler list channels');
        expect(all).toContain(`${s.fx.source.id} - ${CHANNELS.source}`);
        expect(all).toContain(`${s.fx.teamBChannel.id} - ${CHANNELS.teamB}`);

        const byTeam = await runCommand(s.admin, s.fx.source.id, `/wrangler list channels --team-filter ${TEAM_A}`);
        expect(byTeam).toContain(CHANNELS.source);
        expect(byTeam).not.toContain(CHANNELS.teamB);

        const byChannel = await runCommand(s.admin, s.fx.source.id, `/wrangler list channels --channel-filter ${CHANNELS.target}`);
        expect(byChannel).toContain(s.fx.target.id);
        expect(byChannel).not.toContain(s.fx.source.id);

        const none = await runCommand(s.admin, s.fx.source.id, '/wrangler list channels --channel-filter no-such-channel-xyz');
        expect(none).toContain('No results found');
    });

    test('lists recent messages honoring count and trim length', async () => {
        const post = await createPost(s.admin, s.fx.source.id, 'a-rather-long-message-for-trimming-purposes-in-list-output');

        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 5');
        expect(text).toContain('The last 5 messages in this channel');
        expect(text).toContain(post.id);

        const trimmed = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 5 --trim-length 10');
        expect(trimmed).toContain(post.id);
        expect(trimmed).not.toContain(post.message);
    });

    test('rejects out-of-range list messages flags', async () => {
        const text = await runCommand(s.admin, s.fx.source.id, '/wrangler list messages --count 100000');
        expect(text).toContain('Error');
        expect(text).toContain('must be between');
    });
});
