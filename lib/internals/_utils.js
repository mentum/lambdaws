var LambdaError = function() {};

var objectifyError = function(err) {
    return Object.getOwnPropertyNames(err).reduce(function(a, c) {
        a[c] = err[c];
        return a;
    }, new LambdaError());
};

module.exports.LambdaError = LambdaError;
module.exports.objectifyError = objectifyError;
module.exports.log = function() {
	var args = Array.prototype.slice.call(arguments);
	args.splice(0,0, "<<LAMBDAWS>>");
	console.log.apply(this, args);
};
