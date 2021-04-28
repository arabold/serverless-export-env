"use strict";

const _ = require("lodash"),
  BbPromise = require("bluebird"),
  fs = require("fs"),
  path = require("path");

const collectFunctionEnvVariables = require("./lib/collectFunctionEnvVariables");
const resolveCloudFormationEnvVariables = require("./lib/resolveCloudFormationEnvVariables");
const transformEnvVarsToString = require("./lib/transformEnvVarsToString");
const { listExports, listStackResources, describeStack } = require("./lib/aws-helper");

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
        options: {
          function: {
            usage: 'Specify the function for which you want to generate the .env file (e.g. "--function myFunction")',
            shortcut: "f",
            required: false,
            type: "string",
          },
          all: {
            usage: 'Merge environment variables of all functions into a single .env file (e.g. "--all")',
            required: false,
            type: "boolean",
          },
          filename: {
            usage: 'Name of output file (e.g. "--filename .env")',
            shortcut: "p",
            required: false,
            type: "string",
          },
          overwrite: {
            usage: 'Overwrite existing file (e.g. "--overwrite")',
            required: false,
            type: "boolean",
          },
        },
      },
    };

    this.isOfflineHooked = false;
    this.hooks = {
      "before:offline:start:init": this.initOfflineHook.bind(this),
      "before:offline:start": this.initOfflineHook.bind(this),
      // We monkey-patch the AWS plugin instead; so the `invoke:local:invoke` is not needed anymore
      // "before:invoke:local:invoke": this.initOfflineHook.bind(this),
      "export-env:collect": this.collectEnvVars.bind(this),
      "export-env:resolve": this.resolveEnvVars.bind(this),
      "export-env:apply": this.setEnvVars.bind(this),
      "export-env:write": this.writeEnvVars.bind(this),
    };

    this.globalEnvironmentVariables = {};
    this.functionEnvironmentVariables = {};
    this.filename = _.get(options, "filename", ".env");
    this.enableOffline = true;
    this.overwrite = _.get(options, "overwrite", false);
    this.refMap = {};
    this.getAttMap = {};
    this.importValueMap = {};
    this.isEnabled = true; // will be set in `_loadConfig()` below

    // Monkey-patch `AwsInvokeLocal` plugin to support our custom variable resolution
    const AwsInvokeLocal = serverless.pluginManager.plugins.find(
      (plugin) => plugin.constructor.name === "AwsInvokeLocal"
    );
    if (AwsInvokeLocal) {
      const loadEnvVarsOriginal = AwsInvokeLocal.loadEnvVars.bind(AwsInvokeLocal);
      AwsInvokeLocal.loadEnvVars = () => {
        return this.initOfflineHook().then(() => loadEnvVarsOriginal());
      };
    }
  }

  _loadConfig() {
    const params = _.get(this.serverless, "service.custom.export-env");
    this.filename = _.get(params, "filename", this.filename);
    this.enableOffline = _.get(params, "enableOffline", this.enableOffline);
    this.overwrite = _.get(params, "overwrite", this.overwrite);
    this.refMap = _.get(params, "refMap", this.refMap);
    this.getAttMap = _.get(params, "getAttMap", this.getAttMap);
    this.importValueMap = _.get(params, "importValueMap", this.importValueMap);

    // `true` if the plugin should run, `false` otherwise
    this.isEnabled = !this.isOfflineHooked || this.enableOffline;
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
      this._loadConfig();
      if (!this.isEnabled) {
        return BbPromise.resolve();
      }

      // collect environment variables
      this.globalEnvironmentVariables = this.serverless.service.provider.environment || {};
      this.functionEnvironmentVariables = collectFunctionEnvVariables(this.serverless);

      return BbPromise.resolve();
    });
  }

  resolveEnvVars() {
    return BbPromise.try(() => {
      this._loadConfig();
      if (!this.isEnabled) {
        return BbPromise.resolve();
      }

      const sls = this.serverless;
      const AWS = this.serverless.providers.aws;
      const globalEnv = this.globalEnvironmentVariables;
      const maps = {
        refMap: this.refMap,
        getAttMap: this.getAttMap,
        importValueMap: this.importValueMap,
      };
      return BbPromise.all([describeStack(AWS), listStackResources(AWS), listExports(AWS)]).then(
        ([stack, resources, exports]) => {
          // Resolve global and function environment variables
          return BbPromise.all([
            resolveCloudFormationEnvVariables(sls, globalEnv, stack, resources, exports, maps).then(
              (resolved) => (this.globalEnvironmentVariables = resolved)
            ),
            BbPromise.all(
              _.map(this.functionEnvironmentVariables, (funcEnv, funcName) =>
                resolveCloudFormationEnvVariables(sls, funcEnv, stack, resources, exports, maps).then(
                  (resolved) => (this.functionEnvironmentVariables[funcName] = resolved)
                )
              )
            ),
          ]).return();
        }
      );
    });
  }

  setEnvVars() {
    return BbPromise.try(() => {
      this._loadConfig();
      if (!this.isEnabled || !this.isOfflineHooked) {
        // This code does only run when offline but not when executed via `export-env`
        return BbPromise.resolve();
      }

      // If this is a local lambda invoke, replace the service environment with the resolved one
      process.env.SLS_DEBUG && this.serverless.cli.log(`Updating serverless environment variable(s)`, "export-env");
      this.serverless.service.provider.environment = this.globalEnvironmentVariables;
      if (_.has(this.serverless, "service.functions")) {
        _.forEach(
          this.serverless.service.functions,
          (func, key) => (func.environment = this.functionEnvironmentVariables[key])
        );
      }
    });
  }

  writeEnvVars() {
    return BbPromise.try(() => {
      this._loadConfig();
      if (!this.isEnabled || this.isOfflineHooked) {
        // This code does not run when offline but only when executed via `export-env`
        return BbPromise.resolve();
      }

      const envFilePath = path.resolve(this.serverless.config.servicePath, this.filename);
      if (!fs.existsSync(envFilePath) || this.overwrite) {
        process.env.SLS_DEBUG && this.serverless.cli.log(`Writing ${this.filename} file`, "export-env");

        const envVars = _.clone(this.globalEnvironmentVariables);
        if (this.options.all) {
          _.forEach(this.functionEnvironmentVariables, (vars) => _.assign(envVars, vars));
        } else if (this.options.function) {
          _.assign(envVars, this.functionEnvironmentVariables[this.options.function]);
        }
        const envDocument = transformEnvVarsToString(envVars);

        fs.writeFileSync(envFilePath, envDocument);
      } else {
        process.env.SLS_DEBUG &&
          this.serverless.cli.log(`${this.filename} already exists. Leaving it untouched.`, "export-env");
      }
    });
  }
}

module.exports = ExportEnv;
