var Q = require('q'),
    rx = require('rx');

module.exports = function (aws, executions){
    var sqs = new aws.SQS(),
        _sqsMessages = new rx.Subject(),
        _initialized = false,
        _sqsQueueUrl = '',
        executions = executions;

    this.initializedDeferred = Q.defer();

    var self = this;
    function _startPickingUpSQSMessages (sqsQueueUrl, rxQueue) {
        rxQueue
            .distinct(function (x) {
                return x.MessageId;
            })
            .subscribe(function (x) {
                var body = JSON.parse(x.Body);

                if (executions.hasOwnProperty(body.requestId)) {
                    // TODO (version 2) Get result from S3 if length > 256kb
                    // TODO If callback wasn't handled, exit early
                    var callArgs = [];
                    for (var i in body.data) {
                        callArgs.push(body.data[i]);
                    }
                    executions[body.requestId].apply(this, callArgs);
                    delete executions[body.requestId];

                    sqs.deleteMessage({
                        QueueUrl: sqsQueueUrl,
                        ReceiptHandle: x.ReceiptHandle
                    }, function (err, data) {
                        if (err) console.log("SQS Deletion failed", x.MessageId); // TODO Handle error gracefully
                    });
                }
            });
    };

    function _startListeningToSQS(sqsQueueUrl, rxQueue) {

        var params = {
            QueueUrl: sqsQueueUrl,
            MaxNumberOfMessages: 10
        };

        var recursiveSQSCall = function () {
            sqs.receiveMessage(params, function (err, data) {
                for (var i in data.Messages) {
                    rxQueue.onNext(data.Messages[i]);
                }
                recursiveSQSCall(); // <-- Recurse point
            });
        };

        recursiveSQSCall();
    };

    this.startQueue = function (startedCallback) {
        // TODO : move this in the function invocation ?
        if (_initialized) throw "Already initialized";

        var params = {
            QueueName: settings.sqsQueueName,
            Attributes: {
                MaximumMessageSize: '262144',
                ReceiveMessageWaitTimeSeconds: '20',
            }
        };

        sqs.createQueue(params, function (err, data) {
            if (err) {
                if (typeof(startedCallback) === 'function')
                    startedCallback(err);
                return;
            }

            _sqsQueueUrl = data.QueueUrl;
            _startListeningToSQS(_sqsQueueUrl, _sqsMessages);
            _startPickingUpSQSMessages(_sqsQueueUrl, _sqsMessages);
            _initialized = true;
            self.initializedDeferred.resolve(_sqsQueueUrl);

            if (typeof(startedCallback) === 'function') startedCallback();
        });
    };
};
