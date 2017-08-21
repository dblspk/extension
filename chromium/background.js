// Set badge text for specified tab
chrome.runtime.onMessage.addListener((num, sender) => {
	chrome.browserAction.setBadgeText({ text: num ? num.toString() : '', tabId: sender.tab.id });
});
