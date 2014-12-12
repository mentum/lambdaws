var rewire = require('rewire'),
	LambdaHelper = rewire("../lib/LambdaHelper");

describe("Lambdaization", function() {
	var originalLambdaize, mockedLambdaize, mockedAWS,
		originalUpload, mockedUpload, lambdaHelper;

	var dumbAsyncFunction = function(callback) {callback()};

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
		lambdaHelper.getCloudedFunction(dumbAsyncFunction);
		expect(mockedLambdaize).toHaveBeenCalled();
		expect(mockedUpload).toHaveBeenCalled();
	});

	it('should Lambdaize only once on multiple calls', function(){
		lambdaHelper.getCloudedFunction(dumbAsyncFunction);
		lambdaHelper.getCloudedFunction(dumbAsyncFunction);

		expect(mockedLambdaize.calls.count()).toEqual(1);
	});
});
