import {GlobalState} from '@mattermost/types/store';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import id from '../plugin_id';

type GetStateFunc = () => GlobalState;

export default class Client {
    getSettings = async () => {
        return this.doFetch(
            `${this.getAPIV1BaseRoute()}/settings`,
            {method: 'get'},
        );
    }

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

    clientExecuteCommand = async (getState: GetStateFunc, command: string) => {
        const currentChannel = getCurrentChannel(getState());
        const currentTeamId = getCurrentTeamId(getState());

        const args = {
            channel_id: currentChannel.id,
            team_id: currentTeamId,
        };

        try {
            await Client4.executeCommand(command, args);
        } catch (error) {
            console.error(error); //eslint-disable-line no-console
        }
    }
}
