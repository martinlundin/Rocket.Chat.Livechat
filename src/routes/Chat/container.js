import { Component } from 'preact';
import { route } from 'preact-router';
import SDK from '../../api';
import { Consumer } from '../../store';
import { closeChat, initRoom, loadConfig } from '../../lib/main';
import { createToken, insert, getAvatarUrl, uploadFile, renderMessage } from '../../components/helpers';
import Chat from './component';
import { ModalManager } from '../../components/Modal';


export class ChatContainer extends Component {
	loadMessages = async() => {
		const { dispatch, room: { _id: rid } = {} } = this.props;

		if (!rid) {
			return;
		}

		await dispatch({ loading: true });
		const messages = await SDK.loadMessages(rid);
		await dispatch({ messages: (messages || []).reverse(), noMoreMessages: false });
		await dispatch({ loading: false });
	}

	loadMoreMessages = async() => {
		const { dispatch, room: { _id: rid } = {}, messages = [], noMoreMessages = false } = this.props;

		if (!rid || noMoreMessages) {
			return;
		}

		await dispatch({ loading: true });
		const moreMessages = await SDK.loadMessages(rid, { limit: messages.length + 10 });
		await dispatch({
			messages: (moreMessages || []).reverse(),
			noMoreMessages: messages.length + 10 >= moreMessages.length,
		});
		await dispatch({ loading: false });
	}

	grantUser = async() => {
		const { token, user } = this.props;

		if (user) {
			return user;
		}

		await SDK.grantVisitor({ visitor: { token } });
		await loadConfig();
	}

	getRoom = async() => {
		const { dispatch, room } = this.props;

		if (room) {
			return room;
		}

		const newRoom = await SDK.room();
		await dispatch({ room: newRoom, messages: [], noMoreMessages: false });
		await initRoom();

		return newRoom;
	}

	handleTop = () => {
		this.loadMoreMessages();
	}

	handleChangeText = async(text) => {
		const { user, room } = this.props;
		if (!(user.username && room._id)) {
			return;
		}

		await SDK.notifyVisitorTyping(room._id, user.username, text.length > 0);
	}

	handleSubmit = async(msg) => {
		if (msg.trim() === '') {
			return;
		}

		await this.grantUser();
		const { _id: rid } = await this.getRoom();
		const { alerts, dispatch, token, user } = this.props;
		try {
			await SDK.sendMessage({ msg, token, rid });
			// TODO: check the room id to ensure that the state room id and the message room id are the same
			// Otherwise, it's necessary to reset/reload the local room
		} catch (error) {
			const { message: reason } = error.data;
			const alert = { id: createToken(), children: reason, error: true, timeout: 5000 };
			await dispatch({ alerts: insert(alerts, alert) });
		}
		await SDK.notifyVisitorTyping(rid, user.username, false);

	}

	handleUpload = async(files) => {
		await this.grantUser();
		const { _id: rid } = await this.getRoom();
		const { token } = this.props;

		files.forEach(async(file) => await uploadFile({ token, rid, file }));
	}

	handlePlaySound = () => {
		const { dispatch, sound = {} } = this.props;
		dispatch({ sound: { ...sound, play: false } });
	}

	onChangeDepartment = () => {
		route('/switch-department');
	}

	doFinishChat = async() => {
		const { alerts, dispatch, room: { _id: rid } = {} } = this.props;

		if (!rid) {
			return;
		}

		await dispatch({ loading: true });
		try {
			await SDK.closeChat({ rid });
		} catch (error) {
			console.error(error);
			const alert = { id: createToken(), children: 'Error closing chat.', error: true, timeout: 0 };
			await dispatch({ alerts: insert(alerts, alert) });
		} finally {
			await dispatch({ loading: false });
			await closeChat();
		}
	}

	onFinishChat = () => {
		ModalManager.confirm({
			text: 'Are you sure you want to finish this chat?',
		}).then((result) => {
			if ((typeof result.success === 'boolean') && result.success) {
				this.doFinishChat();
			}
		});
	}

