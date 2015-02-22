module.exports.getCallback = function(event, context) {
	
	function _newCallback(arg) {
	    context.done(null, "Lambdaws DONE");
	}

	return _newCallback;
};
