if (navigator.mozTCPSocket) {

function TCPSocket(host, port, options) {
    if (!options)
	options = {};
    options.binaryType = options.binaryType || 'arraybuffer';

    this.sock = navigator.mozTCPSocket.open(host, port, options);
    ['open', 'drain', 'close'].forEach(function(type) {
	this.sock['on' + type] = function(ev) {
	    var cb = this['on' + type];
	    if (cb)
		cb.call(this, ev);
	}.bind(this);
    }.bind(this));
    this.sock.ondata = function(ev) {
	var cb = this.onmessage;
	if (cb)
	    cb(ev);
    }.bind(this);
}

['send', 'resume', 'suspend', 'close'].forEach(function(method) {
    TCPSocket.prototype[method] = function() {
	return this.sock[method].apply(this.sock, arguments);
    };
});

['remoteAddress', 'remotePort', 'localAddress', 'localPort',
 'readyState', 'bufferedAmount'].forEach(function (key) {
    Object.defineProperty(TCPSocket.prototype, key, {
        get:function() {
            return this.sock[key];
        }
    });
});

} else {

function TCPSocket(host, port, options) {
    chrome.socket.create(this._type, {}, function(createInfo) {
	if (createInfo.socketId)
	    this._connect(createInfo.socketId, host, port);
	else
	    this.emit('error', new Error("Cannot create TCP socket"));
    }.bind(this));
    this.readyState = 'connecting';
}
TCPSocket.prototype._type = 'tcp';

TCPSocket.prototype._connect = function (socketId, host, port) {
    chrome.socket.connect(socketId, host, port, function(result) {
        if (result < 0) {
            this.emit('error', new Error(this._type + " connect: " + result));
        } else {
            this.readyState = 'open';
            this.socketId = socketId;
            this.bufferedAmount = 0;
            chrome.socket.getInfo(this.socketId, function (info) {
                this.remoteAddress = info.peerAddress;
                this.remotePort = info.peerPort;
                this.localAddress = info.localAddress;
                this.localPort = info.localPort;
            }.bind(this));
            this.emit('open', {});
            if (!this.suspended)
            this.resume();
        }
    }.bind(this));
};

TCPSocket.prototype.emit =  function(type, event) {
    var cb = this['on' + type];
    if (cb) {
	try {
	    cb.call(this, event);
	} catch(e) {
	    console.error(this._type, type, e.stack || e.message || e, event);
	}
    }
};

TCPSocket.prototype.send = function(data) {
    if (this.readyState !== 'open')
        throw new Error(this._type + " socket not open");

    var len = data.byteLength;
    chrome.socket.write(this.socketId, data, function() {
        this.bufferedAmount -= len;
        if (this.bufferedAmount < 1)
            this.emit('drain', {});
    }.bind(this));
    var buffered = this.bufferedAmount > 0;
    this.bufferedAmount += len;
    return !buffered;
};

TCPSocket.prototype.resume = function() {
    this.suspended = false;
    if (this.nextMessage) {
        var message = this.nextMessage;
        this.nextMessage = null;
        this.emit('message', message);
    }

    if (this.reading)
	return;

    this.reading = true;
    this._read();
};

TCPSocket.prototype._read = function() {
    chrome.socket.read(this.socketId, function(readInfo) {
	if (readInfo.resultCode < 0) {
	    this.emit('error', new Error(this._type + " read: " + readInfo.resultCode));
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



function UDPSocket(options) {
    options = options || {};
    chrome.socket.create(this._type, {}, function(createInfo) {
        this.socketId = createInfo.socketId;
        if (!createInfo.socketId) {
            this.emit('error', new Error("Cannot create UDP socket"));
        } else {
            if (options.localAddress || options.localPort) {
                this._bind(createInfo.socketId,
                    options.localAddress || '0.0.0.0',
                    options.localPort    || Math.floor(Math.random()*64511+1024));
            }
            if (options.remoteAddress && options.remotePort) {
                this._connect(createInfo.socketId,
                    options.remoteAddress,
                    options.remotePort);
            }
        }
    }.bind(this));
    this.readyState = 'open';

}
UDPSocket.prototype = Object.create(TCPSocket.prototype, {
    constructor: {
        value: UDPSocket,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

UDPSocket.prototype._type = 'udp';

UDPSocket.prototype._bind = function (socketId, host, port) {
    chrome.socket.bind(socketId, host, port, function(result) {
        if (result < 0) {
            this.emit('error', new Error("Bind: " + result));
        } else {
            chrome.socket.getInfo(socketId, function (info) {
                this.remoteAddress = info.peerAddress;
                this.remotePort = info.peerPort;
                this.localAddress = info.localAddress;
                this.localPort = info.localPort;
            }.bind(this));
            this.emit('bind', {});
            if (!this.suspended)
            this.resume();
        }
    }.bind(this));
};

UDPSocket.prototype._read = function() {
    chrome.socket.recvFrom(this.socketId, function(recvInfo) {
        if (recvInfo.resultCode < 0) {
            this.emit('error', new Error(this._type + " read: " + recvInfo.resultCode));
            this.close();
        } else {
            this.reading = false;
            this.nextMessage = {
                address: recvInfo.address,
                port: recvInfo.port,
                data: recvInfo.data
            };
            if (!this.suspended)
            this.resume();
        }
    }.bind(this));
};

UDPSocket.prototype.joinMulticastGroup = function(address) {
    if (this.readyState !== 'open')
        throw new Error(this._type + " socket not open");
    chrome.socket.joinGroup(this.socketId, address, function (result) {
        if (result < 0) {
            this.emit('error', new Error("joinGroup: " + result));
            this.close();
        }
    }.bind(this));
};

UDPSocket.prototype.leaveMulticastGroup = function(address) {
    if (this.readyState !== 'open')
        throw new Error(this._type + " socket not open");
    chrome.socket.leaveGroup(this.socketId, address, function (result) {
        if (result < 0) {
            this.emit('error', new Error("leaveGroup: " + result));
            this.close();
        }
    }.bind(this));
};

UDPSocket.prototype.send = function(data, address, port, callback) {
    if (!address) { // FIXME is this right? or should we use sendTo all the time?
        return TCPSocket.prototype.send.call(this, data);
    }
    if (this.readyState !== 'open')
        throw new Error(this._type + " socket not open");

    var len = data.byteLength;
    chrome.socket.sendTo(this.socketId, data, address, port, function() {
        this.bufferedAmount -= len;
        if (this.bufferedAmount < 1)
            this.emit('drain', {});
    }.bind(this));
    var buffered = this.bufferedAmount > 0;
    this.bufferedAmount += len;
    return !buffered;
};

UDPSocket.prototype.close = function() {
    if (this.readyState !== 'closed')
        this.emit('close', {});
    if (this.socketId) {
        chrome.socket.disconnect(this.socketId);
        chrome.socket.destroy(this.socketId);
    }
    this.socketId = undefined;
    this.readyState = 'closed';
};

Object.defineProperty(UDPSocket.prototype, 'loopback', {
    get:function() {
        return !!this._loopback;
    },
    set:function(value) {
        this._loopback = !!value;
        if (!this.socketId) return;
        chrome.socket.setMulticastLoopbackMode(this.socketId, this._loopback, function (result) {
            if (result < 0) {
                this.emit('error', new Error("setMulticastLoopbackMode: " + result));
                this.close();
            }
        }.bind(this));
    }
});

Object.defineProperty(UDPSocket.prototype, 'ttl', {
    get:function() {
        return this._ttl;
    },
    set:function(value) {
        this._ttl = value;
        if (!this.socketId) return;
        chrome.socket.setMulticastTimeToLive(this.socketId, this._ttl, function (result) {
            if (result < 0) {
                this.emit('error', new Error("setMulticastTimeToLive: " + result));
                this.close();
            }
        }.bind(this));
    }
});

}

if (module && module.exports) {
    module.exports.TCPSocket = TCPSocket;
    module.exports.UDPSocket = UDPSocket;
}
