var rewire = require('rewire'),
	Q = require('q'),
	LambdaHelper = rewire("../lib/LambdaHelper");

var dumbAsyncFunction = function(callback) {callback()};

describe("getCloudedFunctionFromModule", function() {
	var mockedAWS 		= createSpyObj('mockedAWS', ['Lambda']),
		mockedZipper 	= createSpyObj('zipper', ['zipFunction', 'zipModule']),
		mockedUpload 	= createSpy('uploadMock'),
		mockedUploader  = function() { return mockedUpload; };
	
	var helper,
		newLoadModule, 
		uploadHelper;

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

		LambdaHelper.__set__('zipper', mockedZipper);
		LambdaHelper.__set__('_loadModule', newLoadModule);
		LambdaHelper.__set__('uploadHelper', mockedUploader);

		helper = new LambdaHelper(mockedAWS);
	});

	describe('Cache', function() {
		it('Cached when called with same args for module', function() {
			var call1 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'ok'});
			var call2 = helper.getCloudedFunctionFromModule('path/to/module', 'handler', ['rewire'], {test: 'ok'});

			expect(call1).not.toBe(null);
			expect(call1).not.toBe(undefined);
			expect(call1).toEqual(call2);
		});

		it('Cache takes all arguments into account for module', function() {
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

describe("Lambdaization", function() {
	var dumbAsyncFunction = function(callback) {callback()};
	
	var originalLambdaizeModule,
		mockedLambdaizeModule,
		originalLoadModule,
		originalLambdaize,
		mockedLoadModule,
		originalUploader,
		mockedLambdaize,
		mockedUploader,
		originalZipper,
		mockedUpload,
		mockedZipper,
		lambdaHelper,
		mockedAWS;

	beforeEach(function() {
		mockedLambdaizeModule 	= createSpy('mockedLambdaizeModule');
		mockedLoadModule 		= createSpy('mockedLoadModule');
		mockedLambdaize 		= createSpy('mockedLambdaize');
		mockedUploader			= function() { return mockedUpload; };
		mockedUpload 			= createSpy('mockedUpload');
		mockedZipper 			= createSpyObj('mockedZipper', ['zipFunction', 'zipModule']);
		mockedAWS 				= createSpyObj('mockedAWS', ['Lambda']);

		originalLambdaizeModule	= LambdaHelper.__get__('_lambdaizeModule');
		originalLoadModule		= LambdaHelper.__get__('_loadModule');
		originalLambdaize 		= LambdaHelper.__get__('_lambdaize');
		originalUploader 		= LambdaHelper.__get__('uploadHelper');
		originalZipper			= LambdaHelper.__get__('zipper');

		LambdaHelper.__set__('_lambdaizeModule', mockedLambdaizeModule);
		LambdaHelper.__set__('_loadModule', mockedLoadModule);
		LambdaHelper.__set__('uploadHelper', mockedUploader);
		LambdaHelper.__set__('_lambdaize', mockedLambdaize);
		LambdaHelper.__set__('zipper', mockedZipper);
		
		lambdaHelper = new LambdaHelper(mockedAWS);
	});

	afterEach(function() {
		LambdaHelper.__set__('_lambdaizeModule', originalLambdaizeModule);
		LambdaHelper.__set__('_loadModule', originalLoadModule);
		LambdaHelper.__set__('uploadHelper', originalUploader);
		LambdaHelper.__set__('_lambdaize', originalLambdaize);
		LambdaHelper.__set__('zipper', originalZipper);
	})

	it('should intitialize aws lambda SDK', function(){
		expect(mockedAWS.Lambda).toHaveBeenCalled();
	});

	it('should Lambdaize function when called the first time', function(){
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction, [], {});
		
		expect(mockedZipper.zipFunction).toHaveBeenCalled();
		expect(mockedLambdaize).toHaveBeenCalled();
		expect(mockedUpload).toHaveBeenCalled();
	});

	it('should Lambdaize function only once on multiple calls', function(){
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction, [], {});
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction, [], {});

		expect(mockedLambdaize.calls.count()).toEqual(1);
	});
	
	describe('module', function(){
		var handlerName = 'handler';
		
		beforeEach(function(){
			var fakeModule = {}
			fakeModule[handlerName] = dumbAsyncFunction;
			mockedLoadModule.and.returnValue(fakeModule);
		})

		it('should Lambdaize module when called the first time', function(){
			lambdaHelper.getCloudedFunctionFromModule('/module/path', handlerName, ['dep'], {});
			
			expect(mockedZipper.zipModule).toHaveBeenCalled();
			expect(mockedLambdaizeModule).toHaveBeenCalled();
			expect(mockedUpload).toHaveBeenCalled();
		});
		
		it('should Lambdaize module when called the first time', function(){
			lambdaHelper.getCloudedFunctionFromModule('/module/path', handlerName, ['dep'], {});
			lambdaHelper.getCloudedFunctionFromModule('/module/path', handlerName, ['dep'], {});
			
			expect(mockedLambdaizeModule.calls.count()).toEqual(1);
		});
	});
});
