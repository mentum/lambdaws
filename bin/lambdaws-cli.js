#!/usr/bin/env node

var dotenv = require('dotenv');
var lambdaws = require('../');
var program = require('commander');

dotenv.load();

var AWS_PROFILE = process.env.AWS_PROFILE;
var AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
var AWS_REGION = process.env.AWS_REGION;
var AWS_ROLE = process.env.AWS_ROLE;

function parseList(val) {
	return val.split(',');
}

program
	.version('0.0.1')
	.description('Deploy a function inside a module to AWS Lambda')
	.usage('[options]')
	.option('-p, --profile [value]', 'AWS Credentials Profile Name', AWS_PROFILE)
	.option('-a, --accessKey [value]', 'AWS Access Key', AWS_ACCESS_KEY_ID)
	.option('-s, --secretKey [value]', 'AWS Secret Key', AWS_SECRET_ACCESS_KEY)
	
	.option('-r, --region [value]', 'AWS Region', AWS_REGION)
	.option('-o, --role [value]', 'Amazon Role', AWS_ROLE)

	.option('-e, --module [value]', 'The path to the module your function resides in')
	.option('-f, --function [value]', 'The exported function name')

	.option('--deps <items>', 'A list of dependencies, separated by commas (Q,async,:phantomjs)', parseList)
	
	.option('-m, --memory [value]', 'The memory the function should be allocated', parseInt)
	.option('-t, --timeout [value]', 'The maximum time the function can run in ms', parseInt)
	.option('-d, --functionDescription [value]', 'Description of the function')
	.option('-n, --functionName [value]', 'The name you give your function')
	
	.parse(process.argv);


var settings = {};
if(program.profile) {
	settings.credentials = program.profile;
} else {
	if(program.accessKey && program.secretKey) {
		settings.credentials = {
			accessKey: program.accessKey,
			secretKey: program.secretKey
		};
	}
}

settings.role = program.role;
settings.region = program.region;

lambdaws.config(settings);

if(!program.function) {
	console.error('--function is a required parameter');
}

if(!program.module) {
	console.error('--module is a required parameter');
}

program.deps = program.deps || [];

var config = {};

if(program.functionName) config.name = program.functionName;
if(program.memory) config.memory = program.memory;
if(program.timeout) config.timeout = program.timeout;
if(program.functionDescription) config.description = program.functionDescription;

lambdaws.create(program.module, program.function, program.deps, config);
