import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';
import {getPost as getPostSel} from 'mattermost-redux/selectors/entities/posts';

import {isMoveModalVisable, getMoveThreadPostID} from '../../selectors';
import {closeMoveThreadModal, moveThread, copyThread, getMyTeams, getChannelsForTeam} from '../../actions';

import MoveThreadModal from './move_thread_modal';

function mapStateToProps(state: GlobalState) {
    let postID = getMoveThreadPostID(state);
    const post = getPostSel(state, postID);
    let message = '';
    let threadCount = 1;

    if (post) {
        const postsInThread = state.entities.posts.postsInThread[post.id];
        if (postsInThread) {
            threadCount = postsInThread.length + 1;
        }
        postID = post.id;
        message = post.message;
    }

    return {
        visible: isMoveModalVisable(state),
        postID,
        message,
        threadCount,
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        closeMoveThreadModal,
        getMyTeams,
        getChannelsForTeam,
        moveThread,
        copyThread,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(MoveThreadModal);
