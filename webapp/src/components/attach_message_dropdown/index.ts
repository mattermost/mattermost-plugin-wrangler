import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {startAttachingPost, finishAttachingPost, attachMessage} from '../../actions';
import {getPostToBeAttached} from '../../selectors';

import AttachMessageDropdown from './attach_message_dropdown';

interface Props {
    postId: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const post = getPost(state, props.postId);
    const oldSystemMessageOrNull = post ? isSystemMessage(post) : true;
    const systemMessage = isCombinedUserActivityPost(post) || oldSystemMessageOrNull;

    let user = null;
    let channel = null;
    if (!systemMessage) {
        user = getUser(state, post.user_id);
        channel = getChannel(state, post.channel_id);
    }

    let validAttach = false;
    if (post) {
        if (!state.entities.posts.postsInThread[post.id] && post.root_id === '') {
            validAttach = true;
        }
    }

    return {
        post,
        user,
        channel,
        isSystemMessage: systemMessage,
        isValidAttachMessage: validAttach,
        postToBeAttached: getPostToBeAttached(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        startAttachingPost,
        finishAttachingPost,
        attachMessage,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(AttachMessageDropdown);
