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
  // const envVars = _.mapValues(
  //   _.mapKeys(functions, (func) => func.name),
  //   (func) => func.environment
  // );
  const envVars = _.mapValues(functions, (func) => func.environment);
  return envVars;
}

module.exports = collectFunctionEnvVariables;
