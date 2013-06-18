##node-buspirate

In the works: [Bus pirate](http://dangerousprototypes.com/docs/Bus_Pirate) bindings for [Node.js](http://nodejs.org), letting you control a Bus Pirate from any Node script.

The code is fairly untested, and may break your kit.  However, these modes have been mostly implemented, and partially tested:

* UART (Read/Write/Bridge)
* SPI (Sniff/Write-read)


##Install

The project is currently not in the npm registry due its youth, so you'll have to clone the repository to use it.  Then install dependencies.

	git clone https://github.com/rmhsilva/node-buspirate.git
	cd node-buspirate && npm install


##Usage

Check the [examples](https://github.com/rmhsilva/node-buspirate/tree/master/examples) folder for examples of how it can be used.

Basic idea:
```javascript
#!/usr/bin/env node

var BusPirate = require('./node-buspirate');
var pirate = new BusPirate('/dev/bus_pirate');

pirate.on('connected', function() {
	pirate.uart.start({
		baudrate: 115200,
		stop_bits: 1,
		data_bits: 8  // ... and other options
	});
});

pirate.uart.on('ready', function() {
	pirate.config_periph(true,true,true,true);
	pirate.uart.echo_rx(true);

	setInterval(function() {
		pirate.uart.write('ping UART\r\n');
	}, 3000);
});

pirate.uart.on('data', function(data) {
	process.stdout.write(data);
});	
```

The plan is to add other Bus Pirate modes (I2C...) which will be used similarly.


##How

The BusPirate object is an eventEmitter built on top of a node Serialport.  It gets the hardware into raw bitbang mode, then just sends and receives raw data from the hardware, and lets other modules handle the specifics of each mode.


##todo

* Write modules to handle other BusPirate modes.
* Documentation
* And much more...


Although Javascript is probably not often used for hardware debugging, this project has been an interesting experiment which has proved to be useful.  It was started because I don't like Python and the Ruby bus pirate bindings weren't working.