var Q = require('q');

// Dependencies
var lambda = null;

var _uploadZipInternal = function(functionName, zipData, handler, config) {
    var deferred = Q.defer();

    var params = {
        FunctionName: functionName,
        FunctionZip: zipData,
        Handler: handler,
        Mode: global.constants.LAMBDA_MODE,
        Role: settings.role,
        Runtime: global.constants.LAMBDA_RUNTIME,
        Description: config.description,
        MemorySize: config.memory,
        Timeout: config.timeout
    };

    // TODO Check if the function is already on Lambda and overwrite it
    lambda.uploadFunction(params, function (err, data) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise.timeout(settings.uploadTimeout, "Function upload to AWS Lambda timed out.");
};

var _upload = function(zipContent, config, functionIdentifier) {
    var name = config.name || global.constants.MODULE_DEFAULT_HANDLER,
        handlerName     = global.constants.MODULE_DEFAULT_HANDLER,
        functionName    = name + '-' + functionIdentifier,
        handler         = 'index.' + handlerName;

    return _uploadZipInternal(functionName, zipContent, handler, config);
};

/* DI */
module.exports = function(awsLambda) {
    lambda = awsLambda;
    return _upload;
};
