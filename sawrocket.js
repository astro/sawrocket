function TCPSocket(host, port, options) {
    chrome.socket.create('tcp', {}, function(createInfo) {
	if (createInfo.socketId)
	    chrome.socket.connect(createInfo.socketId, host, port, function(result) {
		if (result === 0) {
		    this.readyState = 'open';
		    this.socketId = createInfo.socketId;
		    this.bufferedAmount = 0;
		    this.emit('open', {});
		    if (!this.suspended)
			this.resume();
		} else
		    this.emit('error', new Error("Connect: " + result));
	    }.bind(this));
	else
	    this.emit('error', new Error("Cannot create TCP socket"));
    }.bind(this));
    this.readyState = 'connecting';
}

TCPSocket.prototype.emit =  function(type, event) {
    var cb = this['on' + type];
    if (cb) {
	try {
	    cb(event);
	} catch(e) {
	    console.error(e.stack || e.message || e);
	}
    }
};

TCPSocket.prototype.send = function(data) {
    if (this.readyState !== 'open')
	throw new Error("TCP socket not open");

    var len = data.byteLength;
    console.log("write", data);
    chrome.socket.write(this.socketId, data, function() {
	this.bufferedAmount -= len;
	if (this.bufferedAmount < 1)
	    this.emit('drain', {});
    });
    var buffered = this.bufferedAmount > 0;
    this.bufferedAmount += len;
    return !buffered;
};

TCPSocket.prototype.resume = function() {
    this.suspended = false;
    if (this.nextMessage) {
	this.emit('message', this.nextMessage);
	this.nextMessage = null;
    }

    if (this.reading)
	return;

    this.reading = true;
    chrome.socket.read(this.socketId, function(readInfo) {
	if (readInfo.resultCode < 0) {
	    this.emit('error', new Error("read: " + readInfo.resultCode));
	    this.close();
	} else {
	    this.reading = false;
	    this.nextMessage = {
		data: readInfo.data
	    };
	    if (!this.suspended)
		this.resume();
	}
    }.bind(this));
};

TCPSocket.prototype.suspend = function() {
    this.suspended = true;
};

TCPSocket.prototype.close = function() {
    if (this.readyState !== 'open')
	return;

    this.emit('close', {});
    chrome.socket.disconnect(this.socketId);
    chrome.socket.destroy(this.socketId);
    this.readyState = 'closed';
};