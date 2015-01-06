var Q = require('q'),
    md5 = require('MD5');
    zip = require('node-zip'),
    uuid = require('uuid'),
    extend = require('extend'),
    fs = require('fs'),
    path = require('path');
    
var MAX_LAMBDA_ZIP_SIZE = 25e+6,
    MODULE_HASH_PREFIX = 'fromModule',
    MODULE_DEFAULT_HANDLER = 'default',
    LAMBDA_RUNTIME = 'nodejs',
    LAMBDA_MODE = 'event',
    DEPENDENCIES_DEFAULT_FOLDER = 'node_modules';

var lambda = null,
    _defaultFunctionSettings = {
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
        identifier = [MODULE_HASH_PREFIX, modulePath, handlerName, deps, configsAsStr].join('_');

    return md5(identifier); // TODO : add config in hash?
};

var _loadModule = function(moduleName) {
    return require(moduleName); // TODO throw better errors if require fails
};

var _getDependencyFolder = function(dep) {
    var depFolder = path.dirname(require.resolve(dep)) + path.sep;
    var subFolders = depFolder.split(path.sep);
    var folders = subFolders.splice(0, subFolders.indexOf('node_modules') + 2);
    return folders.join(path.sep); // TODO throw better errors if require fails
};

var _addFolderRecursiveToZipNode = function(folder, zipNode) {
    var basename = path.basename(folder);
    var node = zipNode.folder(basename);
    var files = fs.readdirSync(folder);

    files.forEach(function(file) {
        var fullPath = path.join(folder, file);
        if(fs.statSync(fullPath).isDirectory())
            _addFolderRecursiveToZipNode(fullPath, node);
        else
            node.file(file, fs.readFileSync(fullPath));
    });
};

var _addFileToZipNode = function(name, filePath, zipNode) {
    zipNode.file(name, fs.readFileSync(filePath));
};

var _lambdaize = function (userFunc) {
    function _lambda (event, context) {
        var executionSucceeded = true,
            executionError = null;
        // TODO (Next iteration) Move requires elsewhere
        var AWS_sdk = require('aws-sdk'),
            sqs_svc = new AWS_sdk.SQS();

        function _sendToSqs(data, afterSentCallback) {
            // TODO (Next iteration) Check MessageBody length and upload to S3 if too lengthy
            var params = {
                MessageBody: JSON.stringify(data),
                QueueUrl: event.sqsQueueUrl
            };
            sqs_svc.sendMessage(params, function(err) {
                if(err) console.log('Error sending response to sqs'); 
                afterSentCallback();
            });
        }

        function _newCallback(err) {
            var finishExecution = function() { context.done(null, "Lambdaws done"); };
            if(typeof(err) !== 'undefined' && err.isFaulty) {
                _sendToSqs({success: false, data: err, requestId: context.invokeid}, finishExecution);
            } 
            else {
                _sendToSqs({success: true, data: arguments, requestId: context.invokeid}, finishExecution);
            }
        }

        event.args.push(_newCallback);

        var func = /*user function*/null;

        try {
            func.apply(this, event.args);
        }
        catch(error) {
            _newCallback({isFaulty: true, stack: error.stack, message: error.message});
        }
    }

    return _lambda.toString().replace('/*user function*/null', userFunc.toString());
}

var _lambdaizeModule = function(handlerName) {
    var functionToCall = typeof(handlerName) === 'string' ? '.' + handlerName : '';

    // Requiring the function in module
    var outputModuleCode = "var m = require('./module.js')" + functionToCall + ";";

    var instrumentedFunction = _lambdaize('m'),
        instrumentedFunctionWithoutName = instrumentedFunction.replace('function _lambda', 'function');

    // Exporting the instrumented module call
    outputModuleCode += "exports." + MODULE_DEFAULT_HANDLER + " = " + instrumentedFunctionWithoutName;

    return outputModuleCode;
}

