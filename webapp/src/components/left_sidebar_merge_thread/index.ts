import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';

import {finishMergingThread} from '../../actions';
import {getMergeThreadPost} from '../../selectors';

import LeftSidebarMergeThreadMessage from './left_sidebar_merge_thread';

function mapStateToProps(state: GlobalState) {
    return {
        mergeThreadPost: getMergeThreadPost(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        finishMergingThread,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(LeftSidebarMergeThreadMessage);
