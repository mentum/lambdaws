var rewire = require('rewire'),
	lambdaws = rewire('../lib/lambdaws'),
	LambdaHelper = rewire("../lib/LambdaHelper");

var dumbAsyncFunction = function(callback) {callback()};

describe("Function arguments", function() {
	var originalLambdaHelper, mockedLambdaHelper;

	beforeEach(function() {
		mockedLambdaHelper = createSpyObj('mockedLambdaHelper', ['getCloudedFunctionFromFunction', 'getCloudedFunctionFromModule']),
		originalLambdaHelper = lambdaws.__get__('_lambdaHelper');
		lambdaws.__set__('_resolvePathFromParent', function(p) { return p; })
		lambdaws.__set__('_lambdaHelper', mockedLambdaHelper);
	});

	afterEach(function() {
		lambdaws.__set__('_lambdaHelper', originalLambdaHelper);
	});

	it('Can take a function reference and parameters overwrite', function() {
		lambdaws.create(dumbAsyncFunction, { test: 'ok' });
		expect(mockedLambdaHelper.getCloudedFunctionFromFunction).toHaveBeenCalledWith(dumbAsyncFunction, { test: 'ok' });
	});

	it('Can take a module path and a function name and deps and parameters overwrite', function() {
		lambdaws.create('path/to/module', 'handler', ['rewire'], {test: 'ok'});
		expect(mockedLambdaHelper.getCloudedFunctionFromModule).toHaveBeenCalledWith('path/to/module', 'handler', ['rewire'], {test: 'ok'});
	});

	it('Can take only a module path and deps and parameters overwrite', function() {
		lambdaws.create('path/to/module', ['rewire'], {test: 'ok'});
		expect(mockedLambdaHelper.getCloudedFunctionFromModule).toHaveBeenCalledWith('path/to/module', null, ['rewire'], {test: 'ok'});
	});
});

describe("Lambdaization", function() {
	var originalLambdaize, mockedLambdaize, mockedAWS,
		originalUpload, mockedUpload, lambdaHelper;

	beforeEach(function() {
		mockedAWS = createSpyObj('mockedAWS', ['Lambda']);
		mockedLambdaize = createSpy('mockedLambdaize');
		mockedUpload = createSpy('mockedUpload');

		originalLambdaize = LambdaHelper.__get__('_lambdaize');
		originalUpload = LambdaHelper.__get__('_uploadFunctionAsync');

		LambdaHelper.__set__('_lambdaize', mockedLambdaize);
		LambdaHelper.__set__('_uploadFunctionAsync', mockedUpload);

		lambdaHelper = new LambdaHelper(mockedAWS);
	});

	afterEach(function() {
		LambdaHelper.__set__('_lambdaize', originalLambdaize);
		LambdaHelper.__set__('_uploadFunctionAsync', originalUpload);
	})

	it('should intitialize aws lambda SDK', function(){
		expect(mockedAWS.Lambda).toHaveBeenCalled();
	});

	it('should Lambdaize when called the first time', function(){
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction);
		expect(mockedLambdaize).toHaveBeenCalled();
		expect(mockedUpload).toHaveBeenCalled();
	});

	it('should Lambdaize only once on multiple calls', function(){
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction);
		lambdaHelper.getCloudedFunctionFromFunction(dumbAsyncFunction);

		expect(mockedLambdaize.calls.count()).toEqual(1);
	});
});
