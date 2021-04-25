# ⚡️ Serverless Export Env Plugin

[![serverless](https://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)
[![license](https://img.shields.io/github/license/arabold/serverless-export-env.svg)](https://github.com/arabold/serverless-export-env/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)

## About

This Serverless plugin exports the environment variables defined in `serverless.yml` into a distinct `.env` file. This allows you to access these environment variables from local scripts such as for integration tests. You will find the `.env` file
in the root folder of your project.

It will collect the global environment variables of the poject as well as all environment variables of the functions. It will also add `API_ENDPOINT` and `IS_OFFLINE` to your environment if you run the plugin via `sls offline`.

Environment variables referencing CloudFormation resources (e.g. `Ref: MyDynamoDbTable`), or import values (e.g. `Fn::ImportValue: MyExportedValue`) are automatically resolved to their respective values. This, however, requires the stack to be
deployed before the plugin can access any of these variables.

This plugin is based on the [serverless-dotenv Plugin by Jimdo](https://github.com/Jimdo/serverless-dotenv) but largely rewritten to fit our needs.

## Why another plugin?

There're plenty of environment and dotenv plugins available for Serverless. However, some are already obsolete, others are very limited in use case. We needed a possibility to access Serverless environment variables from command line during integration testing of our code. As some of these environment variables are referencing CloudFormation resources, none of the existing plugins was able to solve this.

## Referencing CloudFormation resources

Serverless offers a very powerful feature: You are able to reference AWS resources anywhere from within your `serverless.yml` and it will automatically resolve them to their respective values during deployment. A common example is to bind a DynamoDB table name to an environment variable, so you can access it in your Lambda function implementation later:

```yaml
provider:
  environment:
    TABLE_NAME:
      Ref: MyDynamoDbTable
# ...
resources:
  Resources:
    MyDynamoDbTable:
      Type: AWS::DynamoDB::Table
      DeletionPolicy: Retain
      Properties:
        # ...
```

Later in your code you can simply access `process.env.TABLE_NAME` to get the proper DynamoDB table name without having to hardcode anything.

```js
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient({
  /* ... */
});
docClient.get(
  {
    TableName: process.env.TABLE_NAME,
    Key: { foo: "bar" },
  },
  (result) => {
    console.log(result);
  }
);
```

So far, all this works out of the box when being deployed, without the need for this plugin. However, if you try to run the above code locally using `sls invoke local` or `sls offline start`, the `TABLE_NAME` environment variable will not be initialized properly. This is where the _Serverless Export Env Plugin_ comes in. It automatically resolves [intrinsic functions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html) like `Ref` and `Fn::ImportValue` and initializes your local environment properly.

The _Serverless Export Env Plugin_ supports two main use cases:

1. When added to the `plugins` section of your `serverless.yml` without any additional configuration, it will automatically hook into the `sls invoke local` and `sls offline start` (see [Serverless Offline Plugin](https://github.com/dherault/serverless-offline)) and resolve your environment variables.
2. Invoke `sls export-env` from command line to generate a `.env` file on your local filesystem. Then use a library such as [dotenv](https://www.npmjs.com/package/dotenv) to import it into your code.

### Supported instrinsic functions

- Condition Functions
  - `Fn::And`
  - `Fn::Equals`
  - `Fn::If`
  - `Fn::Not`
  - `Fn::Or`
- `Fn::FindInMap`
- `Fn::GetAtt`
- `Fn::GetAZs`
- `Fn::Join`
- `Fn::Select`
- `Fn::Split`
- `Fn::Sub` (at the moment only key-value map subtitution is supported)
- `Fn::ImportValue`
- `Ref`

Example:

```yaml
provider:
  environment:
    S3_BUCKET_URL:
      Fn::Join:
        - ""
        - - https://s3.amazonaws.com/
          - Ref: MyBucket
```

Or the short version:

```yaml
provider:
  environment:
    S3_BUCKET_URL: !Join ["", [https://s3.amazonaws.com/, Ref: MyBucket]]
```

Note that `sls invoke local` will report an error if you're using any function other than `Fn::ImportValue` or `Ref` in your environment variables. This is a Serverless limitation and cannot be fixed by this plugin unfortunately.

## Usage

Add the npm package to your project:

```sh
# Via yarn
$ yarn add arabold/serverless-export-env --dev

# Via npm
$ npm install arabold/serverless-export-env --save-dev
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-export-env
```

That's it! You can now call `sls export-env` in your terminal to generate the `.env` file based on your Serverless configuration. Alternative you can just start `sls invoke local -f FUNCTION` or `sls offline start` to run your code locally without manually creating an `.env` file first.

## Configuration

The plugin supports various configuration options undert `custom.export-env` in your `serverless.yml` file:

```yaml
custom:
  export-env:
    filename: .env
    enableOffline: true
    overwriteExisting: true
```

### Configuration Options

| Option            | Default | Description                                                                                                                                    |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| filename          | `.env`  | Target file name where to write the environment variables to. This is relative to the project root where the `serverless.yml` file is located. |
| enableOffline     | `true`  | Evaluate the environment variables when running `sls invoke local` or `sls offline start`.                                                     |
| overwriteExisting | `true`  | Overwrite the file even if it exists already.                                                                                                  |
| refMap            | `{}`    | A mapping of [resource resolutions](#Resource-Resoluition) for the `Ref` function                                                              |
| getAttMap         | `{}`    | A mapping of [resource resolutions](#Resource-Resoluition) for the `Fn::GetAtt` function                                                       |
| importValueMap    | `{}`    | A mapping of [resource resolutions](#Resource-Resoluition) for the `Fn::ImportValue` function                                                  |
|                   |

### Resource Resoluition

The plugin will try its best to resolve resource references like `Ref`, `Fn::GetAtt`, and `Fn::ImportValue` for you. However, in sometimes this might fail or you might want to use mocked values instead. In those cases, you can override those values using the `refMap`, `getAttMap` and `importValueMap` options.

- `refMap` takes a mapping of _resource name_ to _value_ pairs
- `getAttMap` takes a mapping of _resource name_ to _attribute/value_ pairs
- `importValueMap` takes a mapping of _import name_ to _value_ pairs

```yaml
custom:
  export-env:
    refMap:
      MyDbTable: "mock-myTable"
    getAttMap:
      ElasticSearchInstance:
        DomainEndpoint: "localhost:9200"
    importValueMap:
      OtherLambdaFunction: "arn:aws:lambda:us-east-2::function:other-lambda-function"
```

## Provided lifecycle events

- `export-env:collect` - Collect environment variables from Serverless
- `export-env:resolve` - Resolve CloudFormation references and import variables
- `export-env:apply` - Set environment variables when testing Lambda functions locally
- `export-env:write` - Write environment variables to file

## Example

```sh
serverless export-env
```

This example will export all environment variables into a `.env` file in your project root folder.

### Referencing Another Resource

```yaml
provider:
  environment:
    SNS_NOTIFICATION_TOPIC: !GetAtt MyNotificationTopic.TopicName

resources:
  Resources:
    MyNotificationTopic:
      Type: AWS::SNS::Topic
```

## Migrating from 1.x to 2.x

- Running `sls invoke local` or `sls offline start` will no longer create or update your `.env` file. If you want to create an `.env` file, simply run `sls export-env`.
- Resource `Output` values are no longer exported automatically. This has always been a workaround and causes more problems than it actually solved. The plugin will try its best to resolve `Fn::GetAtt` and other references for you now, so there should be little need for the old behavior anymore.

* The configuration option `filename` and `pathFromRoot` have been merged and renamed to `filename`. You can specify relative paths in `filename` now such as `./dist/.env`. Make sure the target folder exists!

## Releases

### 2.0.0

- Complete rewrite of the variable resolver. We use the amazing [cfn-resolver-lib](https://github.com/robessog/cfn-resolver-lib) lib now. This allows us to support not only `Ref` and `Fn::ImportValue` as in previous releases, but we're able to resolve most commonly used intrinstic functions automatically now.

<details>
<summary>1.x Releases</summary>

### 1.4.4

- Reverted changes in 1.4.1. Unfortunately we broke the semver contract by introducing a breaking feature in a patch update. This feature needs to be rethought and added back in a 1.5.x release as optional. Until then, I had to remove it again.

#### 1.4.3

- Internal version (not published)

### 1.4.2

- Fixed some compatibility issues with the latest Serverless framework release. Thanks to [pgrzesik](https://github.com/pgrzesik) for the necessary updates.

### 1.4.1

- Disabled calls to the real aws infrastructure when running with Serverless Offline. Thanks to marooned071 for the contribution.

### 1.4.0

- Collect and set resource values from actual Cloud Formation stack output. Thanks to [andersquist](https://github.com/andersquist) for his contribution!
- Fix error when serverless.yml doesn't contain a custom section. Thanks to [michael-wolfenden](https://github.com/michael-wolfenden)!

### 1.3.1

- Explicitly set environment variables during local invocation of the Lambda (`sls invoke local`)

### 1.3.0

- Support different output file name and path. Thanks to [philiiiiiipp](https://github.com/philiiiiiipp).
- Export `Outputs` as environment variables. Thanks to [lielran](https://github.com/lielran).
- Updated to latest dependencies

### 1.2.0

- Use operating system-specific end-of-line when creating `.env` file

### 1.1.3

- Fixed an issue with `AWS::AccountId` being resolved as `[Object Promise]` instead of the actual value.

### 1.1.2

- Fixed an issue with CloudFormation resources not being resolved properly if the stack has more than 100 resources or exports.

### 1.1.1

- Fix issue with multiple environment variables for function (thanks to [@Nevon](https://github.com/Nevon)).

### 1.1.0

- Support `Fn::Join` operation (contribution by [@jonasho](https://github.com/jonasho))
- Support pseudo parameters `AWS::Region`, `AWS::AccountId`, `AWS::StackId` and `AWS::StackName`.

### 1.0.2

- The plugin now properly resolves and sets the environment variables if a Lambda function is invoked locally (`sls invoke local -f FUNCTION`). This allows seamless as if the function would be deployed on AWS.

### 1.0.1

- Corrected plugin naming
- Improved documentation

### 1.0.0

- This is the initial release with all basic functionality
</details>
