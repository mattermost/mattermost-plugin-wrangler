// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {runCommand} from '../support/commands';
import {createThread, getThreadMessages, isPostDeleted} from '../support/posts';
import {withSettings} from '../support/plugin';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe('Merge thread', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    /**
     * @objective Verify the merge command is refused while merging is disabled
     */
    test('rejects merge thread while merging is disabled', {tag: '@wrangler_merge'}, async () => {
        const older = await createThread(s.admin, s.fx.source.id, 0, 'merge-off-a');
        const newer = await createThread(s.admin, s.fx.source.id, 0, 'merge-off-b');

        // # Run merge with default settings
        const text = await runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${newer.root.id} ${older.root.id}`);

        // * Verify the command is refused and the thread is kept
        expect(text).toContain('Merge thread command is not enabled');
        expect(await isPostDeleted(s.admin, newer.root.id)).toBe(false);
    });

    /**
     * @objective Verify a newer thread is merged into an older one with original timestamps preserved
     *
     * @precondition
     * Merging is enabled
     */
    test('merges a newer thread into an older one and preserves timestamps', {tag: '@wrangler_merge'}, async () => {
        const older = await createThread(s.admin, s.fx.source.id, 1, 'merge-a');
        const newer = await createThread(s.admin, s.fx.source.id, 1, 'merge-b');

        await withSettings(s.admin, {mergethreadenable: true}, async () => {
            // # Merge the newer thread into the older one
            const text = await runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${newer.root.id} ${older.root.id}`);

            // * Verify the merge is reported
            expect(text).toContain('A thread with 2 message(s) has been merged');
        });

        // * Verify the newer thread is gone
        expect(await isPostDeleted(s.admin, newer.root.id)).toBe(true);

        // * Verify the older thread holds all four posts with their original timestamps
        const thread = await s.admin.getPostThread(older.root.id);
        const merged = Object.values(thread.posts).filter((p) => p.delete_at === 0);
        for (const original of newer.posts) {
            const copy = merged.find((p) => p.message === original.message);
            expect(copy?.create_at).toBe(original.create_at);
        }
        expect(merged.length).toBe(4);
    });

    /**
     * @objective Verify an older thread cannot be merged into a newer one
     *
     * @precondition
     * Merging is enabled
     */
    test('refuses to merge an older thread into a newer one', {tag: '@wrangler_merge'}, async () => {
        const older = await createThread(s.admin, s.fx.source.id, 0, 'merge-order-a');
        const newer = await createThread(s.admin, s.fx.source.id, 0, 'merge-order-b');

        // # Merge in the wrong direction
        const text = await withSettings(s.admin, {mergethreadenable: true}, () => runCommand(s.admin, s.fx.source.id, `/wrangler merge thread ${older.root.id} ${newer.root.id}`));

        // * Verify the merge is refused and the older thread remains
        expect(text).toContain('Cannot merge older threads into newer threads');
        expect(await getThreadMessages(s.admin, older.root.id)).not.toBeNull();
    });
});
