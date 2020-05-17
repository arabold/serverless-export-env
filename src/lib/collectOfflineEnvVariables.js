"use strict";

const _ = require("lodash");

/**
 * Collects environment variables from the Serverless Offline Plugin
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Object[]} cliOptions - Command line options
 * @returns {String[]} Returns a list of environment variables
 */
function collectOfflineEnvVariables(serverless, cliOptions) {
  // Based on serverless offline (https://github.com/dherault/serverless-offline/blob/master/src/index.js)

  const defaultOptions = {
    host: "localhost",
    port: 3000,
    httpsProtocol: "",
    prefix: "/",
  };

  const serverlessConfigOptions = _.get(serverless, "service.custom.serverless-offline", {});
  const options = _.assign({}, defaultOptions, serverlessConfigOptions, cliOptions);

  // Prefix must start and end with "/"
  if (!_.startsWith(options.prefix, "/")) options.prefix = `/${options.prefix}`;
  if (!_.endsWith(options.prefix, "/")) options.prefix += "/";

  const protocol = options.httpsProtocol.length > 0 ? "https" : "http";

  return {
    IS_OFFLINE: true,
    API_ENDPOINT: `${protocol}://${options.host}:${options.port}${options.prefix}`,
  };
}

module.exports = collectOfflineEnvVariables;
