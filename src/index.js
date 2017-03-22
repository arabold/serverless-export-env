"use strict";

const _ = require("lodash")
	, BbPromise = require("bluebird")
	, fs = require("fs")
	, path = require("path");

const collectFunctionEnvVariables = require("./lib/collectFunctionEnvVariables");
const collectOfflineEnvVariables = require("./lib/collectOfflineEnvVariables");
const resolveCloudFormationEnvVariables = require("./lib/resolveCloudFormationEnvVariables");
const transformEnvVarsToString = require("./lib/transformEnvVarsToString");

/**
 * Serverless Plugin to extract Serverless' Lambda environment variables into
 * a local .env file for integration testing.
 */
class ServerlessDotenvPlugin {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;

		this.commands = {
			"export-env": {
				usage: "Exports your Serverless environment variables to a .env file ",
				lifecycleEvents: [
					"collect",
					"resolve",
					"write"
				]
			}
		};

		this.isOfflineHooked = false;
		this.hooks = {
			"before:offline:start:init": this.initOfflineHook.bind(this),
			"before:offline:start": this.initOfflineHook.bind(this),
			"export-env:collect": this.collectEnvVars.bind(this),
			"export-env:resolve": this.resolveEnvVars.bind(this),
			"export-env:write": this.writeEnvVars.bind(this)
		};

		this.environmentVariables = {};
		this.envFileName = ".env";
	}

	initOfflineHook() {
		this.isOfflineHooked = true;

		this.serverless.pluginManager.run([ "export-env" ]);
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
		// resolve environment variables referencing CloudFormation
		return resolveCloudFormationEnvVariables(this.serverless, this.environmentVariables)
		.then(resolved => this.environmentVariables = resolved)
		.return();
	}

	writeEnvVars() {
		return BbPromise.try(() => {
			process.env.SLS_DEBUG && this.serverless.cli.log("Writing .env file");
			const envFilePath = path.resolve(this.serverless.config.servicePath, this.envFileName);
			const envDocument = transformEnvVarsToString(this.environmentVariables);

			fs.writeFileSync(envFilePath, envDocument);
		});
	}

}

module.exports = ServerlessDotenvPlugin;
