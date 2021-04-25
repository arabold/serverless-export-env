"use strict";

const BbPromise = require("bluebird"),
  _ = require("lodash"),
  NodeEvaluator = require("cfn-resolver-lib");

function listExports(AWS, exports, nextToken) {
  exports = exports || [];
  return AWS.request("CloudFormation", "listExports", { NextToken: nextToken })
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
    .then(() => resources);
}

function describeStack(AWS) {
  return AWS.request("CloudFormation", "describeStacks", {
    StackName: AWS.naming.getStackName(),
  }).then((response) => {
    return response.Stacks[0];
  });
}

function resolveAttributes(refs, resource) {
  const Partition = refs["AWS::Partition"];
  const Region = refs["AWS::Region"];
  const AccountId = refs["AWS::AccountId"];
  switch (resource.ResourceType) {
    case "AWS::Lambda::Function":
      return {
        Arn: `arn:${Partition}:lambda:${Region}:${AccountId}:function:${resource.PhysicalResourceId}`,
        FunctionName: resource.PhysicalResourceId,
      };
    case "AWS::SNS::Topic":
      return { TopicName: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::SQS::Queue":
      return { QueueName: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::CloudWatch::Alarm":
      return { AlarmName: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::EC2::Subnet":
      return { SubnetId: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::EC2::VPC":
      return { VpcId: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::S3::Bucket":
      return { BucketName: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::EC2::SecurityGroup":
      return { SecurityGroupId: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::DynamoDB::Table":
      return { TableName: _.last(_.split(resource.PhysicalResourceId, ":")) };
    case "AWS::IAM::Role":
      return { Arn: `arn:${Partition}:lambda:${Region}:${AccountId}:function:${resource.PhysicalResourceId}` };
  }
  return resource;
}

function resolveResources(AWS, stack, resources, exports, toBeResolved, maps) {
  return BbPromise.all([
    AWS.request("CloudFormation", "getTemplate", {
      StackName: AWS.naming.getStackName(),
    }),
    AWS.getRegion(),
    AWS.getAccountId(),
  ]).spread((response, region, accountId) => {
    const template = JSON.parse(response.TemplateBody);
    const node = _.assign({}, template, { toBeResolved });
    const refResolvers = _.merge(
      {
        "AWS::Partition": "aws", // FIXME How to determine correct value?
        "AWS::Region": region,
        "AWS::AccountId": accountId,
        "AWS::StackId": stack.StackId,
        "AWS::StackName": stack.StackName,
      },
      _.reduce(
        resources,
        (values, resource) => {
          values[resource.LogicalResourceId] = resource.PhysicalResourceId;
          return values;
        },
        {}
      ),
      maps.refMap
    );
    const getAttResolvers = _.merge(
      _.reduce(
        resources,
        (values, resource) => {
          values[resource.LogicalResourceId] = resolveAttributes(refResolvers, resource);
          return values;
        },
        {}
      ),
      maps.getAttMap
    );
    const importValueResolvers = _.merge(
      _.reduce(
        exports,
        (values, resource) => {
          values[resource.Name] = resource.Value;
          return values;
        },
        {}
      ),
      maps.importValueMap
    );
    // Pass all resources to allow Fn::GetAtt and Conditions resolution
    const evaluator = new NodeEvaluator(node, {
      RefResolvers: refResolvers,
      "Fn::GetAttResolvers": getAttResolvers,
      "Fn::ImportValueResolvers": importValueResolvers,
    });
    const result = evaluator.evaluateNodes();
    if (result && result.toBeResolved) {
      return result.toBeResolved;
    }

    return {};
  });
}

/**
 * Resolves CloudFormation references and import variables
 *
 * @param {Serverless} serverless - Serverless Instance
 * @param {Object[]} envVars - Environment Variables
 * @returns {Promise<String[]>} Resolves with the list of environment variables
 */
function resolveCloudFormationEnvVars(serverless, envVars, maps) {
  const AWS = serverless.providers.aws;
  return BbPromise.all([describeStack(AWS), listStackResources(AWS), listExports(AWS)])
    .spread((stack, resources, exports) => resolveResources(AWS, stack, resources, exports, envVars, maps))
    .then((resolved) => {
      process.env.SLS_DEBUG &&
        _.map(resolved, (value, key) =>
          serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(value)}`)
        );
      return BbPromise.resolve(resolved);
    });
}

module.exports = resolveCloudFormationEnvVars;
