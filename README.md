![logo](./logo50x50.png) Lambdaws
====================================

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/mentum/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://img.shields.io/travis/mentum/lambdaws.svg?style=flat)](https://travis-ci.org/mentum/lambdaws)

Lambdaws makes it trivial to build highly scalable with high availability applications. Built on top of AWS Lambda. The goal of Lambdaws is to remove friction when using Lambda and make it easy to cloudify any function.

## Features

- Automatic function zipping and uploading to AWS Lambda
- Supports external dependencies
- Real-time function results using SQS long polling
- Automatic instrumentation of your module prior uploading to Lambda
- Doesn't require any code change to your library / module
- Change detection in your code and automatic re-upload at first run

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

The same [constraints](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) imposed by AWS Lambda apply. Your function should also be stateless and independant of the underlying architecture. Be also aware that any variable that your function uses must be declared by your function. Global and outer scope variables are not uploaded to AWS Lambda.
