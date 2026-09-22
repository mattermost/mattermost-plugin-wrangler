import React, {ReactNode} from 'react';

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faHatCowboy} from '@fortawesome/free-solid-svg-icons';

import {Tooltip, OverlayTrigger} from 'react-bootstrap';

import './style.scss';

interface Props {
    id: string;
    text: string;
    tooltip: ReactNode;
    newSidebar?: boolean;
    clickHandler: (event: React.MouseEvent) => void;
}

type State = {}

export default class LeftSidebarElement extends React.PureComponent<Props, State> {
    public render() {
        const iconStyle = {
            margin: '0 7px 0 1px',
        };

        const buttonClass = this.props.newSidebar ? 'SidebarChannelGroupHeader_addButton pull-right' : 'btn-old-sidebar';

        return (
            <OverlayTrigger
                key={this.props.id + '-overlay'}
                placement='right'
                overlay={<Tooltip id={this.props.id + '-tooltip'}>{this.props.tooltip}</Tooltip>}
            >
                <div className={'wrangler-left-sidebar-wrapper'}>
                    <div className={'wrangler-left-sidebar'}>
                        <FontAwesomeIcon
                            className='MenuItem__icon'
                            style={iconStyle}
                            icon={faHatCowboy}
                        />
                        {this.props.text}
                    </div>
                    <button
                        type='button'
                        className={buttonClass}
                        aria-label='Exit Wrangler Mode'
                        onClick={this.props.clickHandler}
                    >
                        <i className='icon-close'/>
                    </button>
                </div>
            </OverlayTrigger>
        );
    }
}
