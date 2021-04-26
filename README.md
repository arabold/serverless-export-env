# ⚡️ Serverless Export Env Plugin

[![serverless](https://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)
[![license](https://img.shields.io/github/license/arabold/serverless-export-env.svg)](https://github.com/arabold/serverless-export-env/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)

## About

The [Serverless Framework](https://www.serverless.com/) offers a very powerful feature: You are able to reference AWS resources anywhere from within your `serverless.yml` and it will automatically resolve them to their respective values during deployment. However, this only works properly once your code is deployed to AWS. The _Serverless Export Env Plugin_ extends the Serverless Framework's built-in variable resultion capabilities by adding support many additional CloudFormation intrinsic functions (`Fn::GetAtt`, `Fn::Join`, `Fn::Sub`, etc.) as well as variable references (`AWS::Region`, `AWS::StackId`, etc.).

The _Serverless Export Env Plugin_ helps solve two main use cases:

1. It will automatically hook into the `sls invoke local` and `sls offline start` (see [Serverless Offline Plugin](https://github.com/dherault/serverless-offline)) and help resolve your environment variables. This is fully transparent to your application and other plugins.
2. Invoke `sls export-env` from command line to generate a `.env` file on your local filesystem. Then use a library such as [dotenv](https://www.npmjs.com/package/dotenv) to import it into your code, e.g. during local integration tests.

## Usage

Add the npm package to your project:

```sh
# Via yarn
$ yarn add arabold/serverless-export-env@2.0.0-alpha.0 --dev

# Via npm
$ npm install arabold/serverless-export-env@2.0.0-alpha.0 --save-dev
```

Add the plugin to your `serverless.yml`. It should be the first to ensure it can resolve your environment variables before other plugins see them:

```yaml
plugins:
  - serverless-export-env
```

That's it! You can now call `sls export-env` in your terminal to generate the `.env` file based on your Serverless configuration. Or, you can just run `sls invoke local -f FUNCTION` or `sls offline start` to run your code locally as usual.

### Examples

```sh
serverless export-env
```

This will export all global environment variables into a `.env` file in your project root folder.

```sh
serverless export-env --function MyFunction --filename .env-MyFunction
```

This will export all environment variables of the `MyFunction` Lambda function into a `.env-MyFunction` file in your project root folder.

## Referencing CloudFormation resources

The Serverless Framework offers a very powerful feature: You are able to reference AWS resources anywhere from within your `serverless.yml` and it will automatically resolve them to their respective values during deployment. However, Serverless' built-in variable resolution is very limited and will not work properly when run locally. The _Serverless Export Env Plugin_ extends this functionality and automatically resolves most [intrinsic functions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html) and initializes your local environment properly.

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

### Examples

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

You can then access the environment variable in your code the usual way (e.g. `process.env.S3_BUCKET_URL`).

## Configuration

The plugin supports various configuration options under `custom.export-env` in your `serverless.yml` file:

```yaml
custom:
  export-env:
    filename: .env
    overwrite: false
    enableOffline: true
```

### Configuration Options

| Option         | Default | Description                                                                                          |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| filename       | `.env`  | Target file name where to write the environment variables to, relative to the project root.          |
| enableOffline  | `true`  | Evaluate the environment variables when running `sls invoke local` or `sls offline start`.           |
| overwrite      | `false` | Overwrite the file even if it exists already.                                                        |
| refMap         | `{}`    | A mapping of [resource resolutions](#Custom-Resource-Resoluition) for the `Ref` function             |
| getAttMap      | `{}`    | A mapping of [resource resolutions](#Custom-Resource-Resoluition) for the `Fn::GetAtt` function      |
| importValueMap | `{}`    | A mapping of [resource resolutions](#Custom-Resource-Resoluition) for the `Fn::ImportValue` function |

### Custom Resource Resolution

The plugin will try its best to resolve resource references like `Ref`, `Fn::GetAtt`, and `Fn::ImportValue` for you. However, in sometimes this might fail or you might want to use mocked values instead. In those cases, you can override those values using the `refMap`, `getAttMap` and `importValueMap` options.

- `refMap` takes a mapping of _resource name_ to _value_ pairs.
- `getAttMap` takes a mapping of _resource name_ to _attribute/value_ pairs.
- `importValueMap` takes a mapping of _import name_ to _value_ pairs.

```yaml
custom:
  export-env:
    refMap:
      # Resolve `!Ref MyDbTable` as `mock-myTable`
      MyDbTable: "mock-myTable"
    getAttMap:
      # Resolve `!GetAtt ElasticSearchInstance.DomainEndpoint` as `localhost:9200`
      ElasticSearchInstance:
        DomainEndpoint: "localhost:9200"
    importValueMap:
      # Resolve `!ImportValue OtherLambdaFunction` as `arn:aws:lambda:us-east-2::function:other-lambda-function`
      OtherLambdaFunction: "arn:aws:lambda:us-east-2::function:other-lambda-function"
```

## Command Line Options

Running `sls export-env` will by default only export _global_ environment variables into your `.env` file (those defined under `provider.environment` in your `serverless.yml`). If you want to generate the `.env` file for a specific function, pass the function name as a command line argument as follows:

```sh
sls export-env --function hello --filename .env-hello
```

| Option    | Description                                                                                 |
| --------- | ------------------------------------------------------------------------------------------- |
| filename  | Target file name where to write the environment variables to, relative to the project root. |
| overwrite | Overwrite the file even if it exists already.                                               |
| function  | Name of a function for which to generate the .env file for.                                 |

## Provided lifecycle events

- `export-env:collect` - Collect environment variables from Serverless
- `export-env:resolve` - Resolve CloudFormation references and import variables
- `export-env:apply` - Set environment variables when testing Lambda functions locally
- `export-env:write` - Write environment variables to file

## Migrating from 1.x to 2.x

- Running `sls invoke local` or `sls offline start` will no longer create or update your `.env` file. If you want to create an `.env` file, simply run `sls export-env` instead.
- By default the plugin will no longer overwrite any existing `.env` file. To enable overwriting existing files either specific `--overwrite` in the command line or set the `custom.export-env.overwrite` configuration option.
- Resource `Outputs` values (`resources.Resources.Outputs.*`) are no longer exported automatically. This has always been a workaround and causes more problems than it actually solved. The plugin will try its best to resolve `Fn::GetAtt` and other references for you now, so there should be little need for the old behavior anymore. Add the desired value new environment variable to `provider.environment` instead.
- Running `sls export-env` will no longer merge the environment variables of all functions into a single `.env` file. Instead pass the name of the desired function as `--function` argument to the command line. If no function is specified, only global environment variables will be exported.
- The configuration options `filename` and `pathFromRoot` have been merged to `filename` now. You can specify relative paths in `filename` now such as `./dist/.env`. Make sure the target folder exists!

## Releases

### 2.0.0

- Complete rewrite of the variable resolver. We use the amazing [cfn-resolver-lib](https://github.com/robessog/cfn-resolver-lib) lib now. This allows us to support not only `Ref` and `Fn::ImportValue` as in previous releases, but we're able to resolve the most commonly used intrinsic functions automatically now.

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
