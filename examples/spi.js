/**
 * SPI bus example
 */

var BusPirate = require('../');

// Initialise buspirate.  This also does a console reset and enters binmode
var pirate = module.exports = new BusPirate('/dev/tty.usbserial-A9014MJZ');

// The pirate is an event emitter - it lets the code know when stuff happens
pirate.on('error', function(e) {
	console.log(e);
});

pirate.on('connected', function() {
	// Start SPI
	pirate.spi.start({
		speed: 250
	});
});

pirate.spi.on('ready', function() {
	pirate.spi.sniff('low');
});


// Handle SPI data....
pirate.spi.on('data', function(data) {
	console.log(data.mosi.map(function(x) {
		return String.fromCharCode(x);
	}), data.miso);
});