var AWS = require('aws-sdk');
var utils = require('./_utils');
var sqs_svc = new AWS.SQS();

module.exports.getCallback = function(event, context) {

	function _sendToSqs(data, afterSentCallback) {
	    var params = {
	        MessageBody: JSON.stringify(data),
	        QueueUrl: event.sqsQueueUrl
	    };
	    sqs_svc.sendMessage(params, function(err) {
	        if(err) utils.log('Error sending response to SQS'); 
	        afterSentCallback();
	    });
	}

	function _newCallback(arg) {
	    var finishExecution = function() { context.done(null, "Lambdaws DONE"); };
	    var success = !(arg instanceof utils.LambdaError);
	    _sendToSqs({success: success, data: arg, requestId: context.invokeid}, finishExecution);
	}

	return _newCallback;
};
