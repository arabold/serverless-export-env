"use strict";

const _ = require("lodash");

/**
 * Collects Serverless Outputs resources
 *
 * @param {Serverless} serverless - Serverless Instance
 * @returns {String[]} Returns a list of environment variables
 */
function collectResorucesOutputs(serverless) {

	const outputs = _.get(serverless, "service.resources.Outputs", []);	
	const envVars = {};

	_.each(_.keys(outputs), key => {
		 const value = outputs[key].Value;
		 let envVarKey  = _.toUpper(_.snakeCase(key));
		 let envVar ={[envVarKey] : value};
	 	_.assign(envVars, envVar);
	});

	return envVars;
}

module.exports = collectResorucesOutputs;
