"use strict";

function describeStack(AWS, outputs, nextToken) {
  outputs = outputs || [];
  return AWS.request("CloudFormation", "describeStacks", {
    StackName: AWS.naming.getStackName(),
    NextToken: nextToken,
  })
    .then((response) => {
      outputs.push.apply(outputs, response.Stacks[0].Outputs);
      if (response.NextToken) {
        // Query next page
        return describeStack(AWS, outputs, response.NextToken);
      }
    })
    .then(() => outputs);
}

/**
 * Collects CloudFormation stack outputs
 *
 * @param {Serverless} serverless - Serverless Instance
 * @returns {Promise<Array[Map]>} Resolves with the list of outputs
 */
function collectStackOutputs(serverless) {
  const AWS = serverless.providers.aws;

  return describeStack(AWS);
}

module.exports = collectStackOutputs;