	doRemoveUserData = async() => {
		const { alerts, dispatch } = this.props;

		await dispatch({ loading: true });
		try {
			await SDK.deleteVisitor();
		} catch (error) {
			console.error(error);
			const alert = { id: createToken(), children: 'Error removing user data.', error: true, timeout: 0 };
			await dispatch({ alerts: insert(alerts, alert) });
		} finally {
			await loadConfig();
			await dispatch({ loading: false });
			route('/chat-finished');
		}
	}

	onRemoveUserData = async() => {
		ModalManager.confirm({
			text: 'Are you sure you want to remove all of your personal data?',
		}).then((result) => {
			if ((typeof result.success === 'boolean') && result.success) {
				this.doRemoveUserData();
			}
		});
	}

	canSwitchDepartment = () => {
		const { allowSwitchingDepartments, room, departments = {} } = this.props;
		return allowSwitchingDepartments && room && departments.filter((dept) => dept.showOnRegistration).length > 1;
	}

	canFinishChat = () => {
		const { room } = this.props;
		return room !== undefined;
	}

	canRemoveUserData = () => {
		const { allowRemoveUserData } = this.props;
		return allowRemoveUserData;
	}

	showOptionsMenu = () => (
		this.canSwitchDepartment() || this.canFinishChat() || this.canRemoveUserData()
	)

	componentDidMount() {
		this.loadMessages();
	}

	render = (props) => (
		<Chat
			{...props}
			onTop={this.handleTop}
			onChangeText={this.handleChangeText}
			onSubmit={this.handleSubmit}
			onUpload={this.handleUpload}
			onPlaySound={this.handlePlaySound}
			options={this.showOptionsMenu()}
			onChangeDepartment={(this.canSwitchDepartment() && this.onChangeDepartment) || null}
			onFinishChat={(this.canFinishChat() && this.onFinishChat) || null}
			onRemoveUserData={(this.canRemoveUserData() && this.onRemoveUserData) || null}
		/>
	)
}


export const ChatConnector = ({ ref, ...props }) => (
	<Consumer>
		{({
			config: {
				settings: {
					fileUpload: uploads,
					allowSwitchingDepartments,
					forceAcceptDataProcessingConsent: allowRemoveUserData,
				} = {},
				messages: {
					conversationFinishedMessage,
				} = {},
				theme: {
					color,
					title,
				} = {},
				departments = {},
			},
			iframe: {
				theme: {
					customColor,
					customFontColor,
				} = {},
			},
			token,
			agent,
			sound,
			user,
			room,
			messages,
			noMoreMessages,
			typing,
			loading,
			dispatch,
			alerts,
		}) => (
			<ChatContainer
				ref={ref}
				{...props}
				color={customColor || color}
				fontColor={customFontColor}
				title={title || I18n.t('Need help?')}
				sound={sound}
				token={token}
				user={user ? {
					_id: user._id,
					username: user.username,
					avatar: {
						description: user.username,
						src: getAvatarUrl(user.username),
					},
				} : undefined}
				agent={agent ? {
					_id: agent._id,
					name: agent.name,
					status: agent.status,
					email: agent.emails && agent.emails[0] && agent.emails[0].address,
					username: agent.username,
					avatar: {
						description: agent.username,
						src: getAvatarUrl(agent.username),
					},
				} : undefined}
				room={room}
				messages={messages.filter((message) => renderMessage(message))}
				noMoreMessages={noMoreMessages}
				emoji={false}
				uploads={uploads}
				typingAvatars={Array.isArray(typing) ? typing.map((username) => ({
					description: username,
					src: getAvatarUrl(username),
				})) : []}
				loading={loading}
				dispatch={dispatch}
				departments={departments}
				allowSwitchingDepartments={allowSwitchingDepartments}
				conversationFinishedMessage={conversationFinishedMessage || I18n.t('Conversation finished')}
				allowRemoveUserData={allowRemoveUserData}
				alerts={alerts}
			/>
		)}
	</Consumer>
);


export default ChatConnector;
