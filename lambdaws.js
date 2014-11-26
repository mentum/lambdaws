// JavaScript source code
var extend = require('extend');
var aws = require('aws-sdk');
var exports = module.exports = {};
var md5 = require('md5');
var Q = require('q');

/* 
AWS User must have access to:
Lambda (UploadFunction, InvokeFunction)
SQS (SendMessage, DeleteMessage, CreateQueue)
S3 (CreateBucket, GetObject)
*/
var settings = {
    accessKeyId: '',
    secretKey: '',
    region: 'us-west-2',
    uploadTimeout: 5000
};

var defaultFunctionSettings = {
    memory: 128, // mb
    description: '',
    timeout: 3	// seconds
};

var sqsApiVersion = '2014-11-11';
var lambdaApiVersion = '2014-11-11';

aws.config.apiVersions = {lambda: lambdaApiVersion, sqs: sqsApiVersion};

// AWS Services
var sqs, lambda;

var lambdaize = function (func) {
    // http://docs.aws.amazon.com/lambda/latest/dg/lambda-introduction.html#programming-model

    var lambda = function(event, context) {
        var newCallback = function () {
        };
        // TODO Add newCallback to arguments (event)
        // TODO embed function here
        // TODO Call func with arguments
    };

    return lambda;
};

var uploadFunctionAsync = function (lambdaFunc, config) {
    var deferred = Q.defer();

    var handlerName = 'default';
    var functionAsString = 'exports.' + handlerName + '=' + lambdaFunc + ';';
    var functionMD5 = md5(functionAsString);

    var params = {
        FunctionName: config.name || functionMD5, // TODO Find a better way to name functions?
        FunctionZip: functionAsString, // TODO Zip function
        Handler: handlerName,
        Mode: 'event', // Even though we invoke manually

        // TODO The Amazon Resource Name (ARN) of the IAM role that Lambda assumes when it executes your function to access any other Amazon Web Services (AWS) resources.
        Role: 'STRING_VALUE',

        Runtime: 'nodejs',
        Description: config.description,
        MemorySize: config.memory,
        Timeout: config.timeout
    };

    lambda.uploadFunction(params, function (err, data) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise.timeout(settings.uploadTimeout, "Function upload to AWS Lambda timed out.");
};

// Public interface

exports.config = function (params) {
    extend(settings, params);

    aws.config.update({
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretKey,
        region: settings.region
    });

    sqs = new aws.SQS();
    lambda = new aws.Lambda();
};

exports.create = function(func, config) {

    var functionConfig = extend(true, {}, defaultFunctionSettings, config);

    var lambda = lambdaize(func);

    var proxy = function () {
        // TODO Check if last argument is a callback
        // TODO Get all parameters except the callback
        // TODO Invoke the lambda function with parameters THEN register the callback with the appropriate invokation RequestId
    };

    // var uploadPromise = uploadFunctionAsync(splitFunction, functionConfig);

    return proxy;
};
