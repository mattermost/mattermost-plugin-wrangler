import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';

import {finishAttachingPost} from '../../actions';
import {getPostToBeAttached} from '../../selectors';

import LeftSidebarAttachMessage from './left_sidebar_attach_message';

function mapStateToProps(state: GlobalState) {
    return {
        postToBeAttached: getPostToBeAttached(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        finishAttachingPost,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(LeftSidebarAttachMessage);
