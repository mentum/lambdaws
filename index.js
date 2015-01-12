// Convenience file to require the lib from the root of the repository
module.exports = require('./lib/lambdaws');

// Required to disable module caching for this module
// Lambdaws can't be cached because it needs to know it's real module parent
// so we can resolve relative paths correctly
delete require.cache[__filename];