const doublespeak = new Doublespeak();
var output;
var observeTime = 0;

// Parse DOM string on first load
extractData(document.documentElement.outerHTML);

// Parse DOM string on DOM change
new MutationObserver(() => {
	// Throttle observation
	if (Date.now() - observeTime < 1000) return;
	observeTime = Date.now();
	extractData(document.documentElement.outerHTML);
}).observe(document, {
	childList: true,
	attributes: true,
	characterData: true,
	subtree: true
});

// Listen for connections from popup
chrome.runtime.onConnect.addListener(port => {
	window.port = port;
	port.onMessage.addListener(() => { port.postMessage(output); });
	port.onDisconnect.addListener(() => { window.port = null; });
});

// Extract ciphertext from DOM string.
function extractData(domContent) {
	output = [];
	const dataObjs = doublespeak.decodeData(domContent).dataObjs;
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
