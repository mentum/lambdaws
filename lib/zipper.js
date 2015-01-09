var _generateZip = function(zip){
    var options = {
        type: 'nodebuffer',
        compression: 'DEFLATE'
    }
    var zipped = zip.generate(options);
    
    if(zipped.length >= MAX_LAMBDA_ZIP_SIZE) {
        throw 'The zipped function is larger than the maximum file zipe you can upload to AWS Lambda';
    }

    return zipped; 
}

var _addDepsToZip = function(zip, deps){
    if(deps){
        var depsFolders = deps.map(function(dep) {
            return _getDependencyFolder(dep);
        });   
        var zipModules = zipFile.folder(DEPENDENCIES_DEFAULT_FOLDER);

        depsFolders.forEach(function(folder) {
            _addFolderRecursiveToZipNode(folder, zipModules);
        });
    }
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
    zipFunction : function(stringFunc, handlerName, deps){
        var _zip = zip();
        _zip.file(handlerName + '.js', functionAsString);

        _addDepsToZip(_zip, deps);

        return _generateZip(_zip);
    },
    zipModule : function(moduleOverride, modulePath, deps){
        var _zip = zip();
        var moduleFile = fs.readFileSync(modulePath);
        
        _zip.file('module.js', moduleFile);
        _zip.file('index.js', moduleOverride);

        _addDepsToZip(_zip, deps);

        return _generateZip(_zip);
    }
}
