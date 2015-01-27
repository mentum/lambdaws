![logo](./logo50x50.png) Lambdaws
====================================

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/mentum/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://img.shields.io/travis/mentum/lambdaws.svg?style=flat)](https://travis-ci.org/mentum/lambdaws)

Using Amazon's Lambda Service, Lambdaws cloudifies any JavaScript function — including existing libraries — with no extra code. It removes the friction you get when using AWS Lambda directly. The goal of Lambdaws is to make it trivial to build highly scalable, highly available applications.

## AWS Lambda

Update: 01/15/2015

[AWS Lambda Preview is now open to all customers](http://aws.amazon.com/about-aws/whats-new/2015/01/14/aws-lambda-preview-now-open-to-all-aws-customers/). This means everybody can give Lambdaws a try!

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

### Inline functions

```λ``` takes an inline asynchronous function and deploy it to AWS Lambda. If you call cloudedCalculator it will run in the cloud.

This is not the recommended way of working with Lambdaws and should only be used for testing purposes. Modules should be used whenever possible.

Please note that `λ` is used here only for shortening the code and for clarity.

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
cloudedCalculator(5, 2, function(err, data) {
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
	name: '', // (string) defaults to 'default'
	memory: '256', // (string) defaults to '128'
	description: 'Description of your function', // (string) defaults to ''
	timeout: 10 // (int, seconds) defaults to 3 seconds
});
```

### Setting your AWS credentials

You can set your AWS credentials in one of three ways.

1. By default, the AWS SDK looks for credentials in `~/.aws/credentials`. If you do not set anything, lambdaws will use the default profile. For more information see [the docs](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Credentials_from_the_Shared_Credentials_File_____aws_credentials_).

2. You can use a [different profile](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html#Using_Profiles_with_the_SDK):

   ```js
   var lambdaws = require('lambdaws');

   lambdaws.config({
       credentials: 'my-profile',  // string, profile name.
       role: '' // ** Required **
   });

   lambdaws.start();
   ```

3. You can set the access and secret keys manually:

   ```js
   var lambdaws = require('lambdaws');

   lambdaws.config({
       credentials: {
           accessKey: '',  // string, AWS AccessKeyId.
           secretKey: '',  // string, AWS AccessKeySecret.
       },
       role: '' // ** Required **
   });

   lambdaws.start();
   ```

The `role` is a ARN of the IAM role that AWS Lambda can assume to push to SQS, S3 and any other AWS services you are using inside your Lambda function. You need to give the role those policies.

### Full working example

See ```example/example.js```

## Limitations

The same [constraints](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) imposed by AWS Lambda apply. Your function should also be stateless and independent of the underlying architecture. Be also aware that any variable that your function uses must be declared by your function. Global and outer-scope variables are not uploaded to AWS Lambda.

## Roadmap

[Public Trello Board](https://trello.com/b/V8OrXkFa/lambda)

## Contributions
This repo is in early stage so don't be shy and report bugs if you find some.
Contributions are more than welcomed! Please visit the Trello Board to vote and see which cards are the most in-demand. When you decide to tackle a card, please move it to the according list, assign it to yourself, and make a pull request.
