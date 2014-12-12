"use strict";
global.settings = {
    accessKey: '',
    secretKey: '',
    region: 'us-west-2',
    sqsQueueName: 'LambdaResultsQueue',
    uploadTimeout: 5000
};

var extend = require('extend'),
    aws = require('aws-sdk'),
    md5 = require('MD5'),
    Q = require('q'),
    zip = require('node-zip'),
    uuid = require('uuid'),
    CreateLambdaStrFunction = require('./LambdaFunction'),
    SQSHelper = require('./SQSHelper');

var versions = {
    sqs: "2014-11-11",
    lambda: "2014-11-11"
};

var defaultFunctionSettings = {
    memory: 128, // mb
    description: '',
    timeout: 3  // seconds
};

aws.config.apiVersions = versions;

var lambda;

var _sqsHelper = null;

var proxyStore = {};
var executionStore = {};

var _uploadFunctionAsync = function (lambdaFunc, config, functionHash) {
    var deferred = Q.defer();

    var handlerName = config.name || 'default';
    var functionAsString = 'exports.' + handlerName + '=' + lambdaFunc + ';';
    var zipFile = zip();
    zipFile.file(handlerName + '.js', functionAsString, {binary: false});
    var zipData = new Buffer(zipFile.generate({
        base64: true,
        compression: 'DEFLATE'
    }), 'base64');

    var params = {
        FunctionName: handlerName.concat('-', functionHash), // TODO Find a better way to name functions?
        FunctionZip: zipData,
        Handler: handlerName + "." + handlerName,
        Mode: 'event', // Even though we invoke manually
        // TODO The Amazon Resource Name (ARN) of the IAM role that Lambda assumes when it executes your function to access any other Amazon Web Services (AWS) resources.
        Role: settings.role,
        Runtime: 'nodejs',
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

var _getFunctionHash = function (func) {
    return md5(func.toString());
    // TODO : add config in hash
};

var _createProxy = function (promise) {
    function proxy() {
        var args = Array.prototype.slice.call(arguments);
        if (typeof(args[args.length - 1]) !== 'function') {
            throw "Expected last argument to be a callback";
        }

        var callb = args.pop();
        var requestId = uuid.v4();

        Q.all([_sqsHelper.initializedDeferred.promise, promise]).spread(function (queueUrl, uploadData) {
            var params = {
                FunctionName: uploadData.FunctionName,
                InvokeArgs: JSON.stringify({
                    args: args,
                    sqsQueueUrl: queueUrl,
                    requestId: requestId
                })
            };

            lambda.invokeAsync(params, function (err, data) {
                if (err) console.log(err, err.stack); // TODO Handle Error gracefully
                else {
                    executionStore[requestId] = callb;
                }
            });
        });

        promise.catch(function () {
            throw "Could not upload function to S3";
        });
    }

    return proxy;
};

// Public API
var exports = module.exports = {};

exports.config = function (params) {
    extend(settings, params);

    aws.config.update({
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
        region: settings.region
    });

    lambda = new aws.Lambda();
};

exports.start = function (startedCallback) {
    // TODO : move this in the function invocation ?
    _sqsHelper = new SQSHelper(aws, executionStore);
    _sqsHelper.startQueue(startedCallback);
};

exports.create = function (func, config) {
    var functionConfig = extend(true, {}, defaultFunctionSettings, config);
    var functionIdentifier = _getFunctionHash(func);

    if (!proxyStore.hasOwnProperty(functionIdentifier)) {
        var lambdaFunc = CreateLambdaStrFunction(func);
        var uploadPromise = _uploadFunctionAsync(lambdaFunc, functionConfig, functionIdentifier);
        console.log('fucking create proxy');
        proxyStore[functionIdentifier] = _createProxy(uploadPromise);
    }

    return proxyStore[functionIdentifier];
};