var _uploadZipInternal = function(functionName, zipData, handler, config) {
    var deferred = Q.defer();

    var params = {
        FunctionName: functionName,
        FunctionZip: zipData,
        Handler: handler,
        Mode: LAMBDA_MODE,
        Role: settings.role,
        Runtime: LAMBDA_RUNTIME,
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

var _uploadFunctionAsync = function (lambdaFunc, config, functionHash) {
    var handlerName = config.name || 'default';
    var functionAsString = 'exports.' + handlerName + '=' + lambdaFunc + ';';
    
    var zipFile = zip();
    zipFile.file(handlerName + '.js', functionAsString, { binary: false });

    var zipData = new Buffer(zipFile.generate({
        base64: true,
        compression: 'DEFLATE'
    }), 'base64');

    var functionName = handlerName.concat('-', functionHash),
        handler = handlerName + '.' + handlerName;

    return _uploadZipInternal(functionName, zipData, handler, config);
};

var _uploadZipAsync = function(zipFileContent, config, functionIdentifier) {
    var deferred = Q.defer();

    var handlerName = config.name || 'default';

    var functionName = handlerName.concat('-', functionIdentifier),
        handler = 'index.' + MODULE_DEFAULT_HANDLER;

    return _uploadZipInternal(functionName, zipFileContent, handler, config);
};

var _createProxy = function (executionStore, queueInitializedPromise, promise) {
    function proxy() {
        var args = Array.prototype.slice.call(arguments);
        if (typeof(args[args.length - 1]) !== 'function') {
            throw "Expected last argument to be a callback";
        }

        var callb = args.pop();
        promise.fail(function(err) {console.log(err);});
        Q.all([queueInitializedPromise, promise]).spread(function (queueUrl, uploadData) {
            var params = {
                FunctionName: uploadData.FunctionName,
                InvokeArgs: JSON.stringify({
                    args: args,
                    sqsQueueUrl: queueUrl
                })
            };

            var req = lambda.invokeAsync(params).
            on('success', function(data) {
                console.log('-->')
                executionStore[data.requestId] = callb;
            }).
            on('error', function() {
                if (err) console.log(err, err.stack); // TODO Handle Error gracefully
            }).
            send();

        });

        promise.catch(function () {
            throw "Could not upload function to S3";
        });
    }

    return proxy;
};


module.exports = function (aws, queueInitializedPromise, executionStore){
    var proxyStore = {};
    lambda = new aws.Lambda()

    this.getCloudedFunctionFromFunction = function (func, configs) {
        var functionConfig = extend(true, {}, _defaultFunctionSettings, configs);
        var functionIdentifier = _getFunctionHash(func);

        if (!proxyStore.hasOwnProperty(functionIdentifier)) {
            var lambdaFunc = _lambdaize(func);
            var uploadPromise = _uploadFunctionAsync(lambdaFunc, functionConfig, functionIdentifier);
            proxyStore[functionIdentifier] = _createProxy(executionStore, queueInitializedPromise, uploadPromise);
        }

        return proxyStore[functionIdentifier];
    };

    this.getCloudedFunctionFromModule = function(modulePath, handlerName, deps, configs) {
        var functionConfig = extend(true, {}, _defaultFunctionSettings, configs);
        var functionIdentifier = _getModuleHash(modulePath, handlerName, deps, functionConfig);
        
        if(!proxyStore.hasOwnProperty(functionIdentifier)) {
            var _module = _loadModule(modulePath);
            var _moduleOverride;

            if(typeof(handlerName) === 'string') {
                // Check if function exists in module object
                if(typeof(_module) !== 'object') {
                    throw 'Expected the module to return an object when handlerName is not empty';
                }
                if(!_module.hasOwnProperty(handlerName) || typeof(_module[handlerName]) !== 'function') {
                    throw 'Expected module to have a function called ' + handlerName;
                }
            } else {
                // Check that module is a function
                if(typeof(_module) !== 'function') {
                    throw 'Expected the module to be a function since handlerName was not specified';
                }
            }

            var depsFolders = deps.map(function(dep) {
                return _getDependencyFolder(dep);
            });

            var zipFile = new zip();
            var zipModules = zipFile.folder(DEPENDENCIES_DEFAULT_FOLDER);

            depsFolders.forEach(function(folder) {
                _addFolderRecursiveToZipNode(folder, zipModules);
            });

            _moduleOverride = _lambdaizeModule(handlerName);

            _addFileToZipNode('module.js', modulePath, zipFile);
            zipFile.file('index.js', _moduleOverride);

            var content = zipFile.generate({ type: 'nodebuffer' });
            
            if(content.length >= MAX_LAMBDA_ZIP_SIZE) {
                throw 'The zipped function is larger than the maximum file zipe you can upload to AWS Lambda';
            }

            // Upload zip
            var uploadPromise = _uploadZipAsync(content, functionConfig, functionIdentifier);
            proxyStore[functionIdentifier] = _createProxy(executionStore, queueInitializedPromise, uploadPromise);
        }

        return proxyStore[functionIdentifier];
    };
};
