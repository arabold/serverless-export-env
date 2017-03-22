"use strict";

const _ = require("lodash");

/**
 * Copies environment variables into a string ready for wrtiting to a file
 * 
 * @param {String[]} envVars - Environment Variables
 * @returns {String}
 */
function transformEnvVarsToString(envVars) {

	const output = _.map(envVars, (value, key) => {
		return `${key}=${value}`;
	});

	return output.join("\r\n");
}

module.exports = transformEnvVarsToString;
