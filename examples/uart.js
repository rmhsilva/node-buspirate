/**
 * Simple example of echoing Uart
 */

var BusPirate = require('../');

// Initialise buspirate.  This also does a console reset and enters binmode
var pirate = new BusPirate('/dev/tty.usbserial-A9014MJZ');


// The pirate is an event emitter - it lets the code know when stuff happens
pirate.on('error', function(e) {
	console.log('BP error: ', e);
});

// Connected - port open & binmode ready.
pirate.on('connected', function() {
	// Set up
	pirate.uart.start({
		baudrate: 115200,
		stop_bits: 1,
		data_bits: 8,
		data_par: 0     // ... and other options
	});
});


pirate.uart.on('ready', function() {
	// Do other things with uart here...
	pirate.config_periph(true,true,true,true);
	pirate.uart.echo_rx(true);

	setInterval(function() {
		pirate.uart.write('ping\r\n');
	}, 3000);
});


pirate.uart.on('data', function(data) {
	// Do things with data received
	//console.log('UART> '+data);
	process.stdout.write(data);
});

module.exports = pirate;