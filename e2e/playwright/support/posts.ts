// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';

let counter = 0;

export function uniqueText(label: string) {
    counter += 1;
    return `${label}-${Date.now().toString(36)}-${counter}`;
}

// createThread creates a root post followed by replies through the API.
export async function createThread(client: Client4, channelId: string, replies = 0, label = 'thread') {
    const root = await client.createPost({channel_id: channelId, message: uniqueText(`${label}-root`)} as Post);
    const posts = [root];
    for (let i = 0; i < replies; i++) {
        // eslint-disable-next-line no-await-in-loop
        posts.push(await client.createPost({channel_id: channelId, message: uniqueText(`${label}-reply${i}`), root_id: root.id} as Post));
    }
    return {root, posts};
}

export async function createPost(client: Client4, channelId: string, label = 'post') {
    return client.createPost({channel_id: channelId, message: uniqueText(label)} as Post);
}

// getThreadMessages returns thread messages ordered by creation time, or null if the root is gone.
export async function getThreadMessages(client: Client4, postId: string): Promise<string[] | null> {
    try {
        const thread = await client.getPostThread(postId);
        return Object.values(thread.posts).
            filter((p) => p.delete_at === 0).
            sort((a, b) => a.create_at - b.create_at).
            map((p) => p.message);
    } catch {
        return null;
    }
}

export async function isPostDeleted(client: Client4, postId: string) {
    try {
        const post = await client.getPost(postId);
        return post.delete_at !== 0;
    } catch {
        return true;
    }
}

// findPostByMessage looks up a post in a channel by its exact message.
export async function findPostByMessage(client: Client4, channelId: string, message: string): Promise<Post | undefined> {
    const {order, posts} = await client.getPosts(channelId, 0, 100);
    return order.map((id) => posts[id]).find((p) => p.message === message && p.delete_at === 0);
}

// waitForPost polls until a post with the message exists in the channel.
export async function waitForPost(client: Client4, channelId: string, message: string, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        const post = await findPostByMessage(client, channelId, message);
        if (post) {
            return post;
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for post "${message}"`);
}

// getLatestDM returns the newest message in the DM channel between two users.
export async function getLatestDM(client: Client4, userId: string, otherUserId: string): Promise<string | undefined> {
    const channel = await client.createDirectChannel([userId, otherUserId]);
    const {order, posts} = await client.getPosts(channel.id, 0, 5);
    return order.map((id) => posts[id])[0]?.message;
}

// getLatestBotDM returns the newest DM the Wrangler bot sent to a user.
export async function getLatestBotDM(admin: Client4, userId: string): Promise<string | undefined> {
    const bot = await admin.getUserByUsername('wrangler');
    return getLatestDM(admin, userId, bot.id);
}
