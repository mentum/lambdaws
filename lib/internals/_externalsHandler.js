// Add /tmp/libs to the process PATH so we can execute custom libraries
process.env['PATH'] = process.env['PATH'] + ':/tmp/libs';
var AWS = require('aws-sdk');
var utils = require('./_utils');
var s3 = new AWS.S3();
var fs = require('fs');
var cp = require('child_process');

module.exports.installExternals = function(externals, callback) {
	
	if(externals.length === 0) {
		callback(); 
		return;
	}

	var installedCount = 0;

	var downloadInstallationScript = function(lib, next) {
		var installationFilePath = "/tmp/" + lib + "_install";
		var libS3Path = lib.toLowerCase() + "/install_default";
		
		console.log('Lambdaws: Downloading Library ' + lib);

		var libStream = fs.createWriteStream(installationFilePath, { mode: 0777 }); // +rwx all users
		s3.getObject({ Bucket: 'lambdaws-libs', Key: libS3Path }).createReadStream().pipe(libStream);
		libStream.on('finish', function(err, data) { next(installationFilePath) });
		libStream.on('error', function(err, data) { callback(utils.objectifyError(err)) });
	};

	var installLibrary = function(installationFilePath) { 
		console.log('Lambdaws: Installing Library ' + installationFilePath);
		cp.exec(installationFilePath, function(err, stdout, stderr) {
			console.log('Lambdaws: Installed Library [' + installedCount + '/' + externals.length + '] => ' + installationFilePath);
			if(++installedCount === externals.length) {
				console.log('Lambdaws: All libs installed');
				callback();
			}
		});
	};

	// Downloading WGET from Lambdaws S3 Bucket
	console.log('Lambdaws: getting WGET to download external libs');
	var wgetStream = fs.createWriteStream("/tmp/wget", { mode: 0777 });
	s3.getObject({ Bucket: 'lambdaws-libs', Key: 'wget' }).createReadStream().pipe(wgetStream);
	wgetStream.on('finish', function(err, data) {
		console.log('Lambdaws: WGET downloaded');
		for(var i in externals) {
			var libraryName = externals[i].substr(1); // trimming out the :
			downloadInstallationScript(libraryName, function(installationFilePath) {
				installLibrary(installationFilePath);
			});
		}
	}).on('error', function(err, data) { callback(utils.objectifyError(err)) });
};
