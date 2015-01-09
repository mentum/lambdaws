var lambdaws = require('../'),
	λ = lambdaws.create;

lambdaws.config({
	accessKey: 'AKIAIHRVTAA4WHVXY3UQ',
	secretKey: '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',
	role: 'arn:aws:iam::010371688755:role/lambdaws', // not necessary if the user has full access
	region: 'us-east-1'
});

// Example 1
// Cloudify inline function

var minus = function(a, b, callback) {
	require('q');
	callback(a - b);
};

var cloudedMinus = λ(minus, ['fs', 'q'], {
	name: 'MINUS'
});

// Example 2
// Cloudify function in module

var cloudedAdd = λ(require.resolve('./calculator'), 'add', ['fs', 'q'], { name: 'ADD' });
var cloudedDivide = λ(require.resolve('./calculator'), 'divide', ['fs', 'q'], { name: 'DIVIDE' });

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
