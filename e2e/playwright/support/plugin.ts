// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

import type {Client4} from '@mattermost/client';

import {DEFAULT_MESSAGES, PLUGIN_ID} from './constants';

const DIST_DIR = path.resolve(__dirname, '../../../dist');

// Plugin settings are stored with lowercased keys by the admin console.
export type WranglerSettings = {
    permittedwranglerusers?: 'system-admins' | 'system-admins-and-email-domain' | 'all-users';
    allowedemaildomain?: string;
    enablewebui?: boolean;
    commandautocompleteenable?: boolean;
    movethreadmaxcount?: string;
    movethreadtoanotherteamenable?: boolean;
    movethreadfromprivatechannelenable?: boolean;
    movethreadfromdirectmessagechannelenable?: boolean;
    movethreadfromgroupmessagechannelenable?: boolean;
    mergethreadenable?: boolean;
    threadattachmessage?: string;
    movethreadmessage?: string;
    copythreadmessage?: string;
};

export const DEFAULT_SETTINGS: WranglerSettings = {
    permittedwranglerusers: 'system-admins',
    allowedemaildomain: '',
    enablewebui: false,
    commandautocompleteenable: false,
    movethreadmaxcount: '',
    movethreadtoanotherteamenable: false,
    movethreadfromprivatechannelenable: false,
    movethreadfromdirectmessagechannelenable: false,
    movethreadfromgroupmessagechannelenable: false,
    mergethreadenable: false,
    threadattachmessage: DEFAULT_MESSAGES.attach,
    movethreadmessage: DEFAULT_MESSAGES.move,
    copythreadmessage: DEFAULT_MESSAGES.copy,
};

export function findPluginBundle(): string {
    const bundles = fs.existsSync(DIST_DIR) ? fs.readdirSync(DIST_DIR).filter((f) => f.startsWith(PLUGIN_ID) && f.endsWith('.tar.gz')) : [];
    if (bundles.length === 0) {
        throw new Error(`No plugin bundle found in ${DIST_DIR}. Run \`make dist\` from the repo root first.`);
    }

    return bundles.
        map((f) => path.join(DIST_DIR, f)).
        sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

export async function installPlugin(client: Client4, bundlePath: string) {
    const file = new File([fs.readFileSync(bundlePath)], path.basename(bundlePath), {type: 'application/gzip'});
    await client.uploadPlugin(file, true);
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        if (await predicate()) {
            return;
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error('Timed out waiting for plugin state');
}

export async function restartPlugin(client: Client4) {
    await client.disablePlugin(PLUGIN_ID);
    await client.enablePlugin(PLUGIN_ID);
    await waitFor(async () => (await client.getPlugins()).active.some((p) => p.id === PLUGIN_ID));
}

async function writePluginSettings(client: Client4, settings: Record<string, unknown>) {
    const config = await client.getConfig();
    const plugins = (config.PluginSettings.Plugins ?? {}) as Record<string, Record<string, unknown>>;
    plugins[PLUGIN_ID] = settings;
    config.PluginSettings.Plugins = plugins as typeof config.PluginSettings.Plugins;
    await client.updateConfig(config);
}

async function waitForAutocomplete(client: Client4, expected: boolean) {
    const [team] = await client.getMyTeams();
    await waitFor(async () => {
        const commands = await client.getAutocompleteCommandsList(team.id);
        return commands.some((c) => c.trigger === 'wrangler') === expected;
    });
}

// patchPluginSettings waits until the plugin has applied the new settings.
// OnConfigurationChange re-registers the slash command last, so the command's
// autocomplete flag is observable proof the whole config was applied. The
// flag is flipped first so the final value is always a detectable change.
export async function patchPluginSettings(client: Client4, patch: WranglerSettings) {
    const config = await client.getConfig();
    const current = (config.PluginSettings.Plugins?.[PLUGIN_ID] ?? {}) as Record<string, unknown>;
    const target = {...current, ...patch};
    const autocomplete = Boolean(target.commandautocompleteenable);

    await writePluginSettings(client, {...target, commandautocompleteenable: !autocomplete});
    await waitForAutocomplete(client, !autocomplete);

    await writePluginSettings(client, target);
    await waitForAutocomplete(client, autocomplete);
}

export function resetPluginSettings(client: Client4) {
    return patchPluginSettings(client, DEFAULT_SETTINGS);
}

// getUserPluginSettings returns the web UI flags the plugin exposes to the given user.
export async function getUserPluginSettings(client: Client4) {
    const response = await fetch(`${client.getUrl()}/plugins/${PLUGIN_ID}/api/v1/settings`, {
        headers: {Authorization: `Bearer ${client.getToken()}`, 'X-Requested-With': 'XMLHttpRequest'},
    });
    return response.json() as Promise<{enable_web_ui: boolean; enable_merge_thread: boolean}>;
}

// withSettings applies a settings patch for the duration of fn, then restores defaults.
export async function withSettings<T>(client: Client4, patch: WranglerSettings, fn: () => Promise<T>): Promise<T> {
    await patchPluginSettings(client, {...DEFAULT_SETTINGS, ...patch});
    try {
        return await fn();
    } finally {
        await resetPluginSettings(client);
    }
}
