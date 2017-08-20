var doublespeak = new Doublespeak();

// Send DOM string on first load
extractData(document.documentElement.outerHTML);

// Send DOM string on DOM change
// new MutationObserver(() => {
// 	extractData(document.documentElement.outerHTML);
// }).observe(document, {
// 	childList: true,
// 	attributes: true,
// 	characterData: true,
// 	subtree: true
// });

/**
 * Extract ciphertext from DOM string.
 * @param {String} domContent
 */
function extractData(domContent) {
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};

	clearInPlain();
	const dataObjs = doublespeak.decodeData(domContent);
	for (var obj of dataObjs)
		switch (obj.dataType) {
			case 0x1:
				outputText(doublespeak.extractText(obj.data).replace(/[&<>]/g, c => references[c]), obj.crcMatch);
				break;
			case 0x2:
				outputFile(doublespeak.extractFile(obj.data), obj.crcMatch);
		}
}

function outputText(str, crcMatch) {
	const textDiv = getTextDiv();

	textDiv.innerHTML = str;

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

function outputFile(data, crcMatch) {
	const { type, name, url, size } = data;

	// Generate file details UI
	const textDiv = getTextDiv();
	textDiv.textContent = name;
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + size + ' bytes';
	textDiv.appendChild(info);
	const link = document.createElement('a');
	link.className = 'file-download';
	link.href = url;
	link.download = name;
	link.textContent = 'Download';
	textDiv.appendChild(link);

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

function getTextDiv() {
	if (typeof inPlain == 'undefined') initShadowDOM();
	let textDiv;
	if (!inPlain.lastChild || inPlain.lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		// textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		inPlain.appendChild(textDiv);
	}
	return textDiv || inPlain.lastChild;
}

function initShadowDOM() {
	const div = document.createElement('div');
	window.shadowRoot = div.attachShadow({ mode: 'closed' });
	const css = document.createElement('link');
	css.rel = 'stylesheet';
	css.href = chrome.runtime.getURL('content.css');
	shadowRoot.appendChild(css);

	window.container = document.createElement('div');
	container.addEventListener('mousedown', function (e) {
		window.yPos = e.clientY - container.offsetTop;
		window.xPos = e.clientX - container.offsetLeft;
		document.addEventListener('mousemove', dragMove);
		document.addEventListener('mouseup', function dragEnd() {
			document.removeEventListener('mouseup', dragEnd);
			document.removeEventListener('mousemove', dragMove);
		});
	});

	window.inPlain = document.createElement('div');
	container.appendChild(inPlain);
	shadowRoot.appendChild(container);
	document.body.appendChild(div);
}

function dragMove(e) {
	const isInTopHalf = container.offsetTop * 2 + container.offsetHeight < window.innerHeight;
	const isInLeftHalf = container.offsetLeft * 2 + container.offsetWidth < window.innerWidth;
	if (isInTopHalf) {
		container.style.top = e.clientY - yPos + 'px';
		container.style.bottom = 'auto';
	} else {
		container.style.top = 'auto';
		container.style.bottom = window.innerHeight - (e.clientY - yPos) - container.offsetHeight + 'px';
	}
	if (isInLeftHalf) {
		container.style.left = e.clientX - xPos + 'px';
		container.style.right = 'auto';
	} else {
		container.style.left = 'auto';
		container.style.right = window.innerWidth - (e.clientX - xPos) - container.offsetWidth + 'px';
	}
}

function outputError(el, msg) {
	el.classList.add('error');
	const errorDiv = document.createElement('div');
	errorDiv.className = 'notify error-div';
	errorDiv.textContent = msg.toUpperCase();
	el.parentElement.appendChild(errorDiv);
}

function selectText(el) {
	const range = document.createRange();
	const selection = window.getSelection();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function clearInPlain() {
	if (typeof inPlain == 'undefined') return;
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}
