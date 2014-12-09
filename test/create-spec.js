var rewire = require('rewire'),
	lambda = rewire("../lib/main.js");

describe("Lambdaization", function() {
	var originalLambdaize, mockedLambdaize,
		originalUpload, mockedUpload;

	var dumbAsyncFunction = function(callback) {callback()};

	beforeEach(function() {
		mockedLambdaize = createSpy('mockedLambdaize');
		mockedUpload = createSpy('mockedUpload');

		originalLambdaize = lambda.__get__('_lambdaize');
		originalUpload = lambda.__get__('_uploadFunctionAsync');

		lambda.__set__('_lambdaize', mockedLambdaize);
		lambda.__set__('_uploadFunctionAsync', mockedUpload);
	})

	afterEach(function() {
		lambda.__set__('_lambdaize', originalLambdaize);
		lambda.__set__('_uploadFunctionAsync', originalUpload);
	})

	it("Lambdaize when called the first time", function() {

		lambda.create(dumbAsyncFunction);
		expect(mockedLambdaize).toHaveBeenCalled();
		expect(mockedUpload).toHaveBeenCalled();
	})

})
