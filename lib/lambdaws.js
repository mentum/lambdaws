"use strict";
var extend = require('extend'),
    aws = require('aws-sdk'),
    SQSHelper = require('./SQSHelper'),
    LambdaHelper = require('./LambdaHelper'),
    path = require('path');

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

// module.parent is always ../index.js
// module.parent.parent is the module calling this
// this is always true because we disabled module caching (see enf of this file)
var relativeDir = path.dirname(module.parent.parent.filename);

function _initializeAwsHelpers(){
    _sqsHelper = new SQSHelper(aws, executionStore);
    _lambdaHelper = new LambdaHelper(aws, _sqsHelper.initializedPromise, executionStore);
}

function _resolvePathFromParent(p) {
    try {
        // For built in or global modules
        return require.resolve(p);
    }
    catch(ex1) { // Not found
        var fullPath = path.join(relativeDir, p);
        try {
            return require.resolve(fullPath);
        }
        catch(ex2) { // Not found
            throw Error("Could not resolve module [" + p + "] from [" + relativeDir + "] at [" + fullPath + "]");
        }
    }
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
        var deps = arguments[1] || [];
        var resolvedDeps = deps.map(function(d) {
            return _resolvePathFromParent(d);
        });

        return _lambdaHelper.getCloudedFunctionFromFunction(arguments[0], resolvedDeps, arguments[2]);
    }
    else {
        var module = _resolvePathFromParent(arguments[0]),
            handlerName,
            deps,
            resolvedDeps,
            configs;

        if(typeof(arguments[1]) === 'string') {
            handlerName = arguments[1];
            deps = arguments[2];
            configs = arguments[3];
        } else {
            handlerName = null;
            deps = arguments[1];
            configs = arguments[2];
        }

        resolvedDeps = deps.map(function(d) {
            return _resolvePathFromParent(d);
        });

        return _lambdaHelper.getCloudedFunctionFromModule(module, handlerName, resolvedDeps, configs);
    }
};

// Required to disable module caching for this module
// Lambdaws can't be cached because it needs to know it's real module parent
// so we can resolve relative paths correctly
delete require.cache[__filename];
