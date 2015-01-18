var fs      = require('fs'),
    zip     = require('node-zip'),
    path    = require('path');

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
    var node_modules_index = subFolders.indexOf('node_modules') + 1; // Zero-based indexes
    var folders = subFolders.splice(0, node_modules_index + 1); // We select the next folder
    return folders.join(path.sep); // TODO throw better errors if require fails
};

var _addDepsToZip = function(_zip, deps){
    var depsFolders = deps.map(function(dep) {
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

module.exports = {
    zipFunction : function(stringFunc, deps){
        var _zip = zip();
        _zip.file('index.js', stringFunc);

        if (deps) {
            _addDepsToZip(_zip, deps);            
        }

        return _generateZip(_zip);
    },
    zipModule : function(moduleOverride, modulePath, deps){
        var _zip = zip();
        var moduleFile = fs.readFileSync(modulePath);
        
        _zip.file('module.js', moduleFile);
        _zip.file('index.js', moduleOverride);

        if (deps) {
            _addDepsToZip(_zip, deps);            
        }

        return _generateZip(_zip);
    }
}
