"use strict";

const BbPromise = require("bluebird")
	, _ = require("lodash");

/**
 * Resolves CloudFormation references and import variables
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Object[]} envVars - Environment Variables
 * @returns {Promise<String[]>} Resolves with the list of environment variables
 */
function resolveCloudFormationenvVars(serverless, envVars) {

	const AWS = serverless.providers.aws;
	return BbPromise.join(
		AWS.request("CloudFormation", "describeStackResources", { StackName: AWS.naming.getStackName() }),
		AWS.request("CloudFormation", "listExports")
	)
	.spread((resultStackResources, resultExports) => {
		const resources = resultStackResources.StackResources;
		const exports = resultExports.Exports;

		return _.mapValues(envVars, (value, key) => mapValue(value, key));

		function mapValue(value, key) {
			let resolved = value;
			if (_.isObject(value)) {
				if (value.Ref) {
					const resource = _.find(resources, [ "LogicalResourceId", value.Ref ]);
					resolved = _.get(resource, "PhysicalResourceId", null);
					process.env.SLS_DEBUG && key && serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(resolved)}`);
				}
				else if (value["Fn::ImportValue"]) {
					const importKey = value["Fn::ImportValue"];
					const resource = _.find(exports, [ "Name", importKey ]);
					resolved = _.get(resource, "Value", null);
					process.env.SLS_DEBUG && key && serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(resolved)}`);
				}
				else if (value["Fn::Join"]) {
					resolved = '';
					value["Fn::Join"].forEach((v) => {
						resolved += mapValue(v);
					})
					process.env.SLS_DEBUG && serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(resolved)}`);
				}
				else {
					serverless.cli.log(`WARNING: Failed to resolve environment variable ${key}: ${JSON.stringify(resolved)}`);
				}
			}

			return resolved;
		}
	});
}

module.exports = resolveCloudFormationenvVars;
