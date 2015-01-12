var rewire = require('rewire'),
	lambdaws = rewire('../lib/lambdaws'),
	LambdaHelper = rewire("../lib/LambdaHelper");


describe("Function arguments", function() {
	var originalLambdaHelper, mockedLambdaHelper;

	beforeEach(function() {
		mockedLambdaHelper = createSpyObj('mockedLambdaHelper', ['getCloudedFunctionFromFunction', 'getCloudedFunctionFromModule']),
		originalLambdaHelper = lambdaws.__get__('_lambdaHelper');
		lambdaws.__set__('_lambdaHelper', mockedLambdaHelper);
	});

	afterEach(function() {
		lambdaws.__set__('_lambdaHelper', originalLambdaHelper);
	});

	it('Can take a function reference and parameters overwrite', function() {
		var dumbAsyncFunction = function(callback) {callback()};

		lambdaws.create(dumbAsyncFunction, ['dep'], { test: 'ok' });

		expect(mockedLambdaHelper.getCloudedFunctionFromFunction).toHaveBeenCalledWith(dumbAsyncFunction, ['dep'], { test: 'ok' });
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
