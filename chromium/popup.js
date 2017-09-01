const doublespeak = new Doublespeak(true);
var encQueue = [];
var textarea = [];

document.onreadystatechange = function () {
	const textareas = [
		'out-prepend',
		'out-append',
		'out-plain',
		'out-cover',
		'out-cipher',
		'in-cipher',
		'in-plain'
	];
	for (var i = 0; i < 7; i++) {
		let name = textareas[i].replace(/-([a-z])/, (m, c) => c.toUpperCase());
		textarea[name] = document.getElementById(textareas[i]);
		if (i < 4 || i == 5)
			textarea[name].addEventListener('focus', function () { this.select(); });
	}

	textarea.outPrepend.addEventListener('change', () => {
		chrome.storage.local.set({ outPrepend: textarea.outPrepend.value });
	});
	textarea.outAppend.addEventListener('change', () => {
		chrome.storage.local.set({ outAppend: textarea.outAppend.value });
	});
	textarea.outPlain.addEventListener('input', function () { mirrorCover(this); });
	textarea.outCover.addEventListener('input', function () { mirrorCover(this); });
	textarea.outCipher.addEventListener('focus', () => {
		document.getElementById('copy-out').click();
	});
	textarea.outCipher.addEventListener('copy', embedData);
	textarea.outCipher.addEventListener('dragstart', embedData);
	textarea.inCipher.addEventListener('paste', extractData);
	textarea.inCipher.addEventListener('drop', extractData);
	textarea.inCipher.addEventListener('input', checkEmpty);
	document.getElementById('files').addEventListener('change', function () { readFiles(this.files); });
	document.getElementById('clear-out-plain').addEventListener('click', clearOutPlain);
	document.getElementById('clear-out').addEventListener('click', clearOut);
	document.getElementById('copy-out').addEventListener('click', copyText);
	document.getElementById('toggle-auto').addEventListener('change', () => { setIsAuto(!window.isAuto); });
	document.getElementById('clear-in').addEventListener('click', clearIn);
	document.getElementById('drop-target').addEventListener('drop', dropFiles);
	document.addEventListener('dragover', dragOverFiles);

	const background = chrome.extension.getBackgroundPage();
	const { outPlain = '', outCover = '', encQueue = [] } = background.encDraft;
	textarea.outPlain.value = outPlain;
	textarea.outCover.value = outCover;
	resizeTextarea(textarea.outPlain);
	mirrorCover(textarea.outCover);
	window.encQueue = encQueue;
	warnEncSize();
	for (var encFile of encQueue)
		displayEncFile(encFile);

	if (/Mac/.test(navigator.userAgent)) {
		textarea.outCipher.placeholder = 'Copy [Command+C] encoded message';
		textarea.inCipher.placeholder = 'Paste [Command+V] to decode message';
	}

	window.addEventListener('unload', () => {
		background.encDraft = {
			outPlain: doublespeak.filterStr(textarea.outPlain.value),
			outCover: doublespeak.filterStr(textarea.outCover.value),
			encQueue: window.encQueue
		};
	});

	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		window.port = chrome.tabs.connect(tabs[0].id);
		window.port.onMessage.addListener(dataObjs => {
			clearInPlain();
			for (var obj of dataObjs)
				switch (obj.dataType) {
					case 0x1:
						outputDecText(obj.data, obj.crcMatch);
						break;
					case 0x2:
						outputDecFile(obj.data, obj.crcMatch);
				}
		});
		chrome.storage.local.get(null, items => {
			textarea.outPrepend.value = items.outPrepend || '';
			textarea.outAppend.value = items.outAppend || '';
			setIsAuto(items.isAuto || items.isAuto === undefined);
		});
	});
};

// Mirror cover text to ciphertext box, pretending to embed data
// Embed does not actually occur until copy event
// Visual cues are still important for intuitive UX
function mirrorCover(el) {
	resizeTextarea(el);
	if (el === textarea.outCover) {
		textarea.outCipher.value = textarea.outCover.value;
		resizeTextarea(textarea.outCipher);
	}
	flashBorder(textarea.outCipher, 'encoded', 200);
}

