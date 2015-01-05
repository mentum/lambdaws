var fs = require('fs');
var q = require('q');

exports.add = function(a, b, callback) {
	callback(a + b);
};

exports.divide = function(a, b, callback) {
	// These random calls are just meant to show that we can call external libraries
	fs.existsSync('./test.txt');
	var d = q.defer();

	if(b === 0) throw 'Cant divide by zero';

	callback(a/b);
};
