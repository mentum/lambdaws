"use strict";

var exports = module.exports = {};

var extend = require('extend'),
    aws = require('aws-sdk'),
    md5 = require('MD5'),
    Q = require('q'),
    rx = require('rx'),
    fs = require('fs'),
    zip = require('node-zip'),
    uuid = require('uuid');

var versions = {
    sqs: "2014-11-11",
    lambda: "2014-11-11"
};

var settings = {
    accessKey: '',
    secretKey: '',
    region: 'us-west-2',
    sqsQueueName: 'LambdaResultsQueue',
    uploadTimeout: 5000
};

var defaultFunctionSettings = {
    memory: 128, // mb
    description: '',
    timeout: 3  // seconds
};

aws.config.apiVersions = versions;

var sqs,
    lambda;

var sqsMessages = new rx.Subject(),
    sqsQueueUrl = '';

var executions = {};

var _initialized = false,
    _initializedDeferred = Q.defer();

var proxyStore = {};

var _lambdaize = function (func) {
    // http://docs.aws.amazon.com/lambda/latest/dg/lambda-introduction.html#programming-model

    var _lambda = function(event, context) {

        var executionSucceeded = true,
            executionError = null;

        // TODO (Next iteration) Move requires elsewhere
        var AWS_sdk = require('aws-sdk'),
            sqs_svc = new AWS_sdk.SQS();

        var _sendToSqs = function(data, afterSentCallback) {
            // TODO (Next iteration) Check MessageBody length and upload to S3 if too lengthy
            var params = {
                MessageBody: JSON.stringify(data),
                QueueUrl: event.sqsQueueUrl
            };
            sqs_svc.sendMessage(params, function(err) {
                if(err) console.log('Error sending response to sqs'); 
                afterSentCallback();
            });
        };

        var _newCallback = function (err) {
            var finishExecution = function() { context.done(null, "Lambdaws done"); };
            if(typeof(err) !== 'undefined' && err.isFaulty) {
                _sendToSqs({success: false, data: err, requestId: event.requestId}, finishExecution);
            } 
            else {
                _sendToSqs({success: true, data: arguments, requestId: event.requestId}, finishExecution);
            }
        };

        var userFunc = /*<func>*/null;

        event.args.push(_newCallback);

        try {
            userFunc.apply(this, event.args);
        }
        catch(error) {
            _newCallback({isFaulty: true, stack: error.stack, message: error.message});
        }
    };

    return (_lambda.toString().replace('/*<func>*/null', func.toString()));
};

var _uploadFunctionAsync = function (lambdaFunc, config, functionHash) {
    var deferred = Q.defer();

    var handlerName = config.name || 'default';
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

var _startListeningToSQS = function(sqsQueueUrl, rxQueue) {
    
    var params = {
          QueueUrl: sqsQueueUrl,
          MaxNumberOfMessages: 10
        };

    var recursiveSQSCall = function() {
        sqs.receiveMessage(params, function(err, data) {
            for(var i in data.Messages) {
                rxQueue.onNext(data.Messages[i]);
            }
            recursiveSQSCall(); // <-- Recurse point
        });
    };

    recursiveSQSCall();
};

var _startPickingUpSQSMessages = function(sqsQueueUrl, rxQueue) {

    rxQueue
    .distinct(function(x) {
        return x.MessageId;
    })
    .subscribe(function(x) {
        var body = JSON.parse(x.Body);

        if(executions.hasOwnProperty(body.requestId)) {
            // TODO (version 2) Get result from S3 if length > 256kb
            // TODO If callback wasn't handled, exit early
            var callArgs = [];
            for(var i in body.data) {
                callArgs.push(body.data[i]);
            }
            executions[body.requestId].apply(this, callArgs);
            delete executions[body.requestId];

            sqs.deleteMessage({
                QueueUrl: sqsQueueUrl,
                ReceiptHandle: x.ReceiptHandle
            }, function(err, data) {
                if(err) console.log("SQS Deletion failed", x.MessageId); // TODO Handle error gracefully
            });
        }
    });

};

var _getFunctionHash = function(func) {
    return md5(func.toString());
    // TODO : add config in hash
}

var _createProxy = function (promise, lambdaFunc) {
    function proxy() {
        var args = Array.prototype.slice.call(arguments);
        if(typeof(args[args.length -1]) !== 'function') {
            throw "Expected last argument to be a callback";
        }

        var callb = args.pop();
        var requestId = uuid.v4();

        Q.all([_initializedDeferred.promise, promise]).spread(function(queue, uploadData) {
            var params = {
              FunctionName: uploadData.FunctionName,
              InvokeArgs: JSON.stringify({
                args: args,
                sqsQueueUrl: sqsQueueUrl,
                requestId: requestId
              })
            };

            lambda.invokeAsync(params, function(err, data) {
              if (err) console.log(err, err.stack); // TODO Handle Error gracefully
              else {
                executions[requestId] = callb;
                console.log("Invoked", new Date().getSeconds());
              }
            });
        });

        promise.catch(function() {
            throw "Could not upload function to S3";
        });
    };
    return proxy;
}

// Public API

exports.config = function (params) {
    extend(settings, params);

    aws.config.update({
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
        region: settings.region
    });

    sqs = new aws.SQS();
    lambda = new aws.Lambda();
};

exports.start = function(startedCallback) {

    if(_initialized) throw "Already initialized";

    var params = {
      QueueName: settings.sqsQueueName,
      Attributes: {
        MaximumMessageSize: '262144',
        ReceiveMessageWaitTimeSeconds: '20',
      }
    };

    sqs.createQueue(params, function(err, data) {
        if (err) { 
            if(typeof(startedCallback) === 'function') 
                startedCallback(err);
            return; 
        }

        sqsQueueUrl = data.QueueUrl;
        _startListeningToSQS(sqsQueueUrl, sqsMessages);
        _startPickingUpSQSMessages(sqsQueueUrl, sqsMessages);
        _initializedDeferred.resolve(sqsQueueUrl);
        _initialized = true;

        if(typeof(startedCallback) === 'function') startedCallback();
    });
};

exports.create = function(func, config) {
    var functionConfig = extend(true, {}, defaultFunctionSettings, config);
    var functionHash = _getFunctionHash(func);

    if(!proxyStore.hasOwnProperty(functionHash)) {
        var lambda = _lambdaize(func);
        
        var uploadPromise = _uploadFunctionAsync(lambda, functionConfig, functionHash);
        var proxy = _createProxy(uploadPromise, lambda)
        
        proxyStore[functionHash] = proxy;            
    }

    return proxyStore[functionHash];
};
