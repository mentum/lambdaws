var rewire = require('rewire'),
	lambda = rewire("../lib/main.js");

describe("Lambdaization", function() {
	var originalLambdaize, mockedLambdaize;

	var dumbAsyncFunction = function(callback) {callback()};

	beforeEach(function() {
		originalLambdaize = lambda.__get__('_lambdaize');
		mockedLambdaize = createSpy('mockedLambdaize');

		lambda.__set__({
			_lambdaize: mockedLambdaize
		});
	})

	afterEach(function() {
		lambda.__set__({
			_lambdaize: originalLambdaize
		});
	})

	it("Lambdaize when called the first time", function() {

		lambda.create(dumbAsyncFunction);
		expect(mockedLambdaize).toHaveBeenCalled();

	})

})
