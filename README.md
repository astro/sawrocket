# Saw Rocket

[Raw Socket API](http://www.w3.org/TR/raw-sockets/#methods-1) SHIM for
Chrome Packaged Apps and Mozilla Open Web Apps (Firefox OS).

## Current limitations

* TCP client sockets only
* Binary data only
* …

## Usage

Copy `sawrocket.js` to your project and start using `TCPSocket`.

If you need to convert to strings, copy `utf8.js` and use
`UTF8ArrToStr` and `strToUTF8Arr`. They've been stolen from the
Mozilla Developer Docs.

## Manifests?

A sample **netcat** demo app is included. Use:

* `manifest.json` for Chrome
* `manifest.webapp` for Firefox OS
