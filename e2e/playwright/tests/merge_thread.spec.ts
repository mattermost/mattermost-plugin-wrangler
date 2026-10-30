// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {runCommand} from '../support/commands';
import {createThread, getThreadMessages, isPostDeleted} from '../support/posts';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe.serial('Merge thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('is rejected while merging is disabled', async () => {
        const older = await createThread(s.admin, s.fx.source.id, 0, 'merge-off-a');
        const newer = await createThread(s.admin, s.fx.source.id, 0, 'merge-off-b');

        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${newer.root.id} ${older.root.id}`);
        expect(text).toContain('Merge thread command is not enabled');
        expect(await isPostDeleted(s.admin, newer.root.id)).toBe(false);
    });

    test('merges a newer thread into an older one and preserves timestamps', async () => {
        const older = await createThread(s.admin, s.fx.source.id, 1, 'merge-a');
        const newer = await createThread(s.admin, s.fx.source.id, 1, 'merge-b');

        await withSettings(s.admin, {mergethreadenable: true}, async () => {
            const text = await runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${newer.root.id} ${older.root.id}`);
            expect(text).toContain('A thread with 2 message(s) has been merged');
        });

        expect(await isPostDeleted(s.admin, newer.root.id)).toBe(true);

        const thread = await s.admin.getPostThread(older.root.id);
        const merged = Object.values(thread.posts).filter((p) => p.delete_at === 0);
        for (const original of newer.posts) {
            const copy = merged.find((p) => p.message === original.message);
            expect(copy?.create_at).toBe(original.create_at);
        }
        expect(merged.length).toBe(4);
    });

    test('refuses to merge an older thread into a newer one', async () => {
        const older = await createThread(s.admin, s.fx.source.id, 0, 'merge-order-a');
        const newer = await createThread(s.admin, s.fx.source.id, 0, 'merge-order-b');

        const text = await withSettings(s.admin, {mergethreadenable: true}, () => runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${older.root.id} ${newer.root.id}`));
        expect(text).toContain('Cannot merge older threads into newer threads');
        expect(await getThreadMessages(s.admin, older.root.id)).not.toBeNull();
    });
});
