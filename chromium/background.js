var encDraft = {};
var isAuto;
chrome.storage.local.get('isAuto', items => {
	isAuto = items.isAuto || true;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (typeof msg == 'number')
		// Set badge text for specified tab
		chrome.browserAction.setBadgeText({ text: msg ? msg.toString() : '', tabId: sender.tab.id });
	else if (typeof msg == 'boolean')
		isAuto = msg;
	else
		sendResponse(isAuto);
});
