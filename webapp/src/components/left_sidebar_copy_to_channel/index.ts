import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';

import {finishCopyToChannel} from '../../actions';
import {getChannelToCopyTo} from '../../selectors';

import LeftSidebarCopyToChannel from './left_sidebar_copy_to_channel';

function mapStateToProps(state: GlobalState) {
    return {
        channelToCopyTo: getChannelToCopyTo(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        finishCopyToChannel,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(LeftSidebarCopyToChannel);
