import { Component } from 'preact';
import { Livechat } from '../../api';
import { parentCall } from '../../lib/parentCall';
import { Consumer } from '../../store';
import LeaveMessage from './component';
import { insert, createToken } from '../../components/helpers';


export class LeaveMessageContainer extends Component {
	handleSubmit = async(fields) => {
		const { alerts, dispatch, successMessage } = this.props;

		await dispatch({ loading: true });
		try {
			const message = await Livechat.sendOfflineMessage(fields);
			const success = { id: createToken(), children: successMessage || message, success: true, timeout: 5000 };
			await dispatch({ alerts: insert(alerts, success) });
			parentCall('callback', ['offline-form-submit', fields]);
		} catch (error) {
			const { data: { message } } = error;
			console.error(message);
			const alert = { id: createToken(), children: message, error: true, timeout: 0 };
			await dispatch({ alerts: insert(alerts, alert) });
		} finally {
			await dispatch({ loading: false });
		}
	}

	render = (props) => (
		<LeaveMessage {...props} onSubmit={this.handleSubmit} />
	)
}


export const LeaveMessageConnector = ({ ref, ...props }) => (
	<Consumer>
		{({
			config: {
				messages: {
					offlineMessage: message,
					offlineSuccessMessage: successMessage,
					offlineUnavailableMessage: unavailableMessage,
				} = {},
				theme: {
					offlineTitle: title,
					offlineColor: color,
				} = {},
				settings: {
					displayOfflineForm,
				} = {},
			} = {},
			loading,
			token,
			dispatch,
			alerts,
		}) => (
			<LeaveMessageContainer
				ref={ref}
				{...props}
				title={title}
				theme={{ color }}
				message={message}
				successMessage={successMessage}
				unavailableMessage={unavailableMessage}
				loading={loading}
				token={token}
				dispatch={dispatch}
				alerts={alerts}
				hasForm={displayOfflineForm}
			/>
		)}
	</Consumer>
);


export default LeaveMessageConnector;
