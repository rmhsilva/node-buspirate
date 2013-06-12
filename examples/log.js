/**
 * Just some random tests of the logger thing
 */


var colors = require('colors');


function format(item) {
	if (typeof item === 'number') {
		return '0x'+item.toString(16);
	}
	else if (typeof item === 'object') {
		return item.map(format);
	}
	else return item;
}

/*
 * Debug logger - log(type, message, ...)
 */
function log() {
	var argv = [].slice.call(arguments);
	console.log(argv.shift().green + ' ' + argv.map(format).join(', '));
}


log('test', 0x03);
log('test', 0xA4);
log('test', 'something else');
log('test', [0x00, 0x23, 0xF3], 'bla');