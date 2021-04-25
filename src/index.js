"use strict";

const _ = require("lodash"),
  BbPromise = require("bluebird"),
  fs = require("fs"),
  path = require("path");

const collectFunctionEnvVariables = require("./lib/collectFunctionEnvVariables");
const resolveCloudFormationEnvVariables = require("./lib/resolveCloudFormationEnvVariables");
const setEnvVariables = require("./lib/setEnvVariables");
const transformEnvVarsToString = require("./lib/transformEnvVarsToString");

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
    this.filename = ".env";
    this.enableOffline = true;
    this.overwriteExisting = true;
    this.refMap = {};
    this.getAttMap = {};
    this.importValueMap = {};
  }

  loadConfig() {
    const params = _.get(this.serverless, "service.custom.export-env");
    this.filename = _.get(params, "filename", this.filename);
    this.enableOffline = _.get(params, "enableOffline", this.enableOffline);
    this.overwriteExisting = _.get(params, "overwriteExisting", this.overwriteExisting);
    this.refMap = _.get(params, "refMap", this.refMap);
    this.getAttMap = _.get(params, "getAttMap", this.getAttMap);
    this.importValueMap = _.get(params, "importValueMap", this.importValueMap);
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

      // collect global environment variables
      const globalEnvironment = this.serverless.service.provider.environment;
      _.assign(envVars, globalEnvironment);

      // collect environment variables of functions
      const functionEnvironment = collectFunctionEnvVariables(this.serverless);
      _.assign(envVars, functionEnvironment);

      process.env.SLS_DEBUG && this.serverless.cli.log(`Found ${_.size(envVars)} environment variable(s)`);
      this.environmentVariables = envVars;
      return BbPromise.resolve();
    });
  }

  resolveEnvVars() {
    return resolveCloudFormationEnvVariables(this.serverless, this.environmentVariables, {
      refMap: this.refMap,
      getAttMap: this.getAttMap,
      importValueMap: this.importValueMap,
    })
      .then((resolved) => (this.environmentVariables = resolved))
      .return();
  }

  applyEnvVars() {
    return BbPromise.try(() => {
      this.loadConfig();

      // If this is a local lambda invoke, replace the service environment with the resolved one
      if (this.isOfflineHooked && this.enableOffline) {
        setEnvVariables(this.serverless, this.environmentVariables);
      }
    });
  }

  writeEnvVars() {
    return BbPromise.try(() => {
      this.loadConfig();

      const envFilePath = path.resolve(this.serverless.config.servicePath, this.filename);
      if (this.isOfflineHooked) {
        // not writing anything by default
      } else if (!fs.existsSync(envFilePath) || this.overwriteExisting) {
        process.env.SLS_DEBUG && this.serverless.cli.log(`Writing ${this.filename} file`);

        const envDocument = transformEnvVarsToString(this.environmentVariables);
        fs.writeFileSync(envFilePath, envDocument);
      } else {
        process.env.SLS_DEBUG && this.serverless.cli.log(`${this.filename} already exists. Leaving it untouched.`);
      }
    });
  }
}

module.exports = ExportEnv;
