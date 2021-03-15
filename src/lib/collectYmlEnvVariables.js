"use strict";

const _ = require("lodash");

/**
 * Collects environment variables defined in serverless.yml
 *
 * @param {Serverless} serverless - Serverless Instance
 * @returns {String[]} Returns a list of environment variables
 */
function collectYmlEnvVariables(serverless, envVars) {

  const params = _.get(serverless, "service.custom.export-env");
  const ignoreKeys = params.ignoreEnvironmentKeys ? params.ignoreEnvironmentKeys.split(',') : null;

  // collect global environment variables
  const globalEnvironment = serverless.service.provider.environment;
  removeIgnoreVariables(ignoreKeys, globalEnvironment);
  _.assign(envVars, globalEnvironment);

  // collect environment variables of functions
  const functionEnvironment = collectFunctionEnvVariables(serverless);
  removeIgnoreVariables(ignoreKeys, functionEnvironment);
  _.assign(envVars, functionEnvironment);

}

function collectFunctionEnvVariables(serverless) {
  const functions = _.get(serverless, "service.functions", {});
  const envVars = {};

  _.each(_.keys(functions), (func) => {
    const functionEnvVars = functions[func].environment;
    _.assign(envVars, functionEnvVars);
  });

  return envVars;
}

function removeIgnoreVariables(ignoreKeys, variables) {
  if (!ignoreKeys) {
    return;
  }
  Object.keys(variables).forEach(function(key) {
    if(ignoreKeys.indexOf(key) !== -1) {
      delete variables[key];
    }
  });

}

module.exports = collectYmlEnvVariables;
