var LambdaError = function() {};

var objectifyError = function(err) {
    return Object.getOwnPropertyNames(err).reduce(function(a, c) {
        a[c] = err[c];
        return a;
    }, new LambdaError());
};

module.exports.LambdaError = LambdaError;
module.exports.objectifyError = objectifyError;
