var encDraft = {};

chrome.runtime.onMessage.addListener((num, sender) => {
	// Set badge text for specified tab
	chrome.browserAction.setBadgeText({ text: num ? num.toString() : '', tabId: sender.tab.id });
});
