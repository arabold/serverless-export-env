"use strict";

const _ = require("lodash"),
  BbPromise = require("bluebird"),
  fs = require("fs"),
  path = require("path"),
  dotenv = require("dotenv");

const collectFunctionEnvVariables = require("./lib/collectFunctionEnvVariables");
const setEnvVariables = require("./lib/setEnvVariables");
const collectOfflineEnvVariables = require("./lib/collectOfflineEnvVariables");
const resolveCloudFormationEnvVariables = require("./lib/resolveCloudFormationEnvVariables");
const transformEnvVarsToString = require("./lib/transformEnvVarsToString");
const collectResourcesOutputs = require("./lib/collectResourcesOutputs");
const collectStackOutputs = require("./lib/collectStackOutputs");

/**
 * Serverless Plugin to extract Serverless' Lambda environment variables into
 * a local .env file for integration testing.
 */
class ExportEnv {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      "export-env": {
        usage: "Exports your Serverless environment variables to a .env file ",
        lifecycleEvents: ["collect", "resolve", "apply", "write"],
      },
    };

    this.isOfflineHooked = false;
    this.hooks = {
      "before:offline:start:init": this.initOfflineHook.bind(this),
      "before:offline:start": this.initOfflineHook.bind(this),
      "before:invoke:local:invoke": this.initOfflineHook.bind(this),
      "export-env:collect": this.collectEnvVars.bind(this),
      "export-env:resolve": this.resolveEnvVars.bind(this),
      "export-env:apply": this.applyEnvVars.bind(this),
      "export-env:write": this.writeEnvVars.bind(this),
    };

    this.environmentVariables = {};
    this.envFileName = ".env";
  }

  initOfflineHook() {
    if (!this.isOfflineHooked) {
      this.isOfflineHooked = true;
      return this.serverless.pluginManager.run(["export-env"]);
    }
    return BbPromise.resolve();
  }

  collectEnvVars() {
    return BbPromise.try(() => {
      const envVars = {};

      if (!this.isOfflineHooked) {
        collectStackOutputs(this.serverless).then((stackOutputs) => {
          // collect Resources Outputs
          const resourcesOutputs = collectResourcesOutputs(this.serverless, stackOutputs);
          _.assign(envVars, resourcesOutputs);
        });
      }

      // collect global environment variables
      const globalEnvironment = this.serverless.service.provider.environment;
      _.assign(envVars, globalEnvironment);

      // collect environment variables of functions
      const functionEnvironment = collectFunctionEnvVariables(this.serverless);
      _.assign(envVars, functionEnvironment);

      // collect environment variables for serverless offline
      if (this.isOfflineHooked) {
        const offlineEnvVars = collectOfflineEnvVariables(this.serverless, this.options);
        _.assign(envVars, offlineEnvVars);
      }

      process.env.SLS_DEBUG && this.serverless.cli.log(`Found ${_.size(envVars)} environment variable(s)`);
      this.environmentVariables = envVars;
      return BbPromise.resolve();
    });
  }

  resolveEnvVars() {
    if (!this.isOfflineHooked) {
      // resolve environment variables referencing CloudFormation
      return resolveCloudFormationEnvVariables(this.serverless, this.environmentVariables)
        .then((resolved) => (this.environmentVariables = resolved))
        .return();
    }
  }

  applyEnvVars() {
    return BbPromise.try(() => {
      // If this is a local lambda invoke, replace the service environment with the resolved one
      if (this.isOfflineHooked) {
        setEnvVariables(this.serverless, this.environmentVariables);
      }
    });
  }

  writeEnvVars() {
    return BbPromise.try(() => {
      process.env.SLS_DEBUG && this.serverless.cli.log("Writing .env file");

      const params = _.get(this.serverless, "service.custom.export-env");

      let filename = this.envFileName;
      let pathFromRoot = "";

      if (params != null) {
        if (params.filename != null) filename = params.filename;
        if (params.pathFromRoot != null) pathFromRoot = params.pathFromRoot;
      }

      const envFilePath = path.resolve(this.serverless.config.servicePath, pathFromRoot, filename);

      if (params.overwrite === false) {
        process.env.SLS_DEBUG && this.serverless.cli.log('overwrite=false, preserving existing values in ENV file.');
        let envFile;
        try { envFile = fs.readFileSync(envFilePath); } catch(e) {}
        if (envFile) {
          const existingVariables = dotenv.parse(Buffer.from(envFile), { debug: true });
          this.environmentVariables = _.assign(
            existingVariables,
            this.environmentVariables, // Takes precedence
          );
        }
      }

      const envDocument = transformEnvVarsToString(this.environmentVariables);

      fs.writeFileSync(envFilePath, envDocument);
    });
  }
}

module.exports = ExportEnv;
