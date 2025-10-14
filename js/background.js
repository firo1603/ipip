const state = {
	tabsIPMap: {},
	tabsDomainMap: {},
	ipData: {},
	dnsData: {},
	domainList: []
};

const lang = (navigator && navigator.language) ? navigator.language : 'en';
const isZh = lang.toLowerCase().indexOf('zh') > -1;
const defaultTitle = isZh
	? '网站IP数据信息 Powered by IPIP.net'
	: 'WebSite IP Information query Powered by IPIP.net';
const invalidSelectionMessage = isZh ? '只支持IP查询' : 'Only IP lookups are supported';

const ignoreLastError = () => {
	const lastError = chrome.runtime.lastError;
	if (lastError) {
		console.debug(lastError.message);
	}
};

const persistState = () => {
	try {
		const result = chrome.storage.session.set({ state });
		if (result && typeof result.then === 'function') {
			result.catch(ignoreLastError);
		} else {
			chrome.storage.session.set({ state }, ignoreLastError);
		}
	} catch (error) {
		console.error('Failed to persist session state', error);
	}
};

chrome.storage.session.get('state', (stored) => {
	if (stored && stored.state) {
		try {
			Object.assign(state, stored.state);
		} catch (error) {
			console.error('Failed to restore session state', error);
		}
	}
});

const renderIcon = (tabId, info) => {
	if (typeof tabId !== 'number' || tabId < 0 || !info) {
		return;
	}

	if (info.country && info.country.length > 0) {
		let title = info.country;
		if (info.country_code === 'HK' || info.country_code === 'MO' || info.country_code === 'TW') {
			title = `${info.country} ${info.province || ''}`.trim();
		}
		const localizedTitle = isZh
			? `当前网站的IP地址为：${title}\nIP数据信息 Powered by IPIP.net`
			: `The current site IP GeoLocation: ${title}\nIP Info Powered by IPIP.net`;
		chrome.action.setTitle({ tabId, title: localizedTitle }, ignoreLastError);
	}

	const countryCode = info.country_code || '';
	const iconPath = countryCode.length === 2 ? `icons/${countryCode}.png` : 'Q.png';
	chrome.action.setIcon({ tabId, path: iconPath }, ignoreLastError);
	chrome.action.enable(tabId, ignoreLastError);
};

const resetActionForTab = (tabId) => {
	if (typeof tabId !== 'number' || tabId < 0) {
		return;
	}
	chrome.action.disable(tabId, ignoreLastError);
	chrome.action.setIcon({ tabId, path: 'images/icon_gray_38.png' }, ignoreLastError);
	chrome.action.setTitle({ tabId, title: defaultTitle }, ignoreLastError);
};

const fetchIpInfo = (tabId, ip, domain) => {
	const query = new URLSearchParams({ ip, l: lang, domain });
	return fetch(`https://clientapi.ipip.net/browser/chrome?${query.toString()}`)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			return response.json();
		})
		.then((info) => {
			if (info && info.ret === 0 && info.data) {
				state.ipData[ip] = info.data;
				state.dnsData[ip] = info.dns || [];
				persistState();
				renderIcon(tabId, info.data);
			}
		})
		.catch((error) => {
			console.error('Failed to fetch IP info', error);
		});
};

chrome.webRequest.onCompleted.addListener((details) => {
	if (!details || typeof details.tabId !== 'number' || details.tabId < 0 || !details.ip) {
		return;
	}

	const domainMatch = details.url && details.url.match(/:\/\/(.*?)\//);
	if (!domainMatch || !domainMatch[1]) {
		return;
	}

	const domain = domainMatch[1];
	state.tabsDomainMap[details.tabId] = domain;
	state.tabsIPMap[details.tabId] = details.ip;
	persistState();

	fetchIpInfo(details.tabId, details.ip, domain);
}, {
	urls: ['<all_urls>'],
	types: ['main_frame']
});

chrome.tabs.onCreated.addListener((tab) => {
	if (tab && typeof tab.id === 'number') {
		resetActionForTab(tab.id);
	}
});

chrome.tabs.onRemoved.addListener((tabId) => {
	let changed = false;
	const ip = state.tabsIPMap[tabId];
	if (ip) {
		delete state.tabsIPMap[tabId];
		changed = true;
		const stillUsed = Object.values(state.tabsIPMap).some((existingIp) => existingIp === ip);
		if (!stillUsed) {
			delete state.dnsData[ip];
			delete state.ipData[ip];
		}
	}
	if (state.tabsDomainMap[tabId]) {
		delete state.tabsDomainMap[tabId];
		changed = true;
	}
	if (changed) {
		persistState();
	}
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
	if (typeof tabId !== 'number') {
		return;
	}

	const ip = state.tabsIPMap[tabId];
	if (ip && state.ipData[ip]) {
		renderIcon(tabId, state.ipData[ip]);
	} else {
		resetActionForTab(tabId);
	}
});

chrome.action.onClicked.addListener(() => {
	chrome.action.setPopup({ popup: 'popup.html' }, ignoreLastError);
});

const IP_REGEXP = /^([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/;
const IP6_REGEXP = /^[\w:\.]+$/;

const showAlertInTab = (tabId, message) => {
	chrome.scripting.executeScript({
		target: { tabId },
		func: (text) => {
			window.alert(text);
		},
		args: [message]
	}).catch(() => {
		console.warn('Unable to display alert in tab', tabId);
	});
};

const handleSelection = (info, tab) => {
	if (!info || !tab || typeof tab.id !== 'number') {
		return;
	}

	const text = info.selectionText || '';
	if (!IP_REGEXP.test(text) && IP6_REGEXP.test(text)) {
		showAlertInTab(tab.id, invalidSelectionMessage);
		return;
	}

	chrome.tabs.create({
		url: `https://www.ipip.net/ip/${text}.html`,
		active: false
	}, ignoreLastError);
};

chrome.runtime.onInstalled.addListener(() => {
	const contextTitle = isZh ? '使用IPIP.NET搜索 "%s"' : 'Search "%s" To IPIP.net';
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({
			id: 'ipip',
			contexts: ['selection'],
			title: contextTitle
		}, ignoreLastError);
	});
	chrome.action.setPopup({ popup: 'popup.html' }, ignoreLastError);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === 'ipip') {
		handleSelection(info, tab);
	}
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (!request || !request.type) {
		sendResponse?.({ success: false });
		return true;
	}

	switch (request.type) {
		case 'updateDomains': {
			const domains = request.domains || {};
			state.domainList = Object.keys(domains).map((domain) => ({ domain, amount: domains[domain] }));
			persistState();
			sendResponse({ success: true });
			return true;
		}
		case 'getState': {
			const tabId = request.tabId;
			const ip = typeof tabId === 'number' ? state.tabsIPMap[tabId] || '' : '';
			const domain = typeof tabId === 'number' ? state.tabsDomainMap[tabId] || '' : '';
			sendResponse({
				ip,
				domain,
				ipInfo: ip ? state.ipData[ip] || null : null,
				dnsInfo: ip ? state.dnsData[ip] || [] : [],
				domainList: state.domainList
			});
			return true;
		}
		case 'reloadTab': {
			if (typeof request.tabId === 'number') {
				chrome.tabs.reload(request.tabId, {}, ignoreLastError);
				sendResponse({ success: true });
			} else {
				sendResponse({ success: false });
			}
			return true;
		}
		default:
			sendResponse({ success: false });
			return true;
	}
});
