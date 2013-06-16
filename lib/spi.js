/**
 * SPI bus mode for BusPirate
 */

var util       = require('util'),
	asyncblock = require('asyncblock'),
	events     = require('events');

module.exports = Spi;

/**
 * Spi - gives a buspirate SPIbus mode capabilities
 */
function Spi(buspirate) {
	events.EventEmitter.call(this);
	var self = this;

	this.bp = buspirate;
	this.started = false;
	this.sniffer = false;
	this.reading = false;
	this.settings = {};

	// Special constants NEEDED to change mode
	this.constants = {
		MODE_ID: 0x01,
		MODE_NAME: 'spi',
		MODE_ACK: 'SPI1'
	};

	this.bp.on('receive', function(data) {
		// Handle incoming data if in Spi mode
		if (self.sniffer || self.reading) {
			self.emit('data', data);
		}
	});

	this.bp.on('mode', function(m) {
		if (m != self.constants.MODE_NAME)
			self.started = false;
	});
}

// Event emitter!
util.inherits(Spi, events.EventEmitter);


/**
 * Call .start() to change the buspirate mode 
 * It changes mode and then sets the options
 * @param  {array} options options to pass on to setopts
 */
Spi.prototype.start = function(options) {
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
 * A set of of defaults for SPI
 */
_defaults = {
	speed: 30,			// Spi speed (kHz)
	pin_output: 1,		// 0=HiZ, 1=3.3V
	idle_phase: 0,		// clock idle phase (1 or 0)
	clk_edge: 1,		// CKE clk edge (1 = active to idle)
	sample_time: 0		// 0: middle
};

/**
 * Setopts sets up the BusPirate as required, emitting 'ready' when done
 * @param  {array} options To override the defaults above
 */
Spi.prototype.setopts = function(options) {
	var self = this;
	var opts = _defaults;
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

	var speeds = {
		30:   0x60,
		125:  0x61,
		250:  0x62,
		1000: 0x63,
		2000: 0x64,
		2600: 0x65,
		4000: 0x66,
		8000: 0x67
	};
	var speedcmd = speeds[opts.speed] || speeds[_defaults.speed],
		w = 8 * opts.pin_output,
		x = 4 * opts.idle_phase,
		y = 2 * opts.clk_edge,
		z = 1 * opts.sample_time,
		err = false;

	// Write everything (synchronously)
	asyncblock(function(flow) {
		self.bp.sync_write(flow, speedcmd);
		err = self.bp.sync_wait(flow, 0x01);

		self.bp.sync_write(flow, 0x80 + w+x+y+z);
		err = self.bp.sync_wait(flow, 0x01) || err;

		if (err) {
			self.bp.emit('error', err);
		} else {
			self.bp.log('spi', 'Started, speed: '+opts.speed);
			self.emit('ready');
		}
	});
};


/*****[ SPI operations routines ]******************************************/

/**
 * Set SPI bus sniffing capabilities. TODO: test and fix logic holes! :)
 * @param  {bool|string}   how  what CS state to sniff on. false=>disable
 */
Spi.prototype.sniff = function(how, callback) {
	var self = this;

	// If it's already started, interperet this as a restart request
	if (this.sniffer) {
		this.bp.write('r');
		return;
	}
	else {
		// If how == false, 0xFF is sent, causing the BP to exit sniffer
		// Otherwise, get the correct code.
		var sniff = (how)? (how=='high')? 0x0F :
							(how=='low')? 0x0E :
							0x0D : 0xFF;

		this.bp.write(sniff);
		this.bp.wait_for_data(0x01, function(err) {
			if (!err) {
				this.sniffer = how;
				self.bp.log('spi', 'Sniffer status: '+how);
				self.sniffer = how;
				self.emit('sniffer', how);
				if (callback) callback(err);
			}
		});
	}
};


/**
 * Enable / disable CS (true=>1, false=>0)
 * @param  {Bool}   on       Desired state of CS
 * @param  {Function} callback To be called when done
 */
Spi.prototype.set_cs = function(on, callback) {
	var code = (on)? 0x03 : 0x02,
		self = this;

	this.bp.write(code);
	this.bp.wait_for_data(0x01, callback);
};


Spi.prototype.cs_block = function(fn) {
	// body...
};