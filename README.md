![logo](./logo50x50.png) Lambdaws
====================================

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/mentum/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://img.shields.io/travis/mentum/lambdaws.svg?style=flat)](https://travis-ci.org/mentum/lambdaws)
[![Npm Version](http://img.shields.io/npm/v/lambda-job.svg?style=flat)](http://browsenpm.org/package/lambdaws)

Using Amazon's Lambda Service, Lambdaws cloudifies any JavaScript function — including existing libraries — with no extra code. It removes the friction you get when using AWS Lambda directly. The goal of Lambdaws is to make it trivial to build highly scalable, highly available applications.

## Features

Lambdaws will automatically:
- Create a new SQS Queue for your function
- Instrument your function/module to store the result on that SQS Queue
- Zip your function/module
- Include any dependencies needed from your module in the zip file
- Upload the zip file to AWS Lambda
- Instantly provide your application with the execution result as soon as it is available (by using SQS long-polling)
- Detect any change to your library and re-upload it if needed

Lambdaws will __not__:
- Alter your function or module
- Re-upload the function on every call
- Add much overhead

## Installation

```npm install lambdaws```

## Usage

### Inline functions without dependencies

```λ``` takes an inline asynchronous function and deploy it to AWS Lambda. If you call cloudedCalculator it will run in the cloud.

```js
var λ = require('lambdaws').create;

// A simple inlined asynchronous function computing A + B
var calculator = function(a, b, callback) { 
	callback(a + b);
};

// This will automatically instrument and upload your function to AWS Lambda
var cloudedCalculator = λ(calculator);

// cloudedCalculator is a reference to the function in the cloud.
// Therefore calling this function will invoke it on AWS Lambda rather than locally.
cloudedCalculator(5, 2, function(data) {
	// Automatic instrumentation of the code added a SQS message push of the result
	// the result of the function is then available in real time without polling CloudWatch
	console.log(data); // Prints 7
});
```

### Functions inside modules with external dependencies

```js
var cloudedCalculator = λ(
	'./my_module', // Relative path to module
	'functionNameInsideModule', // The name of the function in the module. Optional if module returns a function.
	['async', 'request'], // External dependencies. Must reside in node_modules for now.
	{ description : 'my custom description' } // Settings override
);
```

### Overriding default settings

```js
λ(yourFunc, {
	memory: 256, // mb
	description: 'Description of your function',
	timeout: 10 // seconds
});
```

### Setting your AWS credentials

```js
var lambdaws = require('lambdaws');

lambdaws.config({
	accessKey: '', // string, AWS AccessKeyId
	secretKey: '', // string, AWS AccessKeySecret
	role: '' // string, AWS ARN. Must have full access to SQS
});

lambdaws.start();
```

Your AWS user credentials must have access to Lambda, SQS and S3.

### Full working example

See ```example/example.js```

## Limitations

The same [constraints](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) imposed by AWS Lambda apply. Your function should also be stateless and independent of the underlying architecture. Be also aware that any variable that your function uses must be declared by your function. Global and outer-scope variables are not uploaded to AWS Lambda.

## Roadmap

[Public Trello Board](https://trello.com/b/V8OrXkFa/lambda)

## Contributions

Contributions are welcomed! Please visit the Trello Board to vote and see which cards are the most in-demand.
When you decide to tackle a card, please move it to the according list, assign it to yourself, and make a pull request.
