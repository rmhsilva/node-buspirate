/**
 * SPI bus example
 */

var BusPirate = require('../');

// Initialise buspirate.  This also does a console reset and enters binmode
var pirate = new BusPirate({
	dev: '/dev/tty.u'
});

// The pirate is an event emitter - it lets the code know when stuff happens
pirate.on('error', function(e) {
	console.log(e);
});

// Connected - port open & binmode ready.
pirate.on('connected', function() {
	// Set up
	pirate.change_mode('spi', {
		speed: 30    // ... and other options
	});
	pirate.config_periph(true,true,true,true);
});

pirate.on('spi ready', play);

function play() {
	// Do stuff with SPI bus here.
	
}