// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {USERNAMES} from '../support/constants';
import {runCommand} from '../support/commands';
import {createPost, createThread, findPostByMessage, getLatestBotDM, getThreadMessages, isPostDeleted} from '../support/posts';
import {loginFixtureUser} from '../support/fixtures';
import {loadSuite} from '../support/suite';
import type {Suite} from '../support/suite';

let s: Suite;

test.describe.serial('Attach message', () => {
    test.beforeAll(async () => {
        s = await loadSuite();
    });

    test('attaches a standalone message to a thread and notifies its author', async () => {
        const {client: regular} = await loginFixtureUser(USERNAMES.regular);
        const {root} = await createThread(s.admin, s.fx.source.id, 1, 'attach-root');
        const loose = await createPost(regular, s.fx.source.id, 'attach-loose');

        await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${root.id}`);

        expect(await isPostDeleted(s.admin, loose.id)).toBe(true);
        const attached = await findPostByMessage(s.admin, s.fx.source.id, loose.message);
        expect(attached?.root_id).toBe(root.id);
        expect(await getThreadMessages(s.admin, root.id)).toContain(loose.message);

        const dm = await getLatestBotDM(s.admin, s.fx.users.regular.id);
        expect(dm).toMatch(/^@sysadmin wrangled one of your messages into a thread for you: http\S+\/pl\/\w{26}$/);
    });

    test('attaching to a reply uses the thread root', async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 1, 'attach-reply');
        const loose = await createPost(s.admin, s.fx.source.id, 'attach-loose2');

        await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${posts[1].id}`);

        const attached = await findPostByMessage(s.admin, s.fx.source.id, loose.message);
        expect(attached?.root_id).toBe(root.id);
    });

    test('rejects invalid attach requests', async () => {
        const {root, posts} = await createThread(s.admin, s.fx.source.id, 1, 'attach-invalid');
        const other = await createThread(s.admin, s.fx.target.id, 0, 'attach-other');
        const loose = await createPost(s.admin, s.fx.source.id, 'attach-loose3');

        expect(await runCommand(s.admin, s.fx.source.id, '/wrangler attach message')).toContain('missing arguments');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${loose.id}`)).toContain('should not be the same');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${'a'.repeat(26)} ${root.id}`)).toContain('unable to get message with ID');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${loose.id} ${other.root.id}`)).toContain('another channel');
        expect(await runCommand(s.admin, s.fx.source.id, `/wrangler attach message ${posts[1].id} ${root.id}`)).toContain('already part of a thread');
        expect(await isPostDeleted(s.admin, loose.id)).toBe(false);
    });
});
