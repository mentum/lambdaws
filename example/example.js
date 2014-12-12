var lambdaws = require('../'),
	λ = lambdaws.create;

lambdaws.config({
	accessKey: 'AKIAINF2FWKX3LDRTR6Q',
	secretKey: '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',
	role: 'arn:aws:iam::246175073899:role/lambda_exec_sqs',
	region: 'us-east-1'
});

var calculator = function(a, b, callback) {
	callback(a + b);
};

var cloudedCalculator = λ(calculator, {
	name: 'CALCULATOR'
});

lambdaws.start(function(data){
	console.log('quee started');
});

var stdin = process.openStdin();

stdin.on('data', function(chunk) {
	
	cloudedCalculator(2, 6, function(data) {
		console.log("<--", data)
	});

});

setTimeout(function() {}, 1000 * 1000); // Keep Alive
