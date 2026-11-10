import {GlobalState} from '@mattermost/types/store';
import {Client4} from 'mattermost-redux/client';
import {getChannel, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import id from '../plugin_id';

type GetStateFunc = () => GlobalState;

export default class Client {
    getSettings = async () => {
        return this.doFetch(
            `${this.getAPIV1BaseRoute()}/settings`,
            {method: 'get'},
        );
    };

    // Helpers

    getAPIV1BaseRoute() {
        return `/plugins/${id}/api/v1`;
    }

    doFetch = async (url: string, options: RequestInit) => {
        const response = await fetch(url, Client4.getOptions(options));

        let data: any; //eslint-disable-line @typescript-eslint/no-explicit-any
        try {
            data = await response.json();
        } catch (err) {
            if (!response.ok) {
                return {
                    error: 'Received invalid response from the server.',
                    status: response.status,
                    url,
                };
            }
        }

        if (response.ok) {
            return {
                response,
                data,
            };
        }

        return {
            error: data.message,
            status: response.status,
            url,
        };
    };

    // Wrangler commands must run in the channel that holds the post, which is not
    // necessarily the open channel; views such as Threads have no current channel.
    clientExecuteCommand = async (getState: GetStateFunc, command: string, postID: string) => {
        const state = getState();
        const post = getPost(state, postID);
        const channel = (post && getChannel(state, post.channel_id)) || getCurrentChannel(state);

        if (!channel) {
            console.error(`Wrangler: unable to find the channel to run "${command}" in`); //eslint-disable-line no-console
            return;
        }

        const args = {
            channel_id: channel.id,

            // DM and GM channels have no team.
            team_id: channel.team_id || getCurrentTeamId(state),
        };

        try {
            await Client4.executeCommand(command, args);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    };
}
