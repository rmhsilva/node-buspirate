/**
 * SPI bus example
 */

var BusPirate = require('../');

// Initialise buspirate.  This also does a console reset and enters binmode
var pirate = new BusPirate('/dev/tty.usbserial-A9014MJZ', 115200, true);

// The pirate is an event emitter - it lets the code know when stuff happens
// pirate.on('error', function(e) {
// 	console.log(e);
// });

pirate.on('connected', function() {
	// Start SPI
	pirate.spi.start({
		speed: 250
	});
});

pirate.spi.on('ready', function() {
	// Write and read some data
	// pirate.spi.read(3, function(b) {
	// 	console.log('Read: ', b);
	// });

	pirate.spi.write_read('ABCDEFGHIJKLMNOPABCDEF', function(err, data) {
		console.log('Received: ', data);
	});

	// pirate.spi.sniff('low');
});


// Handle sniffer data
pirate.spi.on('sniff', function(data) {
	console.log(data.mosi.map(function(x) {
		return String.fromCharCode(x);
	}), data.miso);
});

module.exports = pirate;