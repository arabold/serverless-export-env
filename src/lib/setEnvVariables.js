"use strict";

const _ = require("lodash");

/**
 * Set Serverless environment variables for local invocations
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Map<String>} environment - Resolved environment
 */
function setEnvVariables(serverless, environment) {
  const functions = _.get(serverless, "service.functions", {});

  // Set the function environment for all functions that define one
  _.each(_.keys(functions), (funcName) => {
    const funcEnv = functions[funcName].environment;

    if (funcEnv) {
      _.assign(
        funcEnv,
        _.reduce(
          funcEnv,
          (acc, value, key) => {
            acc[key] = environment[key];
            return acc;
          },
          {}
        )
      );
    }
  });

  // Set the global environment
  _.assign(serverless.service.provider.environment, environment);
  _.extend(process.env, environment);
}

module.exports = setEnvVariables;
