/* eslint-disable */
import EventEmitter from 'wolfy87-eventemitter';


((window) => {
	window.RocketChat = window.RocketChat || { _: [] };
	var config = {};
	var widget;
	var iframe;
	var hookQueue = [];
	var ready = false;
	var smallScreen = false;
	var bodyStyle;
	var scrollPosition;

	var widgetWidth = '320px';
	var widgetHeightOpened = '350px';
	var widgetHeightClosed = (16 + 54 + 16) + 'px';

	var validCallbacks = [
		'chat-maximized',
		'chat-minimized',
		'chat-started',
		'chat-ended',
		'pre-chat-form-submit',
		'offline-form-submit'
	];
	var callbacks = new EventEmitter();

	var registerCallback = function(eventName, fn) {
		if (validCallbacks.indexOf(eventName) === -1) {
			return false;
		}

		return callbacks.on(eventName, fn);
	};

	var emitCallback = function(eventName, data) {
		if (typeof data !== 'undefined') {
			callbacks.emit(eventName, data);
		} else {
			callbacks.emit(eventName);
		}
	};

	// hooks
	var callHook = function(action, params) {
		if (!ready) {
			return hookQueue.push(arguments);
		}
		var data = {
			src: 'rocketchat',
			fn: action,
			args: params
		};
		iframe.contentWindow.postMessage(data, '*');
	};

	var closeWidget = function() {
		if (widget.dataset.state === 'closed') {
			return;
		}

		if (smallScreen) {
			document.body.style.cssText = bodyStyle;
			document.body.scrollTop = scrollPosition;
		}

		widget.dataset.state = 'closed';
		widget.style.height = widgetHeightClosed;
		widget.style.right = '50px';
		widget.style.bottom = '0px';
		callHook('widgetClosed');

		emitCallback('chat-minimized');
	};

	var openWidget = function() {
		if (widget.dataset.state === 'opened') {
			return;
		}

		if (smallScreen) {
			scrollPosition = document.body.scrollTop;
			bodyStyle = document.body.style.cssText;
			document.body.style.cssText += 'overflow: hidden; height: 100%; width: 100%; position: fixed; top:' + scrollPosition + 'px;';
		}

		widget.dataset.state = 'opened';
		widget.style.height = widgetHeightOpened;
		callHook('widgetOpened');
		document.querySelector('.rocketchat-widget iframe').focus();

		emitCallback('chat-maximized');
	};

	var api = {
		ready: function() {
			ready = true;
			if (hookQueue.length > 0) {
				hookQueue.forEach(function(hookParams) {
					callHook.apply(this, hookParams);
				});
				hookQueue = [];
			}
		},
		toggleWindow: function(/*forceClose*/) {
			if (widget.dataset.state === 'closed') {
				openWidget();
			} else {
				closeWidget();
			}
		},
		restoreWindow: function() {
			if (widget.dataset.state === 'closed') {
				openWidget();
			}
		},
		startDragWindow: function(offset) {
			if (widget.dataset.state !== 'opened') {
				return;
			}
			this.dragOffset = offset;
		},
		stopDragWindow: function() {
			if (widget.dataset.state !== 'opened') {
				return;
			}
			this.dragOffset = null;
		},
		dragWindow: function(displacement) {
			if (!this.dragOffset) {
				return;
			}

			var right = parseInt(widget.style.right.replace(/px$/, ''), 10);
			var bottom = parseInt(widget.style.bottom.replace(/px$/, ''), 10);
			widget.style.right = (right - (displacement.x - this.dragOffset.x)) + 'px';
			widget.style.bottom = (bottom - (displacement.y - this.dragOffset.y)) + 'px';
		},
		openPopout: function() {
			closeWidget();
			var popup = window.open(config.url + '?mode=popout', 'livechat-popout', 'width=400, height=450, toolbars=no');
			popup.focus();
		},
		openWidget: function() {
			openWidget();
		},
		removeWidget: function() {
			document.getElementsByTagName('body')[0].removeChild(widget);
		},
		callback: function(eventName, data) {
			emitCallback(eventName, data);
		}
	};

	var pageVisited = function(change) {
		callHook('pageVisited', {
			change: change,
			location: JSON.parse(JSON.stringify(document.location)),
			title: document.title
		});
	};

	var setCustomField = function(key, value, overwrite) {
		if (typeof overwrite === 'undefined') {
			overwrite = true;
		}
		callHook('setCustomField', [key, value, overwrite]);
	};

	var setTheme = function(theme) {
		callHook('setTheme', theme);
	};

	var setDepartment = function(department) {
		callHook('setDepartment', department);
	};

	var setGuestToken = function(token) {
		callHook('setGuestToken', token);
	};

	var setGuestName = function(name) {
		callHook('setGuestName', name);
	};

	var setGuestEmail = function(email) {
		callHook('setGuestEmail', email);
	};

	var registerGuest = function(guest) {
		callHook('registerGuest', guest);
	};

	var clearDepartment = function() {
		callHook('clearDepartment');
	};

	var currentPage = {
		href: null,
		title: null
	};
	var trackNavigation = function() {
		setInterval(function() {
			if (document.location.href !== currentPage.href) {
				pageVisited('url');
				currentPage.href = document.location.href;
			}
			if (document.title !== currentPage.title) {
				pageVisited('title');
				currentPage.title = document.title;
			}
		}, 800);
	};

	var init = function(url) {
		if (!url) {
			return;
		}

		config.url = url;

		var chatWidget = document.createElement('div');
		chatWidget.dataset.state = 'closed';
		chatWidget.className = 'rocketchat-widget';
		chatWidget.innerHTML = '<div class="rocketchat-container" style="width:100%;height:100%">' +
			'<iframe id="rocketchat-iframe" src="' + url + '" style="width:100%;height:100%;border:none;background-color:transparent" allowTransparency="true"></iframe> ' +
			'</div><div class="rocketchat-overlay"></div>';

		chatWidget.style.position = 'fixed';
		chatWidget.style.width = widgetWidth;
		chatWidget.style.height = widgetHeightClosed;
		chatWidget.style.borderTopLeftRadius = '5px';
		chatWidget.style.borderTopRightRadius = '5px';
		chatWidget.style.bottom = '0';
		chatWidget.style.right = '50px';
		chatWidget.style.zIndex = '12345';

		document.getElementsByTagName('body')[0].appendChild(chatWidget);

		widget = document.querySelector('.rocketchat-widget');
		iframe = document.getElementById('rocketchat-iframe');

		window.addEventListener('message', function(msg) {
			if (typeof msg.data === 'object' && msg.data.src !== undefined && msg.data.src === 'rocketchat') {
				if (api[msg.data.fn] !== undefined && typeof api[msg.data.fn] === 'function') {
					var args = [].concat(msg.data.args || []);
					api[msg.data.fn].apply(null, args);
				}
			}
		}, false);

		var mediaqueryresponse = function(mql) {
			if (mql.matches) {
				smallScreen = true;
				chatWidget.style.left = '0';
				chatWidget.style.right = '0';
				chatWidget.style.width = '100%';
			} else {
				chatWidget.style.left = 'auto';
				chatWidget.style.right = '50px';
				chatWidget.style.width = widgetWidth;
			}
		};

		var mql = window.matchMedia('screen and (max-device-width: 480px)');
		mediaqueryresponse(mql);
		mql.addListener(mediaqueryresponse);

		// track user navigation
		trackNavigation();
	};

	if (typeof window.initRocket !== 'undefined') {
		console.warn('initRocket is now deprecated. Please update the livechat code.');
		init(window.initRocket[0]);
	}

	if (typeof window.RocketChat.url !== 'undefined') {
		init(window.RocketChat.url);
	}

	var queue = window.RocketChat._;

	window.RocketChat = window.RocketChat._.push = function(c) {
		c.call(window.RocketChat.livechat);
	};

	// exports
	window.RocketChat.livechat = {
		// methods
		pageVisited: pageVisited,
		setCustomField: setCustomField,
		setTheme: setTheme,
		setDepartment: setDepartment,
		clearDepartment: clearDepartment,
		setGuestToken: setGuestToken,
		setGuestName: setGuestName,
		setGuestEmail: setGuestEmail,
		registerGuest: registerGuest,

		// callbacks
		onChatMaximized: function(fn) { registerCallback('chat-maximized', fn); },
		onChatMinimized: function(fn) { registerCallback('chat-minimized', fn); },
		onChatStarted: function(fn) { registerCallback('chat-started', fn); },
		onChatEnded: function(fn) { registerCallback('chat-ended', fn); },
		onPrechatFormSubmit: function(fn) { registerCallback('pre-chat-form-submit', fn); },
		onOfflineFormSubmit: function(fn) { registerCallback('offline-form-submit', fn); }
	};

	// proccess queue
	queue.forEach(function(c) {
		c.call(window.RocketChat.livechat);
	});
})(window);
