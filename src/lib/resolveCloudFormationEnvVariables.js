"use strict";

const BbPromise = require("bluebird"),
  _ = require("lodash");

function listExports(AWS, exports, nextToken) {
  exports = exports || [];
  return AWS.request("CloudFormation", "listExports", { NextToken: nextToken })
    .tap((response) => {
      exports.push.apply(exports, response.Exports);
      if (response.NextToken) {
        // Query next page
        return listExports(AWS, exports, response.NextToken);
      }
    })
    .return(exports);
}

function listStackResources(AWS, resources, nextToken) {
  resources = resources || [];
  return AWS.request("CloudFormation", "listStackResources", {
    StackName: AWS.naming.getStackName(),
    NextToken: nextToken,
  })
    .then((response) => {
      resources.push.apply(resources, response.StackResourceSummaries);
      if (response.NextToken) {
        // Query next page
        return listStackResources(AWS, resources, response.NextToken);
      }
    })
    .return(resources);
}

/**
 * Resolves CloudFormation references and import variables
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Object[]} envVars - Environment Variables
 * @returns {Promise<String[]>} Resolves with the list of environment variables
 */
function resolveCloudFormationenvVars(serverless, envVars) {
  const AWS = serverless.providers.aws;
  return BbPromise.join(listStackResources(AWS), listExports(AWS)).spread((resources, exports) => {
    function mapValue(value) {
      if (_.isObject(value)) {
        if (value.Ref) {
          if (value.Ref === "AWS::Region") {
            return AWS.getRegion();
          } else if (value.Ref === "AWS::AccountId") {
            return AWS.getAccountId();
          } else if (value.Ref === "AWS::StackId") {
            return _.get(_.first(resources), "StackId");
          } else if (value.Ref === "AWS::StackName") {
            return AWS.naming.getStackName();
          } else {
            const resource = _.find(resources, ["LogicalResourceId", value.Ref]);
            const resolved = _.get(resource, "PhysicalResourceId", null);
            if (_.isNil(resolved)) {
              serverless.cli.log(`WARNING: Failed to resolve reference ${value.Ref}`);
            }
            return BbPromise.resolve(resolved);
          }
        } else if (value["Fn::ImportValue"]) {
          const importKey = value["Fn::ImportValue"];
          const resource = _.find(exports, ["Name", importKey]);
          const resolved = _.get(resource, "Value", null);
          if (_.isNil(resolved)) {
            serverless.cli.log(`WARNING: Failed to resolve import value ${importKey}`);
          }
          return BbPromise.resolve(resolved);
        } else if (value["Fn::Join"]) {
          // Join has two Arguments. first the delimiter and second the values
          const delimiter = value["Fn::Join"][0];
          const parts = value["Fn::Join"][1];
          return BbPromise.map(parts, (v) => mapValue(v)).then((resolvedParts) => _.join(resolvedParts, delimiter));
        }
      }

      return BbPromise.resolve(value);
    }

    return BbPromise.reduce(
      _.keys(envVars),
      (result, key) => {
        return BbPromise.resolve(mapValue(envVars[key])).then((resolved) => {
          process.env.SLS_DEBUG &&
            serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(resolved)}`);
          result[key] = resolved;
          return BbPromise.resolve(result);
        });
      },
      {}
    );
  });
}

module.exports = resolveCloudFormationenvVars;
