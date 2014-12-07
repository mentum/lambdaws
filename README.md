![logo](./logo50x50.png) Lambdaws
====================================

[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/mentum/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

(todo: add Travis CI)

Lambdaws makes it trivial to build highly scalable with high availability applications. Built on top of AWS Lambda.

## Installation

```npm install lambdaws```

## Usage

```λ``` can take an async function returning a promise and deploy it to AWS Lambda. If you call cloudedFunction it will run in the cloud.

```js
var λ = require('lambdaws').create;

var normalAsyncFunction = function() {/* returns promise */};

var cloudedFunction = λ(normalAsyncFunction);

cloudedFunction().then(function(data) { console.log(data); });
```

```λ``` can take a function accepting a callback and deploy it to AWS Lambda. If you call cloudedFunction it will run in the cloud.

```js
var λ = require('lambdaws').create;

var normalFunction = function(args, callback) {...};

var cloudedFunction = λ(normalFunction);

cloudedFunction(args, function(data) {
	console.log(data);
});
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
	accessKeyId: '',
	secretKey: ''
});
```

Your AWS user credentials must have access to Lambda, SQS and S3.

## Limitations

The same [constraints](http://docs.aws.amazon.com/lambda/latest/dg/limits.html) imposed by AWS Lambda apply. Your function should also be stateless and independant of the underlying architecture. Be also aware that any variable that your function uses must be declared by your function. Global and outer scope variables are not uploaded to AWS Lambda.
