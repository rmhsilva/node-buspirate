/**
 * See http://dangerousprototypes.com/2009/10/09/bus-pirate-raw-bitbang-mode/
 */

var SerialPort = require('serialport').SerialPort,
	asyncblock = require('asyncblock'),
	util       = require('util'),
	events     = require('events');

module.exports = BusPirate;

/**
 * BusPirate constructor
 * @param {string} device  Path to device, eg /dev/tty.usbblah
 * @param {number} baud  Baud rate to use. Default 115200
 */
function BusPirate(device, baud) {
	this.log('Initialising BusPirate at '+device);
	baud = baud || 115200;

	var self = this;
	this.waitlist = {};
	this.status = {
		open: false,
		mode: '',
		bitbang: ''
	};

	if (!device) {
		throw new Error('Device must be specified');
	}

	this.port = new SerialPort(device, {
		baudrate: baud
		//parser: response_parser(self)
	});

	this.port.on('open', function() {
		console.log('Device open: ' + device);
		self.status.open = true;

		// Handle new data
		self.port.on('data', function(data) {
			// First search for responses that are waited for
			for (var key in self.waitlist) {
				var len = key.length,
					cb = waitlist[key];

				if (data.length >= len && data.slice(0,len).toString() === key) {
					//console.log('Found: '+key);
					delete self.waitlist.key;
					cb();
					return;
				}
			}

			// Otherwise, print the data
			console.log('data: '+data);
		});
	});
}

// BusPirate is an event emitter!
util.inherits(Board, events.EventEmitter);


BusPirate.prototype.close = function() {
	// TODO: exit bitbang + reset
	this.port.close(function() {
		this.status.open = false;
	});
};

/**
 * Waits for a string to be sent by the BP
 * @param  {string}   response The desired response string
 * @param  {int}   timeout  Number of ms to wait before timing out
 * @param  {Function} callback Function to call when the string is received
 * @return {null}
 */
BusPirate.prototype.wait_for_resp = function(response, timeout, callback) {
	var self = this;

	asyncblock(function(flow) {
		flow.on('taskTimeout', function() {
			delete self.waitlist[response];
			callback(new Error('Timeout waiting for: '+response));
		});

		// Add a timeout if specified
		if ('undefined' != typeof callback)
			self.waitlist[response] = flow.add({timeout: timeout});
		else
			self.waitlist[response] = flow.add();

		flow.wait();
		callback(null);
	});
};

BusPirate.prototype.write_and_wait = function(out, resp, timeout, callback) {
	if (out instanceof Array)
		this.port.write(out);
	else
		this.port.write([out]);

	// If timeout isn't given, only 3 args are given, timeout => callback
	if ('undefined' === typeof callback)
		this.wait_for_resp(resp, timeout);
	else
		this.wait_for_resp(resp, timeout, callback);
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

BusPirate.prototype.enter_bitbang = function(callback) {
	var self = this;
	this.wait_for_resp('BBIO1', function() {
		self.bitbang = true;
		this.status.mode = 'bitbang';
		callback();
	});
	this.port.write([0x00]);

	for (var i = 30; i >= 0 && !this.bitbang; i--)
		this.port.write([0x00]);
};

BusPirate.prototype.switch_mode = function(mode, callback) {
	var self = this;
	var modes = {
		'bitbang': {out: 0x00, resp: 'BBIO1'},
		'uart': {out: 0x03, resp: 'ART1'},
		'spi': {out: 0x01, resp: 'SPI1'}
	};
	var m = modes[mode];

	// TODO: make sure in binmode

	if ('undefined' != typeof m) {
		this.port.write([m.out]);
		this.wait_for_resp(m.resp, function() {
			self.status.mode = mode;
			if ('Function' == typeof callback)
				callback();
		});
	}
	else return new Error('Mode does not exist: '+mode);
};



/*****[ UART utils ]********************************************/
// See http://dangerousprototypes.com/2009/10/19/bus-pirate-binary-uart-mode/
// for better explanation of options

_uart_defaults = {
	baudrate: 115200,	// UART baud rate
	pin_output: 1,		// 0=HiZ, 1=3.3V
	data_par: 0,		// 0=8/N, 1=8/E, 2=8/O, 3=9/N
	stop_bits: 0,		// 0=1bit, 1=2bits
	idle_polarity: 0,	// RX polarity idle
	power: 0,			// enable power supply pins
	pullups: 0,
	aux: 0,
	cs: 0
};
function uart_setup(buspirate, options, callback) {
	// Function to set up a buspirate in UART mode, with options given
	var opts = _uart_defaults;
	for (var opt in options) {
		opts[opt] = options[opt];
	}

	var bauds = {
		9600: 0x64,
		115200: 0x6A
	};
	var baud = bauds[opts.baudrate] || 0x00;

	// Set baudrate
	// Set perifs
	// Set options	
	asyncblock(function(flow) {
		flow.sync(buspirate.write_and_wait, baud, 0x01);
	});
}

BusPirate.prototype.uart_set_baud = function(baud, callback) {
	// set uart baud
	var self = this;
	var reg_val = Math.round(((16000000/baud)/4)-1);
	var high = (reg_val & 0xFF00) >> 8,
		low  = reg_val & 0x00FF;

	flow.on('taskTimeout', function() {
		callback(new Error('Timeout while setting baud rate'));
	});

	// Send the bytes
	asyncblock(function(flow) {
		self.port.write([0x07]);
		self.wait_for_resp(0x01, flow.add({timeout: 50}));
		flow.wait();
		self.port.write([high]);
		self.wait_for_resp(0x01, flow.add({timeout: 50}));
		flow.wait();
		self.port.write([low]);
		self.wait_for_resp(0x01, flow.add({timeout: 50}));
		flow.wait();
		callback(null);
	});
};

BusPirate.prototype.uart_echo_rx = function(on, callback) {
	var code = (on)? 0x02 : 0x03;

	this.port.write([code]);
	this.wait_for_resp(0x01, callback);
};

BusPirate.prototype.uart_bridge = function(callback) {
	this.port.write([0x0F]);
	this.status.bitbang = false;
	this.status.mode = 'uart_bridge';
};





// function response_parser(bp) {
// 	// Handle received data
// 	var packet = [];
// 	var pos = 0;

// 	var modes = {
// 		'SPI1': 'spi',
// 		'ART1': 'uart'
// 	};

// 	return function(emitter, bytev) {
// 		console.log(bytev.toString('utf8'));
// 		packet.push(bytev.toString('utf8')[0]);
// 		pos += 1;

// 		if (pos==4 && 'undefined' != typeof modes[packet.slice(0,4).join('')]) {
// 			emitter.emit('changemode', modes[slice4]);
// 			pos = 0;
// 			packet = [];
// 		}
// 		else if (pos==5 && 'BBIO1' == packet.slice(0,5).join('')) {
// 			bp.bitbang = true;
// 			pos = 0;
// 			packet = [];
// 		}
// 		else emitter.emit('data', packet.join(''));
// 	};
// }


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