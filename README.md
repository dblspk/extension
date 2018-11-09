[![Gitter chat](https://badges.gitter.im/dblspk.png)](https://gitter.im/dblspk/dev)

# Doublespeak browser extensions

Hides/reveals secret messages in text. Optimized for instant messaging.

Messages are encoded as zero-width Unicode characters, as a casual form of [steganography](https://en.wikipedia.org/wiki/Steganography).

Chrome extension: __[Chrome Web Store](https://chrome.google.com/webstore/detail/doublespeak/mochgllkkbafaoombocojfenmkbijhdb)__

Web app: __https://dblspk.io/__

![screenshot](https://lh3.googleusercontent.com/QyUaIAfS6luoccbj5xVFfTHZCE8KnHW21eWUtoai2yzHtfsDxelCSoANXiDB_uK_IRniVMMv=w640-h400-e365)

## Usage

###### Extension

__Tab__ / __Shift+Tab__ &mdash; cycle through fields

Encoded message is automatically copied by tabbing to or clicking on the field.

Drag and drop files onto popup to encode.

When auto mode is enabled, this extension automatically parses the HTML in your current tab for secret messages. __This feature requires the permission "Read and change all your data on the websites you visit".__ If you do not trust this extension, you can manually decode using the web app.

## Features

* Automatically parse web pages for secret messages (optional)
* File transmission
* [CRC-32](https://en.wikipedia.org/wiki/Cyclic_redundancy_check) error checking
* Multi-message decoding
* Linkifies URLs, emails, phone numbers, and Twitter hashtags

## Possible uses

What can be hidden:

* Text
* URLs (similar use to [QR codes](https://en.wikipedia.org/wiki/QR_code))
* Watermarks
* Small files

Possible places for storage:

* Chat messages
* Social media posts
* User profile information
* Forums
* HT⁢⁢‌‌︀⁬⁣︀⁣‍⁮⁡‌‍⁠⁡⁢﻿⁤⁤⁠‌⁤⁡⁤﻿⁪⁣⁪⁠⁪⁡⁤⁣⁠⁯⁠‌⁤⁬⁪⁢⁠⁪⁪⁡⁠‌⁤⁬⁤︁⁠‌⁪⁢⁤⁫⁤⁣⁠‌⁪⁪⁤﻿⁪⁠⁤⁢⁠‌⁠⁠⁢⁫⁣⁢⁢︀⁢⁯⁠⁠⁠︁ML
* Emails
* Digital documents
* File names (very short messages only)

__[Technical mumbo jumbo](https://github.com/dblspk/web-app#how-it-works)__

## License

[MIT License](https://joshuaptfan.mit-license.org/)
