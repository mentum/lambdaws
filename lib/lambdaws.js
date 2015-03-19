"use strict";
var extend = require('extend'),
    aws = require('aws-sdk'),
    LambdaHelper = require('./LambdaHelper'),
    path = require('path');

require('./extensions/string');

global.settings = {
    credentials: null,
    region: 'us-west-2',
    sqsQueueName: 'LambdaResultsQueue',
    uploadTimeout: 40000
};

global.constants = {
    MODULE_HASH_PREFIX: 'fromModule',
    MODULE_DEFAULT_HANDLER: 'default',
    LAMBDA_RUNTIME: 'nodejs',
    LAMBDA_MODE: 'event',
    EXTERNALS_PREPENDING_STR: ':',
    INTERNALS_PREPENDING_STR: '+',
    INTERNALS_FOLDER_NAME: 'project_files'
};

var _lambdaHelper = null;
var versions = {
    sqs: "2014-11-11",
    lambda: "2014-11-11"
};

// module.parent is always ../index.js
// module.parent.parent is the module calling this
// this is always true because we disabled module caching (see enf of this file)
var relativeDir = path.dirname(module.parent.parent.filename);

function _resolvePathFromParent(p) {
    
    var prependingStr = '';
    if(p.startsWith(global.constants.INTERNALS_PREPENDING_STR)) {
        prependingStr = global.constants.INTERNALS_PREPENDING_STR;
        p = p.substr(global.constants.INTERNALS_PREPENDING_STR.length);
    }

    try {
        if(p.startsWith(global.constants.EXTERNALS_PREPENDING_STR)) return p;

        // For built in or global modules
        return prependingStr + require.resolve(p);
    }
    catch(ex1) { // Not found
        var fullPath = path.join(relativeDir, p);
        try {
            return prependingStr + require.resolve(fullPath);
        }
        catch(ex2) { // Not found
            throw new Error("Could not resolve module [" + p + "] from [" + relativeDir + "] at [" + fullPath + "]");
        }
    }
}

function _injectAwsSdkIntoDeps(deps) {
    // See issue #41
    // For some reason requiring aws-sdk is very slow inside lambdaws if not included in deps
    if(deps.map(function(d) {
        return d.toLowerCase();
    }).indexOf('aws-sdk') == -1) {
        deps.push('aws-sdk');
    }
}

function _createFromInlinedFunction() {
    var deps = arguments[1] || [];
    _injectAwsSdkIntoDeps(deps);

    var resolvedDeps = deps.map(function(d) {
        return _resolvePathFromParent(d);
    });

    return _lambdaHelper.getCloudedFunctionFromFunction(arguments[0], resolvedDeps, arguments[2]);
};

function _createFromModule() {
    var module = _resolvePathFromParent(arguments[0]),
        handlerName,
        deps,
        resolvedDeps,
        configs;

    if(typeof(arguments[1]) === 'string') {
        handlerName = arguments[1];
        deps = arguments[2] || [];
        configs = arguments[3];
    } else {
        handlerName = null;
        deps = arguments[1] || [];
        configs = arguments[2];
    }

    _injectAwsSdkIntoDeps(deps);

    resolvedDeps = deps.map(function(d) {
        return _resolvePathFromParent(d);
    });

    return _lambdaHelper.getCloudedFunctionFromModule(module, handlerName, resolvedDeps, configs);
};

function _createFromZipFile() {
    return _lambdaHelper.getCloudedFunctionFromZip(arguments[0], arguments[1]);
};

// Public API
var exports = module.exports = {};

// this is temporary until a decent plugin module is developed
exports.extend = function(callback){
    this.container = {
        lambdaHelper : _lambdaHelper
    }

    callback(this);
};

exports.config = function (params) {
    aws.config.apiVersions = versions;
    extend(settings, params);

    if (settings.credentials !== null) {
        if (typeof settings.credentials === 'string') {
            // Specifying profile
            aws.config.credentials = new aws.SharedIniFileCredentials({profile: settings.credentials});
        } else {
            // Setting keys manually
            aws.config.update({
                accessKeyId: settings.credentials.accessKey,
                secretAccessKey: settings.credentials.secretKey
            });
        }
    }

    aws.config.update({
        region: settings.region
    });

    _lambdaHelper = new LambdaHelper(aws);
};

exports.create = function () {
    if(typeof arguments[0] === 'function') {
        return _createFromInlinedFunction.apply(this, arguments);
    }
    else if(typeof arguments[0] === 'string') {
        return _createFromModule.apply(this, arguments);   
    }
    else if(arguments[0] instanceof Buffer) {
        return _createFromZipFile.apply(this, arguments);
    }
};

// Required to disable module caching for this module
// Lambdaws can't be cached because it needs to know it's real module parent
// so we can resolve relative paths correctly
delete require.cache[__filename];
