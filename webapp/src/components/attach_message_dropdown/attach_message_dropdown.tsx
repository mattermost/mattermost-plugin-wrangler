import React from 'react';

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHatCowboy} from '@fortawesome/free-solid-svg-icons';

import {Post} from '@mattermost/types/posts';
import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {RichPost} from 'src/types/post';

interface Props {
    post: Post;
    user: UserProfile;
    channel: Channel
    postToBeAttached: RichPost;
    isSystemMessage: boolean;
    isValidAttachMessage: boolean;
    startAttachingPost: Function;
    finishAttachingPost: Function;
    attachMessage: Function;
}

type State = {}

export default class AttachMessageDropdown extends React.PureComponent<Props, State> {
    private handleStartAttaching = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        const postToBeAttached = {
            post: this.props.post,
            user: this.props.user,
            channel: this.props.channel,
        };
        this.props.startAttachingPost(postToBeAttached);
    };

    private handleAttachMessage = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.props.attachMessage(this.props.postToBeAttached.post.id, this.props.post.id);
        this.props.finishAttachingPost();
    };

    public render() {
        if (this.props.isSystemMessage) {
            return null;
        }
        if (!this.props.isValidAttachMessage && !this.props.postToBeAttached) {
            return null;
        }
        if (this.props.postToBeAttached) {
            if (this.props.post.id === this.props.postToBeAttached.post.id) {
                return null;
            }
            if (this.props.channel.id !== this.props.postToBeAttached.channel.id) {
                return null;
            }
            if (this.props.post.create_at > this.props.postToBeAttached.post.create_at) {
                return null;
            }
        }

        let dropdownText = 'Attach to Thread';
        let clickHandler = this.handleStartAttaching;
        if (this.props.postToBeAttached) {
            dropdownText = 'Attach to this Thread';
            clickHandler = this.handleAttachMessage;
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
                        onClick={clickHandler}
                    >
                        <FontAwesomeIcon
                            className='MenuItem__icon'
                            icon={faHatCowboy}
                        />
                        {dropdownText}
                    </button>
                </li>
            </React.Fragment>
        );
    }
}
