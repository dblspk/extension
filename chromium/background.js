// Listen for messages from content script
chrome.runtime.onMessage.addListener((num, sender) => {
	chrome.browserAction.setBadgeText({ text: num ? num.toString() : '', tabId: sender.tab.id });
});
