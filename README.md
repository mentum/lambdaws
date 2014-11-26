# Lambdaws
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/EFF/lambdaws?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

(todo: add Travis CI)

Lambdaws makes it trivial to build highly scalable, high availability applications. Built on top of AWS Lambda.

## Installation

```npm install lambdaws```

## Usage

```λ``` can take an async function returning a promise and deploys it to AWS Lambda. If you call cloudedFunction it will be runned in the cloud.

```
var λ = require('lambdaws');

var normalAsyncFunction = function() {/* returns promise */};

var cloudedFunction = λ(normalAsyncFunction);

cloudedFunction.then(function(data) { console.log(data); });

```

```λ``` can take a function accepting a callback and deploys it to AWS Lambda. If you call cloudedFunction it will be runned in the cloud.

```
var λ = require('lambdaws');

var normalFunction = function(args, callback) {...};

var cloudedFunction = λ(normalFunction);

cloudedFunction(args, function(data) {
	console.log(data);
});

```

### Overriding default settings

```
λ(yourFunc, {
	memory: 256, // mb
	description: 'Description of your function',
	timeout: 10 // seconds
});
```

### Setting your AWS credentials

```
λ.config({
	accessKeyId: '',
	secretKey: ''
});
```

Your AWS user credentials must have access to Lambda, SQS and S3.
