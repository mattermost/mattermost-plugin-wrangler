import {connect} from 'react-redux';

import LeftSidebarElement from './left_sidebar_element';

function mapStateToProps() {
    return {
        newSidebar: true,
    };
}

export default connect(mapStateToProps, null)(LeftSidebarElement);
