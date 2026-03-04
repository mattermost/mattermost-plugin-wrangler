import React from 'react';

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHatCowboy} from '@fortawesome/free-solid-svg-icons';

import {Channel} from '@mattermost/types/channels';
import {Post} from '@mattermost/types/posts';

interface Props {
    post: Post;
    targetChannel: Channel;
    isSystemMessage: boolean;
    copyThread: Function;
}

type State = {}

export default class CopyToChannelDropdown extends React.PureComponent<Props, State> {
    private handleCopyThread = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.props.copyThread(this.props.post.id, this.props.targetChannel.id);
    };

    public render() {
        if (this.props.isSystemMessage) {
            return null;
        }
        if (!this.props.targetChannel) {
            return null;
        }
        if (this.props.post.channel_id === this.props.targetChannel.id) {
            return null;
        }

        return (
            <React.Fragment>
                <li
                    className='MenuItem'
                    role='menuitem'
                >
                    <button
                        className='style--none'
                        role='presentation'
                        onClick={this.handleCopyThread}
                    >
                        <FontAwesomeIcon
                            className='MenuItem__icon'
                            icon={faHatCowboy}
                        />
                        {'Copy to Channel'}
                    </button>
                </li>
            </React.Fragment>
        );
    }
}
