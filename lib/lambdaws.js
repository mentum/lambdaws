"use strict";
var extend = require('extend'),
    aws = require('aws-sdk'),
    SQSHelper = require('./SQSHelper'),
    LambdaHelper = require('./LambdaHelper');

global.settings = {
    accessKey: '',
    secretKey: '',
    region: 'us-west-2',
    sqsQueueName: 'LambdaResultsQueue',
    uploadTimeout: 5000
};

var versions = {
    sqs: "2014-11-11",
    lambda: "2014-11-11"
};

var _sqsHelper = null;
var _lambdaHelper = null;
var executionStore = {};

function _initializeAwsHelpers(){
    _sqsHelper = new SQSHelper(aws, executionStore);
    _lambdaHelper = new LambdaHelper(aws, _sqsHelper.initializedPromise, executionStore);
}

// Public API
var exports = module.exports = {};

exports.config = function (params) {
    aws.config.apiVersions = versions;
    extend(settings, params);

    aws.config.update({
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
        region: settings.region
    });

    _initializeAwsHelpers();
};

exports.start = function (startedCallback) {
    // TODO : move this in the function invocation ?
    _sqsHelper.startQueue(startedCallback);
};

exports.create = function () {
    if(typeof(arguments[0]) === 'function') {
        return _lambdaHelper.getCloudedFunctionFromFunction(arguments[0], arguments[1], arguments[2]);
    }
    else {
        if(typeof(arguments[1]) !== 'string')
            return _lambdaHelper.getCloudedFunctionFromModule(arguments[0], null, arguments[1], arguments[2]);
        else
            return _lambdaHelper.getCloudedFunctionFromModule(arguments[0], arguments[1], arguments[2], arguments[3]);
    }
};
