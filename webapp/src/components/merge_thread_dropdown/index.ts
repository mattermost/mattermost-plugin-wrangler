import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {startMergingThread, finishMergingThread, mergeThread} from '../../actions';
import {getMergeThreadPost} from '../../selectors';

import MergeThreadDropdown from './merge_thread_dropdown';

interface Props {
    postId: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    let post = getPost(state, props.postId);
    const oldSystemMessageOrNull = post ? isSystemMessage(post) : true;
    const systemMessage = isCombinedUserActivityPost(post) || oldSystemMessageOrNull;

    if (post) {
        if (post.root_id !== '') {
            post = getPost(state, post.root_id);
        }
    }

    let user = null;
    let channel = null;
    if (!systemMessage) {
        user = getUser(state, post.user_id);
        channel = getChannel(state, post.channel_id);
    }

    return {
        post,
        user,
        channel,
        isSystemMessage: systemMessage,
        mergeThreadPost: getMergeThreadPost(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        startMergingThread,
        finishMergingThread,
        mergeThread,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(MergeThreadDropdown);
