import {GlobalState} from '@mattermost/types/store';

import {Channel} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {getTeam, getTeamMemberships} from 'mattermost-redux/selectors/entities/teams';
import {Client4} from 'mattermost-redux/client';

import {RECEIVED_PLUGIN_SETTINGS} from '../types/wrangler';
import {OPEN_MOVE_THREAD_MODAL, CLOSE_MOVE_THREAD_MODAL} from '../types/ui';
import {INITIALIZE_ATTACH_POST, FINALIZE_ATTACH_POST, RichPost} from '../types/attach';
import {INITIALIZE_MERGE_THREAD, FINALIZE_MERGE_THREAD} from '../types/merge';

import Client from '../client';
import {INITIALIZE_COPY_TO_CHANNEL, FINALIZE_COPY_TO_CHANNEL} from 'src/types/channel';

export type GetStateFunc = () => GlobalState;
export type ActionResult = {
    data: any; //eslint-disable-line @typescript-eslint/no-explicit-any
} | {
    error: any; //eslint-disable-line @typescript-eslint/no-explicit-any
};
export type DispatchFunc = (action: Action, getState?: GetStateFunc | null) => Promise<ActionResult>;
export type ActionFunc = (dispatch: DispatchFunc, getState: GetStateFunc) => Promise<ActionResult|ActionResult[]> | ActionResult;
export type Action = ActionFunc | GenericAction;
export type GenericAction = {
    type: string;
    [extraProps: string]: any; //eslint-disable-line @typescript-eslint/no-explicit-any
};

export function openMoveThreadModal(postID: string): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: OPEN_MOVE_THREAD_MODAL,
            post_id: postID,
        });

        return {data: postID};
    };
}

export function closeMoveThreadModal(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: CLOSE_MOVE_THREAD_MODAL,
        });

        return {data: null};
    };
}

export function startAttachingPost(post: RichPost): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: INITIALIZE_ATTACH_POST,
            post,
        });

        return {data: null};
    };
}

export function finishAttachingPost(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: FINALIZE_ATTACH_POST,
        });

        return {data: null};
    };
}

export function startCopyToChannel(channel: Channel): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: INITIALIZE_COPY_TO_CHANNEL,
            channel,
        });

        return {data: null};
    };
}

export function finishCopyToChannel(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: FINALIZE_COPY_TO_CHANNEL,
        });

        return {data: null};
    };
}

export function startMergingThread(post: RichPost): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: INITIALIZE_MERGE_THREAD,
            post,
        });

        return {data: null};
    };
}

export function finishMergingThread(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({
            type: FINALIZE_MERGE_THREAD,
        });

        return {data: null};
    };
}

export function getSettings(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        const {data: settings, error} = await Client.getSettings();
        if (error) {
            return {error};
        }

        dispatch({
            type: RECEIVED_PLUGIN_SETTINGS,
            settings,
        });

        return {data: settings};
    };
}

export function getMyTeams(): Function {
    return async (_: DispatchFunc, getState: GetStateFunc) => {
        const myTeamMemberships = getTeamMemberships(getState());
        const myTeams = Array<Team>();
        Object.keys(myTeamMemberships).forEach((id) => {
            const team = getTeam(getState(), id);

            // There are cases where a team may not be loaded into redux even
            // though they exist. This seems most likely to occur when many
            // teams exist on the Mattermost instance. This will protect against
            // crashes, but looking up missing teams will require further
            // investigation.
            if (typeof team !== 'undefined') {
                myTeams.push(team);
            }
        });

        return myTeams;
    };
}

export function getChannelsForTeam(teamID: string): Function {
    return async () => {
        let allMyChannelsInTeam = Array<Channel>();
        allMyChannelsInTeam = await Client4.getMyChannels(teamID);

        const myOpenAndPrivateChannelsInTeam = Array<Channel>();
        allMyChannelsInTeam.forEach((channel) => {
            if (channel.type === 'O' || channel.type === 'P') {
                myOpenAndPrivateChannelsInTeam.push(channel);
            }
        });

        return myOpenAndPrivateChannelsInTeam;
    };
}

export function moveThread(postID: string, channelID: string, showRootMessage: boolean, silent: boolean): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const command = `/wrangler move thread ${postID} ${channelID} --show-root-message-in-summary=${showRootMessage} --silent=${silent}`;
        await Client.clientExecuteCommand(getState, command);

        return {data: null};
    };
}

export function copyThread(postID: string, channelID: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const command = `/wrangler copy thread ${postID} ${channelID}`;
        await Client.clientExecuteCommand(getState, command);

        return {data: null};
    };
}

export function attachMessage(postToBeAttachedID: string, postToAttachToID: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const command = `/wrangler attach message ${postToBeAttachedID} ${postToAttachToID}`;
        await Client.clientExecuteCommand(getState, command);

        return {data: null};
    };
}

export function mergeThread(postToBeMergedID: string, postToMergeToID: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const command = `/wrangler merge thread ${postToBeMergedID} ${postToMergeToID}`;
        await Client.clientExecuteCommand(getState, command);

        return {data: null};
    };
}
