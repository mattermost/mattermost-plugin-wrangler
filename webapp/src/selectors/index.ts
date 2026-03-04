import {GlobalState} from '@mattermost/types/store';

import id from '../plugin_id';

const pluginState = (state: GlobalState) => state['plugins-' + id] || {};

export const getPluginSettings = (state: GlobalState) => pluginState(state).pluginSettings;

export const isMoveModalVisable = (state: GlobalState) => pluginState(state).moveThreadModalVisable;

export const getMoveThreadPostID = (state: GlobalState) => pluginState(state).getMoveThreadPostID;

export const getPostToBeAttached = (state: GlobalState) => pluginState(state).postToBeAttached;

export const getMergeThreadPost = (state: GlobalState) => pluginState(state).mergeThreadPost;

export const getChannelToCopyTo = (state: GlobalState) => pluginState(state).channelToCopyTo;
