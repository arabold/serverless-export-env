"use strict";

const BbPromise = require("bluebird"),
  _ = require("lodash"),
  NodeEvaluator = require("cfn-resolver-lib");

function resolveGetAtt(refs, resource) {
  // TODO: While this code was created in good intention (isn't it all?), it doesn't work in the current form.
  // There's no AWS API that can help resolve !GetAtt automatically and some attributes are impossible to
  // determine without retrieving additional details of the resource, e.g. using an additional API call.
  // So, for now, we completely disable this variable resolution mechanism and rely of hardcoding the `getAttMap`
  // in the config instead.
  // Please note that the code below doesn't work properly.

  // const Partition = refs["AWS::Partition"];
  // const Region = refs["AWS::Region"];
  // const AccountId = refs["AWS::AccountId"];
  // switch (resource.ResourceType) {
  //   case "AWS::Lambda::Function":
  //     return {
  //       Arn: `arn:${Partition}:lambda:${Region}:${AccountId}:function:${resource.PhysicalResourceId}`,
  //       FunctionName: resource.PhysicalResourceId,
  //     };
  //   case "AWS::SNS::Topic":
  //     return { TopicName: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::SQS::Queue":
  //     return { QueueName: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::CloudWatch::Alarm":
  //     return { AlarmName: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::EC2::Subnet":
  //     return { SubnetId: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::EC2::VPC":
  //     return { VpcId: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::S3::Bucket":
  //     return { BucketName: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::EC2::SecurityGroup":
  //     return { SecurityGroupId: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::DynamoDB::Table":
  //     return { TableName: _.last(_.split(resource.PhysicalResourceId, ":")) };
  //   case "AWS::IAM::Role":
  //     return { Arn: `arn:${Partition}:iam::${AccountId}:role/${resource.PhysicalResourceId}` };
  //   case "AWS::ApiGateway::RestApi":
  //     return { RootResourceId: resource.PhysicalResourceId };
  // }

  return resource;
}

function resolveResources(AWS, stack, resources, exports, toBeResolved, maps) {
  return BbPromise.all([AWS.getRegion(), AWS.getAccountId()]).spread((region, accountId) => {
    const node = _.assign({}, { toBeResolved });
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
          values[resource.LogicalResourceId] = resolveGetAtt(refResolvers, resource);
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
 * @param {Object[]} envVars - Environment Variables to resolve
 * @returns {Promise<String[]>} Resolves with the list of resolves environment variables
 */
function resolveCloudFormationEnvVars(serverless, envVars, stack, resources, exports, maps) {
  const AWS = serverless.providers.aws;
  return resolveResources(AWS, stack, resources, exports, envVars, maps).then((resolved) => {
    process.env.SLS_DEBUG &&
      _.map(resolved, (value, key) =>
        serverless.cli.log(`Resolved environment variable ${key}: ${JSON.stringify(value)}`, "export-env")
      );
    return BbPromise.resolve(resolved);
  });
}

module.exports = resolveCloudFormationEnvVars;
