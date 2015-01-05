var fs = require('fs');
var q = require('q');

exports.add = function(a, b, callback) {
	callback(a + b);
};

exports.divide = function(a, b, callback) {
	fs.existsSync('./test.txt');
	var d = q.defer();

	if(b === 0) {
		throw 'Cant divide by zero';
	}
	
	callback(a/b);
};
