var AWS = require('aws-sdk'),
	utils = require('./_utils'),
	s3 = new AWS.S3({ endpoint: 's3-external-1.amazonaws.com' }),
	fs = require('fs'),
	cp = require('child_process');

// Add /tmp/libs to the process PATH so we can execute custom libraries
process.env['PATH'] = process.env['PATH'] + ':/tmp/libs';

module.exports.installExternals = function(externals, callback) {
	
	if(externals.length === 0) {
		callback(); 
		return;
	}

	var installedCount = 0;

	var downloadInstallationScript = function(lib, next) {
		var installationFilePath = "/tmp/" + lib + "_install";
		var libS3Path = lib.toLowerCase() + "/install_default";
		
		utils.log('Downloading Library', lib);

		var libStream = fs.createWriteStream(installationFilePath, { mode: 0777 }); // +rwx all users
		s3.getObject({ Bucket: 'lambdaws-libs', Key: libS3Path }).createReadStream().pipe(libStream);

		libStream.on('finish', function(err, data) { next(installationFilePath) });
		libStream.on('error', function(err, data) { callback(utils.objectifyError(err)) });
	};

	var installLibrary = function(installationFilePath) { 
		utils.log('Installing Library', installationFilePath);
		cp.exec(installationFilePath, function(err, stdout, stderr) {
			utils.log('Installed Library', installationFilePath);
			if(++installedCount === externals.length) {
				utils.log('All libs installed');
				callback();
			}
		});
	};

	var installAllLibraries = function() {
		for(var i in externals) {
			var libraryName = externals[i].substr(1); // trimming out the prepending ":"
			downloadInstallationScript(libraryName, function(installationFilePath) {
				installLibrary(installationFilePath);
			});
		}
	};

	var onWgetDownloaded = function() {
		utils.log('wget downloaded');
		installAllLibraries();
	};

	var onWgetDownloadError = function(err) {
		callback(utils.objectifyError(err));
	};

	// Downloading WGET from Lambdaws S3 Bucket
	utils.log('Downloading wget');
	
	try {
		var wgetStream = fs.createWriteStream("/tmp/wget", { mode: 0777 });
	s3.getObject({ Bucket: 'lambdaws-libs', Key: 'wget' }).createReadStream().pipe(wgetStream);

	wgetStream
		.on('finish', onWgetDownloaded)
		.on('error', onWgetDownloadError);
	}
	catch(e) {
		callback(utils.objectifyError(e));
	}
	
};
