### Important note : this library is good with the first aws lambda API. Most of the features are now built-in Lambda. We strongly recommend you to use the [AWS Lambda CLi](http://docs.aws.amazon.com/cli/latest/reference/lambda/index.html) to deploy your functions and interact with Lambda. Thanks for the suppport.

![logo](./logo50x50.png) Lambdaws
====================================

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/mentum/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Build Status](https://img.shields.io/travis/mentum/lambdaws.svg?style=flat)](https://travis-ci.org/mentum/lambdaws)

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
- [Install large required system libraries like phantomjs](https://github.com/mentum/lambdaws/blob/master/README.md#using-large-external-libraries)
- Detect execution timeouts and throw an appropriate error when it occurs

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

### Using large external libraries

You can tell Lambdaws to download and install system libraries. An example of library is phantomjs. The available libraries can be found on [this repository](https://github.com/mentum/lambdaws-libs). Feel free to make pull requests to add new libraries. The reason for this feature is that lambda has max upload size of 30Mb.

```js
var cloudedBrowser = λ(
	'./my_module_depending_on_phantomjs', // Relative path to module
	'functionNameInsideModule', // The name of the function in the module. Optional if module returns a function.
	['Q', ':phantomjs'], // External libraries are prepended with ":"
	{ name : 'PhantomJSExample' } // Settings override
);
```

### Overriding default settings

```js
λ(yourFunc, {
	name: '', // (string) defaults to 'default'
	memory: '256', // (string) defaults to '128'
	description: 'Description of your function', // (string) defaults to ''
	timeout: 10, // (int, seconds) defaults to 3 seconds,
	ignoreResponse: true // Will not send results back to SQS, function will run ~ 150ms faster
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

The lambda function will run in the `role` specified. It must be an ARN of the IAM role that has `s3:GetObject`, `sqs:SendMessage`, `lambda:InvokeFunction`, and `logs:*` allowed. The `AWSLambdaExecute` managed policy can be used in place of `lambda:InvokeFunction`.  Your lambda functions may require additional permissions on the `role` if they use other AWS services.

The `credentials` must be for a user that can has allowed policies for `sqs:CreateQueue`, `sqs:DeleteMessage` and `lambda:*` actions.

### Full working example

See ```example/example.js```

### Upload functions using the Command Line Interface (CLI)

Documentation needed. See ```bin/lambdaws-cli.js``` for implementation and usage.

## Limitations

The same [constraints](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) imposed by AWS Lambda apply. Your function should also be stateless and independent of the underlying architecture. Be also aware that any variable that your function uses must be declared by your function. Global and outer-scope variables are not uploaded to AWS Lambda.

## Roadmap

[Public Trello Board](https://trello.com/b/V8OrXkFa/lambda)

## Contributions
This repo is in early stage so don't be shy and report bugs if you find some.
Contributions are more than welcomed! Please visit the Trello Board to vote and see which cards are the most in-demand. When you decide to tackle a card, please move it to the according list, assign it to yourself, and make a pull request.
