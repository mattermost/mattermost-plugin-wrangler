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
    mergeThreadPost: RichPost;
    isSystemMessage: boolean;
    startMergingThread: Function;
    finishMergingThread: Function;
    mergeThread: Function;
}

type State = {}

export default class MergeThreadDropdown extends React.PureComponent<Props, State> {
    private handleStartMergingThread = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }
        const mergeThreadPost = {
            post: this.props.post,
            user: this.props.user,
            channel: this.props.channel,
        };
        this.props.startMergingThread(mergeThreadPost);
    };

    private handleMergeThread = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.props.mergeThread(this.props.mergeThreadPost.post.id, this.props.post.id);
        this.props.finishMergingThread();
    };

    public render() {
        if (this.props.isSystemMessage) {
            return null;
        }
        if (this.props.mergeThreadPost) {
            if (this.props.post.id === this.props.mergeThreadPost.post.id) {
                return null;
            }
            if (this.props.post.create_at >= this.props.mergeThreadPost.post.create_at) {
                return null;
            }
        }

        let dropdownText = 'Merge to thread';
        let clickHandler = this.handleStartMergingThread;
        if (this.props.mergeThreadPost) {
            dropdownText = 'Merge to this Thread';
            clickHandler = this.handleMergeThread;
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
