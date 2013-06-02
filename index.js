/**
 * See http://dangerousprototypes.com/2009/10/09/bus-pirate-raw-bitbang-mode/
 */

var SerialPort = require('serialport').SerialPort;

module.exports = BusPirate;

// Default options
var _options = {
	baud: 115200
};
function BusPirate(device, options) {
	var self = this;
	options = options || {};
	options.baud = options.baud || 115200;

	if (!device) {
		throw new Error('Device must be specified');
	}

	this.port = new SerialPort(device, {
		baudrate: options.baud,
		buffersize: 1,
		parser: response_parser()
	});

	this.bitbang = false;
	this.mode = '';
	this.waiting = false;
	this.waitack = '';
	this.open = false;

	this.port.on('open', function() {
		console.log('Device open: ' + device);
		self.open = true;
	});

	// Custom events:
	this.port.on('changemode', function(mode) {
		// BP mode changed
		self.mode = mode;
	});
	this.port.on('bitbang', function() {
		// Bitbang mode started
		self.bitbang = true;
	});
	this.port.on('data', function(data) {
		// Generic data
		//console.log(data);
	});
}

BusPirate.prototype.close = function() {
	this.port.close(function() {
		this.open = false;
	});
};

BusPirate.prototype.reset_console = function() {
	for (var i = 10; i >= 0; i--) {
		this.port.write(new Buffer([0x0d]));		// send enter
	}
	this.port.write('#');
};

BusPirate.prototype.enter_bitbang = function() {
	for (var i = 40; i >= 0 && !this.bitbang; i--) {
		this.port.write(new Buffer([0]));
	}

	return this.bitbang;
};

BusPirate.prototype.switch_mode = function(mode, callback) {
	switch(mode) {
		case 'uart': wait_for_acc(this, 0x03, 'ART1');
		break;
	}
};


function wait_for_acc(bp, send, ack) {
	bp.port.write(new Buffer([send]));

	bp.waiting = true;
	bp.waitack = ack;
}

function response_parser() {
	// Handle received data
	var packet = [];
	var pos = 0;

	var modes = {
		'SPI1': 'spi',
		'ART1': 'uart'
	};

	return function(emitter, bytev) {
		console.log(bytev.toString('utf8'));
		packet.push(bytev.toString('utf8')[0]);
		pos += 1;

		if (pos==4 && 'undefined' != typeof modes[packet.slice(0,4).join('')]) {
			emitter.emit('changemode', modes[slice4]);
			pos = 0;
			packet = [];
		}
		else if (pos==5 && 'BBIO1' == packet.slice(0,5).join('')) {
			emitter.emit('bitbang');
			pos = 0;
			packet = [];
		}
		else emitter.emit('data', packet.join(''));
	};
}

