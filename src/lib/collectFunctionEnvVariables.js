"use strict";

const _ = require("lodash");

/**
 * Collects Serverless function specific environment variables
 *
 * @param {Serverless} serverless - Serverless Instance
 * @returns {String[]} Returns a list of environment variables
 */
function collectFunctionEnvVariables(serverless) {
	const functions = _.get(serverless, "service.functions", {});
	const envVars = {};

	_.each(_.keys(functions), func => {
		const functionEnvVars = functions[func].environment;
		_.assign(envVars, functionEnvVars);
	});

	return envVars;
}

module.exports = collectFunctionEnvVariables;
