import React from 'react';

import {Channel} from '@mattermost/types/channels';

import LeftSidebarElement from '../left_sidebar_element';

interface Props {
    finishCopyToChannel: Function;
    channelToCopyTo: Channel;
}

type State = {}

export default class LeftSidebarCopyToChannel extends React.PureComponent<Props, State> {
    private exit = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.props.finishCopyToChannel();
    };

    public render() {
        const channelToCopyTo = this.props.channelToCopyTo;
        if (!channelToCopyTo) {
            return null;
        }

        const tooltipContent = (<div>
            <p>{'Howdy Partner!'}</p>
            <p>{'It looks like you are copying messages to the ' + channelToCopyTo.display_name + ' channel.'}</p>
            <p>{'Use the post dropdown on messages you want to copy and click the "X" right here to quit.'}</p>
        </div>);

        return (
            <LeftSidebarElement
                id={'copy-to-channel'}
                text={'Channel Copy'}
                tooltip={tooltipContent}
                clickHandler={this.exit}
            />
        );
    }
}
