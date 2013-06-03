/**
 * See http://dangerousprototypes.com/2009/10/09/bus-pirate-raw-bitbang-mode/
 */

var SerialPort = require('serialport').SerialPort;

module.exports = BusPirate;

// Default options
var _options = {
	baud: 115200
};
/**
 * BusPirate constructor
 * @param {string} device  Path to device, eg /dev/tty.usbblah
 * @param {array} options  Options to override the defaults above
 */
function BusPirate(device, options) {
	var self = this;
	options = options || {};
	options.baud = options.baud || 115200;

	this.bitbang = false;
	this.mode = '';
	this.waitlist = {};
	this.open = false;

	if (!device) {
		throw new Error('Device must be specified');
	}

	this.port = new SerialPort(device, {
		baudrate: options.baud
		//parser: response_parser(self)
	});

	this.port.on('open', function() {
		console.log('Device open: ' + device);
		self.open = true;

		// Handle new data
		self.port.on('data', function(data) {
			// First search for responses that are waited for
			for (var key in self.waitlist) {
				var len = key.length;

				if (data.length >= len && data.slice(0,len).toString() === key) {
					console.log('Found: '+key);
					delete self.waitlist.key;
					self.waitlist[key](data);
					return;
				}
			}

			// Otherwise, print the data
			console.log('data: '+data);
		});
	});
}

BusPirate.prototype.close = function() {
	this.port.close(function() {
		this.open = false;
	});
};

BusPirate.prototype.reset_console = function(n) {
	var self = this;
	n = n || 11;

	if (n > 1) {
		// Send enter 10 times, synchronously
		this.port.write([0x0d], function() {
			self.reset_console(n-1);
		});
	}
	else this.port.write('#');
};

BusPirate.prototype.enter_bitbang = function() {
	var self = this;
	this.wait_for_resp('BBIO1', function() {
		self.bitbang = true;
	});

	for (var i = 40; i >= 0 && !this.bitbang; i--)
		this.port.write([0x00]);

	return this.bitbang;
};

BusPirate.prototype.switch_mode = function(mode, callback) {
	var modes = {
		'uart': {out: 0x03, resp: 'ART1'}
	};
	var m = modes[mode];

	if ('undefined' != typeof m) {
		this.port.write([m.out]);
		this.send_and_wait(m.resp, callback);
	}
};


BusPirate.prototype.wait_for_resp = function(response, callback) {
	this.waitlist[response] = callback;
};

function buffers_equal(b1, b2) {
	if (b1.length !== b2.length) return false;

	for (var i = 0; i < b1.length; i++) {
		if (b1[i] !== b2[i]) return false;
	}
}


function response_parser(bp) {
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
			bp.bitbang = true;
			pos = 0;
			packet = [];
		}
		else emitter.emit('data', packet.join(''));
	};
}


// function response_parser(bp) {

// 	if ('Function' == typeof bp.waitlist[data]) {
// 		bp.waitlist[data](data);
// 	}

// function(emitter, buffer) {
// 	// buffer: a Buffer instance

// 	// check for special things:
// 	if (buffer.slice(0,5) == new Buffer("BBIO1")) {
// 		emitter.emit('bitbang');
// 	}
// 	else {
// 		emitter.emit('data', buffer);
// 	}
// }