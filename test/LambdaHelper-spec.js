var rewire = require('rewire'),
	Q = require('q'),
	LambdaHelper = rewire("../lib/LambdaHelper");

var dumbAsyncFunction = function(callback) {callback()};

describe("getCloudedFunctionFromModule", function() {

	var mockedAWS = createSpyObj('mockedAWS', ['Lambda']);
	
	var helper,
		newLoadModule, 
		newGetDependencyFolder, 
		newAddFolderRecursiveToZipNode, 
		newAddFileToZipNode, 
		newUploadZipAsync;

	beforeEach(function() {
		newLoadModule = function(module) {
			if(module === 'path/to/module') {
				return {
					handler: function() {},
					difference: function() {}
				}
			}
			return function(){};
		};

		newGetDependencyFolder = function(dep) {
			return dep;
		};

		newAddFolderRecursiveToZipNode = function() {};
		newAddFileToZipNode = function() {};
		newUploadZipAsync = function() {
			var d = Q.defer();
			return d.promise;
		};

		LambdaHelper.__set__('_loadModule', newLoadModule);
		LambdaHelper.__set__('_getDependencyFolder', newGetDependencyFolder);
		LambdaHelper.__set__('_addFolderRecursiveToZipNode', newAddFolderRecursiveToZipNode);
		LambdaHelper.__set__('_addFileToZipNode', newAddFileToZipNode);
		LambdaHelper.__set__('_uploadZipAsync', newUploadZipAsync);

		helper = new LambdaHelper(mockedAWS);
	});

	describe('Cache', function() {
		it('Cached when called with same args', function() {
			var call1 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'ok'});
			var call2 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'ok'});

			expect(call1).not.toBe(null);
			expect(call1).not.toBe(undefined);
			expect(call1 === call2).toBe(true);
		});

		it('Cache takes all arguments into account', function() {
			var call1 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'ok'});
			var call2 = helper.getCloudedFunctionFromModule('path/to/module/difference', null, ['rewire'], {test: 'ok'});
			var call3 = helper.getCloudedFunctionFromModule('path/to/module', 'difference', ['rewire'], {test: 'ok'});
			var call4 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire', 'hello'], {test: 'ok'});
			var call5 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'hey'});

			expect(call1).not.toBe(undefined);
			expect(call2).not.toBe(undefined);
			expect(call3).not.toBe(undefined);
			expect(call4).not.toBe(undefined);
			expect(call5).not.toBe(undefined);
			expect(call1 === call2).toBe(false);
			expect(call1 === call3).toBe(false);
			expect(call1 === call4).toBe(false);
			expect(call1 === call5).toBe(false);
		});
	});

	describe('Module check', function() {
		it('Throws if handler doesnt exist within module object', function() {
			var f = function() {
				helper.getCloudedFunctionFromModule('path/to/module', 'random', ['dep'], {});
			};

			expect(f).toThrow();
		});

		it('Throws if handler is not a module object and handlerName is specified', function() {
			var f = function() {
				helper.getCloudedFunctionFromModule('not/a/module/object', 'random', ['dep'], {});
			};

			expect(f).toThrow();
		});

		it('Pass when handler is found within module object', function() {
			var f = function() {
				helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['dep'], {});
			};

			expect(f).not.toThrow();
		});

		it('Pass when module is a function and handler is not specified', function() {
			var f = function() {
				helper.getCloudedFunctionFromModule('not/a/module/object', null, ['dep'], {});
			};

			expect(f).not.toThrow();
		});
	});

});
