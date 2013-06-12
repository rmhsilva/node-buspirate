var asyncblock = require('asyncblock');


function waiter(flow, ms) {
	console.log('Starting block');
	setTimeout(flow.add(), ms);
	flow.wait();
	console.log('Done with block');
}


function run() {
	asyncblock(function(flow) {
		console.log(new Date());
		waiter(flow, 1000);
		console.log(new Date());
	});
}

run();