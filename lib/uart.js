/**
 * The UART mode for BusPirate
 * http://dangerousprototypes.com/2009/10/19/bus-pirate-binary-uart-mode/
 */

var util       = require('util'),
	asyncblock = require('asyncblock'),
	events     = require('events');

module.exports = Uart;


/**
 * Uart - gives a buspirate uart mode capabilities
 */
function Uart(buspirate) {
	events.EventEmitter.call(this);
	var self = this;

	this.bp = buspirate;
	this.started = false;
	this.echo_rx_on = false;
	this.settings = {};

	// Special constants NEEDED to change mode
	this.constants = {
		MODE_ID: 0x03,
		MODE_NAME: 'uart',
		MODE_ACK: 'ART1'
	};

	this.bp.on('receive', function(data) {
		// Handle incoming data if in UART mode
		if (self.started) {
			self.emit('data', data);
		}
	});

	this.bp.on('mode', function(m) {
		if (m != self.constants.MODE_NAME)
			self.started = false;
	});
}

// Event emitter!
util.inherits(Uart, events.EventEmitter);


/**
 * Call .start() to change the buspirate mode and begin Uart
 * It changes mode and then sets the UART options
 * @param  {array} options options to pass on to setopts
 */
Uart.prototype.start = function(options) {
	var self = this;
	this.bp.switch_mode(this.constants, function(err, mode) {
		if (err) {
			self.bp.log('error', err);
			return;
		}
		else if (mode == self.constants.MODE_NAME) {
			self.started = true;
			self.setopts(options);
		}
	});
};


/**
 * A set of of defaults for UART mode
 */
_defaults = {
	baudrate: 9600,		// UART baud rate
	pin_output: 1,		// 0=HiZ, 1=3.3V
	data_bits: 8,		// 8 or 9
	parity_bit: 'N',	// 'N' or 'E' or 'O'
	stop_bits: 1,		// 1 or 2
	idle_polarity: 1	// 1=idle1, 0=idle0
};

/**
 * Setopts sets up the BusPirate as required, emitting 'ready' when done
 * @param  {array} options To override the defaults above
 */
Uart.prototype.setopts = function(options) {
	var self = this;
	var opts = _defaults;
	var data_par = 0;
	options = options || {};

	// Must be started first
	if (!this.started) {
		this.start(options);
		return;
	}

	// Parse options
	for (var opt in options) {
		opts[opt] = options[opt];
	}
	this.settings = opts;

	if (options.data_bits) {
		data_par += (options.data_bits == 9)? 1 : 0;
	}
	if (options.parity_bit) {
		data_par += (options.parity_bit == 'E')? 1 :
					(options.parity_bit == 'O')? 2 : 0;
	}

	// Baudrate codes (buspirate protocol ART1)
	var bauds = {
		300:    0x60,
		1200:   0x61,
		2400:   0x62,
		4800:   0x63,
		9600:   0x64,
		19200:  0x65,
		31250:  0x66,
		38400:  0x67,
		57600:  0x68,
		115200: 0x69	// The DP page is wrong!
	};
	var baudcmd = bauds[opts.baudrate] || bauds[_defaults.baudrate],
		w  = 16 * opts.pin_output,
		xx = 4 * data_par,
		y  = 2 * (1 - opts.stop_bits),
		z  = (1 - opts.idle_polarity),
		err = false;


	asyncblock(function(flow) {
		// Write the baudrate and settings commands
		self.bp.sync_write(flow, baudcmd);
		err = self.bp.sync_wait(flow, 0x01);

		self.bp.sync_write(flow, 0x80 + w+xx+y+z);
		err = self.bp.sync_wait(flow, 0x01) || err;

		if (err) {
			self.bp.emit('error', err);
		} else {
			self.emit('ready');
			self.bp.log('uart', 'Started, baud: '+opts.baudrate);
		}
	});
};


/*****[ Uart operations routines ]******************************************/

/**
 * Set RX echoing.  Disabled by default so that rec codes aren't corrupted
 * @param  {bool}   on       Whether to enable it or not
 * @param  {Function} callback Optional callback.  If null, an event is emitted
 */
Uart.prototype.echo_rx = function(on, callback) {
	var code = (on)? 0x02 : 0x03,
		self = this;

	this.bp.write(code);
	this.bp.wait_for_data(0x01, function(err) {
		if (!err) {
			self.bp.log('uart', 'RX echo is now: '+on);
			self.echo_rx_on = on;
			self.emit('rx_echo', on);
			if (callback) callback(err);
		}
	});
};


/**
 * Start uart bridge mode.  The only way to exit is to unplug the buspirate
 */
Uart.prototype.uart_bridge = function(callback) {
	this.bp.write(0x0F);

	this.bp.log('info', 'Uart bridge started - disconnect BP to reset');
	this.bp.mode = 'uart_bridge';
	this.emit('uart_bridge');
	if (callback) callback();
};


/**
 * Write a block of 1-16 bytes to the Uart connection
 */
Uart.prototype.write = function(buffer) {
	var self = this,
		test = [],
		lenbyte = 0x10 + buffer.length - 1;

	if (buffer.length > 16) {
		return new Error('Cannot send more than 16 bytes at once');
	}
	if (!this.started) {
		return new Error('Uart must be started before writing');
	}

	// Build an array to wait for.  Basically a bunch of 0x01s
	for (var i = buffer.length - 1; i >= 0; i--)
		test.push(0x01);

	asyncblock(function(flow) {
		self.bp.sync_write(flow, lenbyte);
		self.bp.sync_wait(flow, 0x01);

		self.bp.write(buffer);
		self.bp.sync_wait(flow, test);
	});
};

// TODO: Make uart a Stream