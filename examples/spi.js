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

// TODO