
var lambdaws = require('../'),
	λ = lambdaws.create;

lambdaws.config({
	accessKey: 'YOUR_ACCESS_KEY',
	secretKey: 'YOUR_SECRET',
	role: 'LAMBDAWS_ARN_WITH_FULL_ACCESS_TO_SQS', // not necessary if the user has full access
	region: 'us-east-1'
});

// Example 1
// Cloudify inline function

var minus = function(a, b, callback) {
	callback(a - b);
};

var cloudedMinus = λ(minus, {
	name: 'MINUS'
});

// Example 2
// Cloudify function in module

var cloudedAdd = λ('./calculator', 'add', ['fs', 'q'], { name: 'ADD' });
var cloudedDivide = λ('./calculator', 'divide', ['fs', 'q'], { name: 'DIVIDE' });

lambdaws.start();

var stdin = process.openStdin();

stdin.on('data', function(chunk) {
	
	cloudedMinus(2, 8, function(data) {
		console.log("Inline (2-8) = ", data)
	});

	cloudedAdd(2, 8, function(data) {
		console.log("Module (2+8) = ", data)
	});

	cloudedDivide(12, 2, function(data) {
		console.log("Module (12/2) = ", data)
	});

});

setTimeout(function() {}, 1000 * 1000); // Keep Alive
