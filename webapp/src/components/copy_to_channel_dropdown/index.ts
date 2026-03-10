import {connect} from 'react-redux';
import {Dispatch, Action, bindActionCreators} from 'redux';

import {GlobalState} from '@mattermost/types/store';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {copyThread} from '../../actions';
import {getChannelToCopyTo} from '../../selectors';

import CopyToChannelDropdown from './copy_to_channel_dropdown';

interface Props {
    postId: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const post = getPost(state, props.postId);
    const oldSystemMessageOrNull = post ? isSystemMessage(post) : true;

    return {
        post,
        isSystemMessage: isCombinedUserActivityPost(post) || oldSystemMessageOrNull,
        targetChannel: getChannelToCopyTo(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<Action>) {
    return bindActionCreators({
        copyThread,
    }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(CopyToChannelDropdown);