// Select and copy text to clipboard
function copyText() {
	textarea.outCipher.select();
	document.execCommand('copy');
}

// Embed output ciphertext in cover text
function embedData(e) {
	const plainStr = (v => v ? v + ' ' : '')(textarea.outPrepend.value) +
		textarea.outPlain.value + (v => v ? ' ' + v : '')(textarea.outAppend.value);
	const encodedStr = doublespeak.encodeText(plainStr) + encQueue.reduce((str, obj) => str + obj.str, '');
	const coverStr = doublespeak.filterStr(textarea.outCover.value);
	// Select random position in cover text to insert ciphertext
	const insertPos = Math.floor(Math.random() * (coverStr.length - 1) + 1);
	const embeddedStr = coverStr.slice(0, insertPos) + encodedStr + coverStr.slice(insertPos);

	// Hijack copy/drag event to embed ciphertext
	if (e.type == 'copy') {
		e.preventDefault();
		e.clipboardData.setData('text/plain', embeddedStr);
	} else
		e.dataTransfer.setData('text/plain', embeddedStr);

	flashBorder(textarea.outCipher, 'copied', 800);
}

// Extract input ciphertext
function extractData(e) {
	e.preventDefault();
	// Hijack paste/drop event to extract clipboard contents
	const str = e.type == 'paste' ?
		e.clipboardData.getData('text/plain') :
		e.dataTransfer.getData('text/plain');

	// Filter out ciphertext before "pasting" to avert
	// reflow performance cost with large messages
	const { cover, dataObjs } = doublespeak.decodeData(str);
	clearInPlain();
	textarea.inCipher.value = cover || '\uFEFF';
	resizeTextarea(textarea.inCipher);

	for (var obj of dataObjs)
		switch (obj.dataType) {
			case 0x1:
				outputDecText(doublespeak.extractText(obj.data), obj.crcMatch);
				break;
			case 0x2:
				outputDecFile(doublespeak.extractFile(obj.data), obj.crcMatch);
				break;
			default:
				outputError(getTextDiv(), obj.error, obj.details);
		}
}

function outputDecText(str, crcMatch) {
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};
	const textDiv = getTextDiv();
	textDiv.onfocus = function () { selectText(this); };
	textDiv.innerHTML = autolinker.link(str.replace(/[&<>]/g, c => references[c]));

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

function outputDecFile(data, crcMatch) {
	const { type, name, url, size } = data;

	// Generate file details UI
	const textDiv = getTextDiv();
	textDiv.classList.add('file');
	textDiv.textContent = name;
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + (size / 1024).toFixed(2) + ' KB';
	textDiv.appendChild(info);
	const link = document.createElement('a');
	link.className = 'file-download';
	link.href = url;
	link.download = name;
	link.tabIndex = -1;
	textDiv.appendChild(link);

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

const autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter',
	replaceFn: match => match.buildTag().setAttr('tabindex', -1)
});

function getTextDiv() {
	let textDiv;
	if (textarea.inPlain.lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.tabIndex = -1;
		textarea.inPlain.appendChild(textDiv);
	}
	return textDiv || textarea.inPlain.lastChild;
}

function dragOverFiles(e) {
	e.stopPropagation();
	e.dataTransfer.dropEffect = 'copy';

	if ((a => a[a.length - 1])(e.dataTransfer.types) == 'Files') {
		e.preventDefault();
		const dropTarget = document.getElementById('drop-target');
		dropTarget.style.display = 'block';
		dropTarget.addEventListener('dragleave', dragLeaveFiles);
	}
}

function dragLeaveFiles() {
	const dropTarget = document.getElementById('drop-target');
	dropTarget.removeEventListener('dragleave', dragLeaveFiles);
	dropTarget.style.display = 'none';
}

function dropFiles(e) {
	e.stopPropagation();
	e.preventDefault();
	dragLeaveFiles();

	readFiles(e.dataTransfer.files);
}

