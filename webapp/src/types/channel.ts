import {Channel} from '@mattermost/types/channels';

import id from '../plugin_id';

export const INITIALIZE_COPY_TO_CHANNEL = `${id}_init_copy_to_channel`;

export type CopyToChannelInitializeAction = {
    type: typeof INITIALIZE_COPY_TO_CHANNEL;
    channel: Channel;
};

export const FINALIZE_COPY_TO_CHANNEL = `${id}_finalize_copy_to_channel`;

export type CopyToChannelFinalizeAction = {
    type: typeof FINALIZE_COPY_TO_CHANNEL;
};

export type CopyToChannelAction = CopyToChannelInitializeAction | CopyToChannelFinalizeAction;
