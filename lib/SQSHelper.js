var Q = require('q'),
    rx = require('rx');

module.exports = function (aws, executions){
    var sqs = new aws.SQS(),
        _sqsMessages = new rx.Subject(),
        _sqsQueueUrl = '',
        _initializedDeferred = Q.defer();
        executions = executions;

    this.initializedPromise = _initializedDeferred.promise;
    this.initialized = false;


    var _startPickingUpSQSMessages = function (sqsQueueUrl, rxQueue) {
        rxQueue
            .distinct(function (x) {
                return x.MessageId;
            })
            .subscribe(function (x) {
                var body = JSON.parse(x.Body);

                if (executions.hasOwnProperty(body.requestId)) {
                    // TODO (version 2) Get result from S3 if length > 256kb
                    // TODO If callback wasn't handled, exit early

                    if(body.success) {
                        executions[body.requestId].apply(this, [false, body.data]);
                    } else {
                        executions[body.requestId].apply(this, [body.data, null]);    
                    }

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

    var _startListeningToSQS = function (sqsQueueUrl, rxQueue) {

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

    var _createQueueCallback = function(err, data){
        if (err) throw Error(err);

        _sqsQueueUrl = data.QueueUrl;
        _startListeningToSQS(_sqsQueueUrl, _sqsMessages);
        _startPickingUpSQSMessages(_sqsQueueUrl, _sqsMessages);
        this.initialized = true;
        _initializedDeferred.resolve(_sqsQueueUrl);
    }

    this.startQueue = function (startedCallback) {
        // TODO : move this in the function invocation ?
        // console.log(this.initialized);
        // if (_initialized) throw "Already initialized";

        var params = {
            QueueName: settings.sqsQueueName,
            Attributes: {
                MaximumMessageSize: '262144',
                ReceiveMessageWaitTimeSeconds: '20',
            }
        };
        sqs.createQueue(params, _createQueueCallback.bind(this));
    };
};
