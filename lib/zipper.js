var fs      = require('fs'),
    zip     = require('node-zip'),
    path    = require('path');

require('./extensions/string');

var DEPENDENCIES_DEFAULT_FOLDER = 'node_modules',
    MAX_LAMBDA_ZIP_SIZE         = 25e+6;
    
var _generateZip = function(_zip){
    var options = {
        type: 'nodebuffer',
        compression: 'DEFLATE'
    }
    var zipped = _zip.generate(options);
    
    if(zipped.length >= MAX_LAMBDA_ZIP_SIZE) {
        throw Error('The zipped function is larger than the maximum file zipe you can upload to AWS Lambda');
    }

    return zipped; 
}

var _getDependencyFolder = function(dep) {
    var depFolder = path.dirname(require.resolve(dep)) + path.sep;
    var subFolders = depFolder.split(path.sep);
    var node_modules_index = subFolders.lastIndexOf('node_modules') + 1; // Zero-based indexes
    var folders = subFolders.splice(0, node_modules_index + 1); // We select the next folder
    return folders.join(path.sep); // TODO throw better errors if require fails
};

var _addDepsToZip = function(_zip, deps){
    var depsFolders = deps
    .filter(function(dep){
        return !dep.startsWith(global.constants.EXTERNALS_PREPENDING_STR)
            && !dep.startsWith(global.constants.INTERNALS_PREPENDING_STR);
    })
    .map(function(dep) {
        return _getDependencyFolder(dep);
    }).filter(function(dep){
        // we exclude those deps because they are built-in node and zipping . folder is not wanted
        return dep !== '.';
    });

    var zipModules = _zip.folder(DEPENDENCIES_DEFAULT_FOLDER);
    depsFolders.forEach(function(folder) {
        _addFolderRecursiveToZipNode(folder, zipModules);
    });
}

var _addFolderRecursiveToZipNode = function(folder, zipNode) {
    var basename = path.basename(folder);
    var node = zipNode.folder(basename);
    var files = fs.readdirSync(folder);

    files.forEach(function(file) {
        var fullPath = path.join(folder, file);
        if(fs.statSync(fullPath).isDirectory())
            _addFolderRecursiveToZipNode(fullPath, node);
        else // TODO It would be nice to exclude non-mandatory files like .md, .txt etc
            node.file(file, fs.readFileSync(fullPath));
    });
};

var _addHandlersToZip = function(zip, configs) {
        var callbackHandler = !!configs.ignoreResponse ? '_emptyCallbackHandler.js' : '_SQSCallbackHandler.js';
        var callbackHandlerFile = fs.readFileSync(__dirname + '/internals/' + callbackHandler);
        var externalsHandlerFile = fs.readFileSync(__dirname + '/internals/_externalsHandler.js');
        var utilsFile = fs.readFileSync(__dirname + '/internals/_utils.js');

        zip.file('_callbackHandler.js', callbackHandlerFile);
        zip.file('_externalsHandler.js', externalsHandlerFile);
        zip.file('_utils.js', utilsFile);
};

var _addInternalsToZip = function(zip, deps) {
    var internals = deps.filter(function(d) {
        return d.startsWith(global.constants.INTERNALS_PREPENDING_STR);
    });

    if(internals.length === 0) return;

    var node = zip.folder(global.constants.INTERNALS_FOLDER_NAME);
    
    for(var i in internals) {
        var internal = internals[i].substr(global.constants.INTERNALS_PREPENDING_STR.length);
        var fileName = path.basename(internal);
        node.file('fileName.js', fs.readFileSync(internal));
    }
};

module.exports = {
    zipFunction : function(stringFunc, deps, configs){
        var _zip = zip();
        _zip.file('index.js', stringFunc);
        _addHandlersToZip(_zip, configs);
        _addInternalsToZip(_zip, deps);

        if (deps) {
            _addDepsToZip(_zip, deps);            
        }

        return _generateZip(_zip);
    },
    zipModule : function(moduleOverride, modulePath, deps, configs){
        var _zip = zip();

        var moduleFile = fs.readFileSync(modulePath);
        
        _zip.file('module.js', moduleFile);
        _zip.file('index.js', moduleOverride);
        _addHandlersToZip(_zip, configs);
        _addInternalsToZip(_zip, deps);

        if (deps) {
            _addDepsToZip(_zip, deps);            
        }

        return _generateZip(_zip);
    }
}
