import React from 'react';

import {Modal} from 'react-bootstrap';
import Form from 'react-bootstrap/Form';

import {Team} from '@mattermost/types/teams';
import {Channel} from '@mattermost/types/channels';

import {MessageActionType, MessageActionTypeMove, MessageActionTypeCopy} from '../../types/actions';

import '../style.scss';

interface Props {
    visible: boolean;
    postID: string;
    message: string;
    threadCount: number;
    moveThread: Function;
    copyThread: Function;
    getMyTeams: Function;
    getChannelsForTeam: Function;
    closeMoveThreadModal: Function;
}

type State = {
    allTeams: Array<Team>;
    channelsInTeam: Array<Channel>;
    selectedTeam: string;
    selectedChannel: string;
    moveThreadButtonText: string;
    actionType: MessageActionType,
    actionWord: string,
    moveShowRootMessage: boolean,
    moveSilent: boolean,
    processing: boolean,
}

export default class MoveThreadModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            allTeams: Array<Team>(),
            channelsInTeam: Array<Channel>(),
            selectedTeam: '',
            selectedChannel: '',
            moveThreadButtonText: this.getMoveButtonText('Move'),
            actionType: MessageActionTypeMove,
            actionWord: 'Move',
            moveShowRootMessage: true,
            moveSilent: false,
            processing: false,
        };
    }

    componentDidMount() {
        this.loadTeams();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (prevProps.threadCount !== this.props.threadCount || prevState.actionWord !== this.state.actionWord) {
            this.setButtonState();
        }
    }

    private loadTeams = async () => {
        const myTeams = await this.props.getMyTeams();

        let firstTeamID = '';
        let firstChannelID = '';
        let channels = Array<Channel>();
        if (myTeams.length > 0) {
            const firstTeam = myTeams[0];
            firstTeamID = firstTeam.id;
            channels = await this.props.getChannelsForTeam(firstTeamID);
            if (channels.length > 0) {
                const firstChannel = channels[0];
                firstChannelID = firstChannel.id;
            }
        }

        this.setState({
            allTeams: myTeams,
            channelsInTeam: channels,
            selectedTeam: firstTeamID,
            selectedChannel: firstChannelID,
        });
    }

    private handleTeamSelectChange = async (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
        const teamID = event.target.value;
        const channels = await this.props.getChannelsForTeam(teamID);
        let firstChannelID = '';
        if (channels.length > 0) {
            const firstChannel = channels[0];
            firstChannelID = firstChannel.id;
        }

        this.setState({
            selectedTeam: teamID,
            selectedChannel: firstChannelID,
            channelsInTeam: channels,
        });
    }

    private handleChannelSelectChange = (event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
        this.setState({selectedChannel: event.target.value});
    }

    private handleOnClick = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.setState({processing: true});
        if (this.state.actionType === MessageActionTypeMove) {
            await this.props.moveThread(this.props.postID, this.state.selectedChannel, this.state.moveShowRootMessage, this.state.moveSilent);
        } else {
            await this.props.copyThread(this.props.postID, this.state.selectedChannel);
        }
        this.props.closeMoveThreadModal();
        this.setState({processing: false});
    };

    private handleClose = async (event: React.MouseEvent) => {
        if (event && event.preventDefault) {
            event.preventDefault();
        }

        this.props.closeMoveThreadModal();
    };

    private setButtonState() {
        this.setState({moveThreadButtonText: this.getMoveButtonText(this.state.actionWord)});
    }

    private getMoveButtonText(actionWord: string) {
        if (this.props.threadCount === 1) {
            return actionWord + ' Message';
        }

        return actionWord + ' Thread';
    }

    private handleButtonOnMouseEnter() {
        this.setState({moveThreadButtonText: 'Yeehaw!'});
    }

    private handleButtonOnMouseLeave() {
        this.setState({moveThreadButtonText: this.getMoveButtonText(this.state.actionWord)});
    }

    public render() {
        let disabled = this.state.processing;
        if (this.props.postID === '' || this.state.selectedChannel === '') {
            disabled = true;
        }

        const actionWord = this.state.actionWord;
        let title = 'Wrangler - ' + actionWord + ' Message to Another Channel';
        let moveMessage = actionWord + ' this message?';
        if (this.props.threadCount > 1) {
            title = 'Wrangler - ' + actionWord + ' Thread to Another Channel';
            moveMessage = actionWord + ' this thread of ' + this.props.threadCount + ' messages?';
        }

        let actionButtonText = this.state.moveThreadButtonText;
        if (this.state.processing) {
            actionButtonText = (actionWord === 'Move') ? 'Moving...' : 'Copying...';
        }

        let moveCheckboxes = null;
        if (this.state.actionType === MessageActionTypeMove) {
            moveCheckboxes = (
                <div>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                id='showRootMessageOption'
                                className='styled-accent'
                                checked={this.state.moveShowRootMessage}
                                onChange={() => this.setState({moveShowRootMessage: !this.state.moveShowRootMessage})}
                            />
                            {'Show root message in move summary'}
                        </label>
                    </div>
                    <div className='checkbox'>
                        <label>
                            <input
                                type='checkbox'
                                id='showSilenceOption'
                                className='styled-accent'
                                checked={this.state.moveSilent}
                                onChange={() => this.setState({moveSilent: !this.state.moveSilent})}
                            />
                            {'Silence all Wrangler informational messages'}
                        </label>
                    </div>
                </div>
            );
        }

        return (
            <Modal
                dialogClassName='modal--scroll'
                show={this.props.visible}
                onHide={this.handleClose}
                onExited={this.handleClose}
                bsSize='large'
                backdrop='static'
            >
                <Modal.Header closeButton={true}>
                    <h1 className='modal-title'>{title}</h1>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group>
                            <Form.Label>{'Action'}</Form.Label>
                            <fieldset
                                key='actionType'
                                className='multi-select__radio'
                            >
                                <div className='radio'>
                                    <label>
                                        <input
                                            id={MessageActionTypeMove}
                                            type='radio'
                                            className='styled-accent'
                                            checked={this.state.actionType === MessageActionTypeMove}
                                            onChange={() => this.setState({actionType: MessageActionTypeMove, actionWord: 'Move'})}
                                        />
                                        {'Move'}
                                    </label>
                                </div>
                                <div className='radio'>
                                    <label>
                                        <input
                                            id={MessageActionTypeCopy}
                                            type='radio'
                                            className='styled-accent'
                                            checked={this.state.actionType === MessageActionTypeCopy}
                                            onChange={() => this.setState({actionType: MessageActionTypeCopy, actionWord: 'Copy'})}
                                        />
                                        {'Copy'}
                                    </label>
                                </div>
                            </fieldset>
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>{'Team'}</Form.Label>
                            <Form.Control
                                as='select'
                                onChange={this.handleTeamSelectChange}
                                value={this.state.selectedTeam}
                            >
                                {this.state.allTeams.map((team) => (
                                    <option
                                        key={team.id}
                                        id={team.id}
                                        value={team.id}
                                    >
                                        {team.display_name}
                                    </option>
                                ))}
                            </Form.Control>
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>{'Channel'}</Form.Label>
                            <Form.Control
                                as='select'
                                onChange={this.handleChannelSelectChange}
                                value={this.state.selectedChannel}
                                disabled={this.state.selectedTeam === ''}
                            >
                                {this.state.channelsInTeam.map((channel) => (
                                    <option
                                        key={channel.id}
                                        id={channel.id}
                                        value={channel.id}
                                    >
                                        {channel.display_name}
                                    </option>
                                ))}
                            </Form.Control>
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>{'Thread Root Message'}</Form.Label>
                            <textarea
                                style={{resize: 'none'}}
                                className='form-control'
                                rows={5}
                                value={this.props.message}
                                disabled={true}
                                readOnly={true}
                            />
                            {moveCheckboxes}
                        </Form.Group>
                    </Form>
                    <p><span className='pull-right'>{moveMessage}</span></p>
                </Modal.Body>
                <Modal.Footer>
                    <button
                        id='footerClose'
                        className='btn btn-tertiary'
                        onClick={this.handleClose}
                    >
                        {'Cancel'}
                    </button>
                    <button
                        id='saveSetting'
                        className='btn btn-primary'
                        style={{width: '130px'}}
                        onClick={this.handleOnClick}
                        onMouseEnter={this.handleButtonOnMouseEnter.bind(this)}
                        onMouseLeave={this.handleButtonOnMouseLeave.bind(this)}
                        disabled={disabled}
                    >
                        {actionButtonText}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
