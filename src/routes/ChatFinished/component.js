import { Component } from 'preact';
import Button from '../../components/Button';
import Form from '../../components/Form';
import Screen from '../../components/Screen';
import { createClassName } from '../../components/helpers';
import styles from './styles';

const defaultGreeting = I18n.t('Thanks for talking with us');
const defaultMessage = I18n.t('If you have any other questions, just press the button below to start a new chat.');

export default class ChatFinished extends Component {
	handleClick = () => {
		const { onRedirectChat } = this.props;
		onRedirectChat && onRedirectChat();
	}

	render = ({
		color,
		title,
		greeting,
		message,
		// eslint-disable-next-line no-unused-vars
		onRedirectChat,
		...props
	}) => (
		<Screen
			color={color}
			title={title}
			className={createClassName(styles, 'chat-finished')}
			{...props}
		>
			<Screen.Content>
				<p className={createClassName(styles, 'chat-finished__greeting')}>{greeting || defaultGreeting}</p>
				<p className={createClassName(styles, 'chat-finished__message')}>{message || defaultMessage}</p>

				<Form>
					<Form.Item>
						<Button onClick={this.handleClick} stack>{ I18n.t('New Chat') }</Button>
					</Form.Item>
				</Form>
			</Screen.Content>
			<Screen.Footer />
		</Screen>
	)
}