function readFiles(files) {
	for (var file of files)
		(file => {
			const reader = new FileReader();
			reader.onload = () => {
				enqueueEncFile(file.type, file.name, new Uint8Array(reader.result));
			};
			reader.readAsArrayBuffer(file);
		})(file);
}

// Convert file header and byte array to encoding characters and push to output file queue
function enqueueEncFile(type, name, bytes) {
	encQueue.push({
		type,
		name,
		size: bytes.length,
		str: doublespeak.encodeFile(type, name, bytes)
	});
	warnEncSize();
	displayEncFile({ type, name, size: bytes.length });
}

// Generate output file details UI
function displayEncFile({ type, name, size }) {
	const textDiv = document.createElement('div');
	textDiv.className = 'text-div file';
	textDiv.textContent = name;
	const remove = document.createElement('button');
	remove.className = 'file-remove';
	remove.onclick = function () { removeEncFile(this); };
	remove.tabIndex = -1;
	remove.innerHTML = '&times;';
	textDiv.appendChild(remove);
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + (size / 1024).toFixed(2) + ' KB';
	textDiv.appendChild(info);
	textarea.outPlain.parentElement.appendChild(textDiv);
}

// Remove file from output file queue
function removeEncFile(el) {
	const textDiv = el.parentElement;
	const parent = textDiv.parentElement;
	const index = Array.prototype.indexOf.call(parent.children, textDiv) - 4;
	encQueue.splice(index, 1);
	warnEncSize();
	parent.removeChild(textDiv);
}

function warnEncSize() {
	let queueSize = encQueue.reduce((size, obj) => size + obj.str.length * 3, 0);
	let warnSize = document.getElementById('warn-size');
	// Warn if output file queue is over 4 MB
	if (queueSize > 0x400000) {
		document.getElementById('warn-size-kb').textContent = (queueSize / 1024).toFixed(2);
		warnSize.style.display = 'block';
	} else
		warnSize.style.display = 'none';
}

function outputError(el, msg) {
	el.classList.add('error');
	const errorDiv = document.createElement('div');
	errorDiv.className = 'notify error-div';
	errorDiv.textContent = msg.toUpperCase();
	el.parentElement.appendChild(errorDiv);
}

function flashBorder(el, style, ms) {
	el.classList.add(style);
	setTimeout(() => {
		el.classList.remove(style);
	}, ms);
}

function checkEmpty() {
	if (textarea.inCipher.value == '')
		clearIn();
}

function selectText(el) {
	const range = document.createRange();
	const selection = window.getSelection();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function setIsAuto(isAuto) {
	window.isAuto = isAuto;
	chrome.storage.local.set({ isAuto });
	// Update background script
	chrome.runtime.sendMessage(isAuto);
	// Update active tab
	window.port.postMessage(isAuto);
	document.getElementById('toggle-auto').checked = isAuto;
	textarea.inCipher.parentElement.style.display = isAuto ? 'none' : 'block';
	if (isAuto)
		textarea.inCipher.value = '';
	else {
		resizeTextarea(textarea.inCipher);
		clearInPlain();
	}
}

function clearOutPlain() {
	encQueue = [];
	warnEncSize();
	const outPlainParent = textarea.outPlain.parentElement;
	while (outPlainParent.childNodes.length > 4)
		outPlainParent.removeChild(outPlainParent.lastChild);
	textarea.outPlain.value = '';
	resizeTextarea(textarea.outPlain);
	textarea.outPlain.focus();
}

function clearOut() {
	textarea.outCover.value = '';
	textarea.outCipher.value = '';
	resizeTextarea(textarea.outCover);
	resizeTextarea(textarea.outCipher);
	textarea.outCover.focus();
}

function clearIn() {
	clearInPlain();
	textarea.inCipher.value = '';
	resizeTextarea(textarea.inCipher);
	textarea.inCipher.focus();
}

function clearInPlain() {
	const inPlain = textarea.inPlain;
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	inPlain.firstChild.onfocus = null;
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}

// Scale textarea according to font size
function resizeTextarea(el) {
	const fontSize = 16;
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.24, fontSize * 12) + 'px';
}
