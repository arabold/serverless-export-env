"use strict";

const BbPromise = require("bluebird");

function listExports(AWS, exports, nextToken) {
  exports = exports || [];
  return BbPromise.resolve(AWS.request("CloudFormation", "listExports", { NextToken: nextToken }))
    .then((response) => {
      exports.push.apply(exports, response.Exports);
      if (response.NextToken) {
        // Query next page
        return listExports(AWS, exports, response.NextToken);
      }
    })
    .then(() => exports);
}

function listStackResources(AWS, resources, nextToken) {
  resources = resources || [];
  return BbPromise.resolve(
    AWS.request("CloudFormation", "listStackResources", {
      StackName: AWS.naming.getStackName(),
      NextToken: nextToken,
    })
  )
    .then((response) => {
      resources.push.apply(resources, response.StackResourceSummaries);
      if (response.NextToken) {
        // Query next page
        return listStackResources(AWS, resources, response.NextToken);
      }
    })
    .then(() => resources);
}

function describeStack(AWS) {
  return BbPromise.resolve(
    AWS.request("CloudFormation", "describeStacks", {
      StackName: AWS.naming.getStackName(),
    })
  ).then((response) => {
    return response.Stacks[0];
  });
}

module.exports = {
  listExports,
  listStackResources,
  describeStack,
};
