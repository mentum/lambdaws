var Q = require('q'),
    md5 = require('MD5');
    zip = require('node-zip'),
    uuid = require('uuid'),
    extend = require('extend'),
    fs = require('fs'),
    path = require('path'),
    zipper = require('./zipper'),
    SQSHelper = require('./SQSHelper'),
    uploadHelper = require('./UploadHelper');

var lambda                      = null,
    _sqsHelper                  = null,
    _defaultFunctionSettings    = {
        memory: 128, // mb
        description: '',
        timeout: 3  // seconds
    };

var _getFunctionHash  = function (func) {
    return md5(func.toString());
    // TODO : add config in hash
};

var _getModuleHash = function (modulePath, handlerName, deps, configs) {
    var configsAsStr = JSON.stringify(configs),
        identifier = [global.constants.MODULE_HASH_PREFIX, modulePath, handlerName, deps, configsAsStr].join('_');

    return md5(identifier);
};

var _loadModule = function(moduleName) {
    return require(moduleName); // TODO throw better errors if require fails
};

var _lambdaize = function (userFunc, externals) {
    
    function __lambda__ (event, context) {
        var utils               = require('./_utils'),
            callbackHandler     = require('./_callbackHandler'),
            externalsHandler    = require('./_externalsHandler');

        var doneCallback = callbackHandler.getCallback(event, context);

        event.args.push(doneCallback);
        var externals = /*externals*/null;
        var func = /*user function*/null;

        var runUserFunction = function() {
            try {
            func.apply(this, event.args);
            }
            catch(error) {
                doneCallback(utils.objectifyError(error));
            }
        };
        
        try { externalsHandler.installExternals(externals, runUserFunction) }
        catch(error) { doneCallback(utils.objectifyError(error)) }
    }

    return __lambda__.toString()
        .replace('/*user function*/null', userFunc.toString())
        .replace('/*externals*/null', JSON.stringify(externals));
}

var _lambdaizeModule = function(handlerName, externals) {
    var functionToCall = typeof(handlerName) === 'string' ? '.' + handlerName : '';

    // Requiring the function in module
    var outputModuleCode = "var m = require('./module.js')" + functionToCall + ";";
    var instrumentedFunction = _lambdaize('m', externals),
        instrumentedFunctionWithoutName = instrumentedFunction.replace('function __lambda__', 'function');

    // Exporting the instrumented module call
    outputModuleCode += "exports." + global.constants.MODULE_DEFAULT_HANDLER + " = " + instrumentedFunctionWithoutName;
    return outputModuleCode;
}

var _createProxy = function (executionStore, queueInitializedPromise, uploadPromise) {
    function proxy() {
        var args = Array.prototype.slice.call(arguments);
        if (typeof(args[args.length - 1]) !== 'function') {
            throw "Expected last argument to be a callback";
        }

        if(!_sqsHelper.initialized) _sqsHelper.startQueue();

        var callb = args.pop();
        uploadPromise.fail(function(err) {console.log(err);});
        Q.all([queueInitializedPromise, uploadPromise]).spread(function (queueUrl, uploadData) {
            var params = {
                FunctionName: uploadData.FunctionName,
                InvokeArgs: JSON.stringify({
                    args: args,
                    sqsQueueUrl: queueUrl
                })
            };

            var req = lambda.invokeAsync(params).
            on('success', function(data) {
                executionStore[data.requestId] = callb;
            }).
            on('error', function(err) {
                callb(err, null);
            }).
            send();

        });

        uploadPromise.catch(function () {
            throw "Could not upload function to S3";
        });
    }

    return proxy;
};

var _getExternalDependencies = function(deps) {
    if(!deps) return [];
    return deps.filter(function(dep) {
        return dep[0] === ':';
    });
};

// TODO : replace getmodulehash and get function hash for a single function
// TODO : md5 module and include it in the hash function
module.exports = function (aws) {
    var proxyStore = {};
    var executionStore = {};
    lambda = new aws.Lambda();
    _sqsHelper = new SQSHelper(aws, executionStore);

    // this is temporary until a decent plugin module is developed
    this.createProxy = _createProxy;
    this.uploader = uploadHelper(lambda);

    this.getCloudedFunctionFromFunction = function (func, deps, configs) {
        var functionConfig = extend(true, {}, _defaultFunctionSettings, configs);
        var functionIdentifier = _getFunctionHash(func);

        if (!proxyStore.hasOwnProperty(functionIdentifier)) {
            var externals = _getExternalDependencies(deps);
            var lambdaFunc = _lambdaize(func, externals);
            var functionAsString = 'exports.' + global.constants.MODULE_DEFAULT_HANDLER + '=' + lambdaFunc + ';';

            var zippedFunction  = zipper.zipFunction(functionAsString, deps),
                uploadPromise   = this.uploader(zippedFunction, functionConfig, functionIdentifier);
            
            proxyStore[functionIdentifier] = this.createProxy(executionStore, _sqsHelper.initializedPromise, uploadPromise);
        }

        return proxyStore[functionIdentifier];
    };

    this.getCloudedFunctionFromModule = function(modulePath, handlerName, deps, configs) {
        var functionConfig = extend(true, {}, _defaultFunctionSettings, configs);
        var functionIdentifier = _getModuleHash(modulePath, handlerName, deps, functionConfig);
        
        if(!proxyStore.hasOwnProperty(functionIdentifier)) {
            var _module = _loadModule(modulePath);

            if(typeof(handlerName) === 'string') {
                // Check if function exists in module object
                if(typeof(_module) !== 'object') {
                    throw Error('Expected the module to return an object when handlerName is not empty');
                }
                if(!_module.hasOwnProperty(handlerName) || typeof(_module[handlerName]) !== 'function') {
                    throw  Error('Expected module to have a function called ' + handlerName);
                }
            } else {
                // Check that module is a function
                if(typeof(_module) !== 'function') {
                    throw Error('Expected the module to be a function since handlerName was not specified');
                }
            }

            var externals = _getExternalDependencies(deps);
            var moduleOverride  = _lambdaizeModule(handlerName, externals);
            var zippedModule    = zipper.zipModule(moduleOverride, modulePath, deps);
            var uploadPromise   = this.uploader(zippedModule, functionConfig, functionIdentifier);

            proxyStore[functionIdentifier] = this.createProxy(executionStore, _sqsHelper.initializedPromise, uploadPromise);
        }

        return proxyStore[functionIdentifier];
    };

    this.getCloudedFunctionFromZip = function(zipContent, configs) {
        var functionConfig = extend(true, {}, _defaultFunctionSettings, configs);
        var functionIdentifier = md5(zipContent);

        if(!proxyStore.hasOwnProperty(functionIdentifier)) {
            var uploadPromise = this.uploader(zipContent, functionConfig, functionIdentifier);
            proxyStore[functionIdentifier] = this.createProxy(executionStore, _sqsHelper.initializedPromise, uploadPromise);
        }

        return proxyStore[functionIdentifier];
    }
};
