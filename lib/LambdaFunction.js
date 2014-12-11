module.exports = function(userFunc){
    function _lambda (event, context) {
        var executionSucceeded = true,
            executionError = null;
        // TODO (Next iteration) Move requires elsewhere
        var AWS_sdk = require('aws-sdk'),
            sqs_svc = new AWS_sdk.SQS();

        function _sendToSqs(data, afterSentCallback) {
            // TODO (Next iteration) Check MessageBody length and upload to S3 if too lengthy
            var params = {
                MessageBody: JSON.stringify(data),
                QueueUrl: event.sqsQueueUrl
            };
            sqs_svc.sendMessage(params, function(err) {
                if(err) console.log('Error sending response to sqs'); 
                afterSentCallback();
            });
        }

         function _newCallback(err) {
            var finishExecution = function() { context.done(null, "Lambdaws done"); };
            if(typeof(err) !== 'undefined' && err.isFaulty) {
                _sendToSqs({success: false, data: err, requestId: event.requestId}, finishExecution);
            } 
            else {
                _sendToSqs({success: true, data: arguments, requestId: event.requestId}, finishExecution);
            }
        }

        event.args.push(_newCallback);

        var func = /*user function*/null;

        try {
            func.apply(this, event.args);
        }
        catch(error) {
            _newCallback({isFaulty: true, stack: error.stack, message: error.message});
        }
    }

    return _lambda.toString().replace('/*user function*/null', userFunc.toString());
}