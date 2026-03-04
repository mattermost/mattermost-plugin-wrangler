import {Channel} from '@mattermost/types/channels';

import id from '../plugin_id';

export type Settings = {
    enable_web_ui: boolean;
    enable_merge_thread: boolean;
}

export type Channels = Array<Channel>

export const RECEIVED_PLUGIN_SETTINGS = `${id}_plugin_settings`;

export type ReceivedPluginSettingsAction = {
    type: typeof RECEIVED_PLUGIN_SETTINGS;
    settings: Settings;
};

export type WranglerActionType = ReceivedPluginSettingsAction;
