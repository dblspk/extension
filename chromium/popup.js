const doublespeak = new Doublespeak();
var encQueue = [];
var textarea = [];

document.onreadystatechange = function () {
	const textareas = [
		'out-prepend',
		'out-append',
		'out-plain',
		'out-cover',
		'out-cipher',
		'in-plain'
	];
	for (var i = 0; i < 6; i++) {
		let name = textareas[i].replace(/-([a-z])/, (m, c) => c.toUpperCase());
		textarea[name] = document.getElementById(textareas[i]);
		if (i < 5)
			textarea[name].addEventListener('focus', function () { this.select(); });
	}

	textarea.outPlain.addEventListener('input', function () { mirrorCover(this); });
	textarea.outCover.addEventListener('input', function () { mirrorCover(this); });
	textarea.outCipher.addEventListener('focus', () => {
		document.getElementById('copy-out').click();
	});
	textarea.outCipher.addEventListener('copy', embedData);
	textarea.outCipher.addEventListener('dragstart', embedData);
	textarea.inPlain.firstChild.addEventListener('focus', function () { selectText(this); });
	document.getElementById('files').addEventListener('change', function () { readFiles(this.files); });
	document.getElementById('clear-out-plain').addEventListener('click', clearOutPlain);
	document.getElementById('clear-out').addEventListener('click', clearOut);
	document.getElementById('copy-out').addEventListener('click', copyText);
	document.getElementById('drop-target').addEventListener('drop', dropFiles);
	document.addEventListener('dragover', dragOverFiles);

	if (/Mac/.test(navigator.userAgent))
		textarea.outCipher.placeholder = 'Copy [Command+C] encoded message';

	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		const port = chrome.tabs.connect(tabs[0].id);
		port.postMessage('');
		port.onMessage.addListener(dataObjs => {
			clearInPlain();
			for (var obj of dataObjs)
				switch (obj.dataType) {
					case 0x1:
						outputText(obj.data, obj.crcMatch);
						break;
					case 0x2:
						outputFile(obj.data, obj.crcMatch);
				}
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
	const encodedStr = doublespeak.encodeText(plainStr).concat(...encQueue);
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

function outputText(str, crcMatch) {
	const textDiv = getTextDiv();
	const references = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;'
	};

	textDiv.innerHTML = autolinker.link(str);

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
	link.tabIndex = -1;
	link.textContent = 'Download';
	textDiv.appendChild(link);

	if (!crcMatch)
		outputError(textDiv, 'CRC mismatch');
}

const autolinker = new Autolinker({
	stripPrefix: false,
	stripTrailingSlash: false,
	hashtag: 'twitter',
	replaceFn: function (match) {
		return match.buildTag().setAttr('tabindex', -1);
	}
});

function getTextDiv() {
	let textDiv;
	if (textarea.inPlain.lastChild.innerHTML) {
		// Generate pseudo-textarea
		textDiv = document.createElement('div');
		textDiv.className = 'text-div';
		textDiv.onfocus = function () { selectText(this); };
		textDiv.tabIndex = -1;
		textarea.inPlain.appendChild(textDiv);
	}
	return textDiv || textarea.inPlain.lastChild;
}

function dragOverFiles(e) {
	e.stopPropagation();
	e.dataTransfer.dropEffect = 'copy';

	if ((a => a[a.length - 1])(e.dataTransfer.types) === 'Files') {
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
	for (var i = 0; i < files.length; i++)
		(file => {
			const reader = new FileReader();
			reader.onload = () => {
				enqueueFile(file.type, file.name, new Uint8Array(reader.result));
			};
			reader.readAsArrayBuffer(file);
		})(files[i]);
}

// Convert file header and byte array to encoding characters and push to output queue
function enqueueFile(type, name, bytes) {
	encQueue.push(doublespeak.encodeFile(type, name, bytes));

	// Generate file details UI
	const textDiv = document.createElement('div');
	textDiv.className = 'text-div';
	textDiv.textContent = name;
	const remove = document.createElement('button');
	remove.className = 'file-remove';
	remove.onclick = function () { removeFile(this); };
	remove.tabIndex = -1;
	remove.innerHTML = '&times;';
	textDiv.appendChild(remove);
	const info = document.createElement('p');
	info.className = 'file-info';
	info.textContent = (type || 'unknown') + ', ' + bytes.length + ' bytes';
	textDiv.appendChild(info);
	textarea.outPlain.parentElement.appendChild(textDiv);
}

// Remove file in output ciphertext embed queue
function removeFile(el) {
	const textDiv = el.parentElement;
	const parent = textDiv.parentElement;
	const index = Array.prototype.indexOf.call(parent.children, textDiv) - 1;
	encQueue.splice(index, 1);
	parent.removeChild(textDiv);
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

function selectText(el) {
	const range = document.createRange();
	const selection = window.getSelection();
	range.selectNodeContents(el);
	selection.removeAllRanges();
	selection.addRange(range);
}

function clearOutPlain() {
	encQueue = [];
	const outPlainParent = textarea.outPlain.parentElement;
	while (outPlainParent.childNodes.length > 1)
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

function clearInPlain() {
	const inPlain = textarea.inPlain;
	inPlain.firstChild.innerHTML = '';
	inPlain.firstChild.className = 'text-div';
	while (inPlain.childNodes.length > 1)
		inPlain.removeChild(inPlain.lastChild);
}

// Scale textarea according to font size
function resizeTextarea(el) {
	const fontSize = 16;
	el.style.height = '';
	el.style.height = Math.min(el.scrollHeight + fontSize * 0.24, fontSize * 12) + 'px';
}
