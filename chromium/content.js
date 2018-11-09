const doublespeak = new Doublespeak();
var output;
var isAuto;
var hasChanged = false;

// Check auto/manual mode on load
chrome.runtime.sendMessage('', isAuto => {
	window.isAuto = isAuto;
	if (isAuto)
		extractData(document.documentElement.outerHTML);

	// Parse DOM on change
	new MutationObserver(() => {
		// Rate limit extraction
		if (hasChanged) return;
		hasChanged = true;
		if (document.hidden || !window.isAuto) return;
		setTimeout(() => {
			extractData(document.documentElement.outerHTML);
		}, 1000);
	}).observe(document, {
		childList: true,
		attributes: true,
		characterData: true,
		subtree: true
	});
});

// Listen for connections from popup
chrome.runtime.onConnect.addListener(port => {
	window.port = port;
	port.onMessage.addListener(isAuto => {
		window.isAuto = isAuto;
		chrome.runtime.sendMessage(isAuto && output ? output.length : 0);
		if (isAuto) {
			if (hasChanged || !output)
				extractData(document.documentElement.outerHTML);
			else
				port.postMessage(output);
		}
	});
	port.onDisconnect.addListener(() => { window.port = null; });
});

// Update badge and parse DOM if changed on tab activation
document.addEventListener('visibilitychange', () => {
	if (document.hidden) return;
	chrome.runtime.sendMessage('', isAuto => {
		window.isAuto = isAuto;
		chrome.runtime.sendMessage(isAuto && output ? output.length : 0);
		if (isAuto && (hasChanged || !output))
			extractData(document.documentElement.outerHTML);
	});
});

// Extract ciphertext from DOM string
function extractData(domContent) {
	hasChanged = false;
	output = [];
	let dataObjs = doublespeak.decodeData(domContent).dataObjs;

	// Deduplicate payloads
	let crc = {};
	dataObjs = dataObjs.filter(obj => crc.hasOwnProperty(obj.crc) ? false : crc[obj.crc] = true);

	for (var obj of dataObjs)
		switch (obj.dataType) {
			case 0x1:
				output.push({
					dataType: 1,
					data: doublespeak.extractText(obj.data),
					crcMatch: obj.crcMatch
				});
				break;
			case 0x2:
				output.push({
					dataType: 2,
					data: doublespeak.extractFile(obj.data),
					crcMatch: obj.crcMatch
				});
		}

	chrome.runtime.sendMessage(output.length);
	if (window.port)
		window.port.postMessage(output);
}
