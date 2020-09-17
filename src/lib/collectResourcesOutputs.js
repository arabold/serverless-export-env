"use strict";

const _ = require("lodash");

/**
 * Collects Serverless Outputs resources
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Array[Map]} stackOutputs - an array of stack outputs
 * @returns {String[]} Returns a list of environment variables
 */
function collectResourcesOutputs(serverless, stackOutputs = {}) {
  const outputs = _.get(serverless, "service.resources.Outputs", []);
  const envVars = {};

  _.each(_.keys(outputs), (key) => {
    const outputValue = _.find(stackOutputs, ["OutputKey", key]);
    const value =
      outputValue !== undefined && outputValue["OutputValue"] !== undefined
        ? outputValue["OutputValue"]
        : outputs[key].Value;
    const envVarKey = _.toUpper(_.snakeCase(key));
    const envVar = { [envVarKey]: value };
    _.assign(envVars, envVar);
  });

  return envVars;
}

module.exports = collectResourcesOutputs;
