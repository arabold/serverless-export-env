# ⚡️ Serverless Export Env Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)
[![license](https://img.shields.io/github/license/arabold/serverless-export-env.svg)](https://github.com/arabold/serverless-export-env/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-export-env.svg)](https://www.npmjs.com/package/serverless-export-env)


## About

This Serverless plugin exports the environment variables defined in `serverless.yml`
into a distinct `.env` file. This allows you to access these environment variables
from local scripts such as for integration tests. You will find the `.env` file
in the root folder of your project.

It will collect the global environment variables of the poject as well as all
environment variables of the functions. It will also add `API_ENDPOINT` and
`IS_OFFLINE` to your environment if you run the plugin via `serverless offline`.

Environment variables referencing CloudFormation resources (e.g. `Ref: MyDynamoDbTable`),
or import values (e.g. `Fn::ImportValue: MyExportedValue`) are automatically
resolved to their respective values. This, however, requires the stack to be
deployed before the plugin can access any of these variables.

This plugin is based on the [serverless-dotenv Plugin by Jimdo](https://github.com/Jimdo/serverless-dotenv)
but largely rewritten to fit our needs.


## Why another plugin?

There're plenty of enviroment and dotenv plugins available for Serverless. However,
some are already obsolete, others are very limited in use case. We needed a possibility
to access Serverless environment variables from command line during integration
testing of our code. As some of these environment variables are referencing
CloudFormation resources, none of the existing plugins was able to solve this.


## Referencing CloudFormation resources

Serverless offers a very powerful feature: You are able to reference AWS
resources anywhere from within your `.yaml` and it will automatically resolve
them to their respective values during deployment. A common example is to
bind a DynamoDB table name to an environment variable, so you can access it
in your Lambda function implementation later:

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

Later in your code you can simply access `process.env.TABLE_NAME` to get the
proper DynamoDB table name without having to hardcode anything.

The _Serverless Export Env Plugin_ allows you to make use of these references
(and all other environment variables of course) from the command line by
exporting them into a `.env` file in your project folder. Then use a library
such as [dotenv](https://www.npmjs.com/package/dotenv) to read them during
runtime.


## Usage

Add the npm package to your project:

```bash
# Via yarn
$ yarn add arabold/serverless-export-env

# Via npm
$ npm install arabold/serverless-export-env --save-dev
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-export-env
```

That's it! You can now call `serverless export-env` in your terminal to
generate the `.env` file based on your Serverless configuration.
Alternative you can just start `serverless offline` to generate it.


## Provided lifecycle events

* `export-env:collect` - Collect environment variables from Serverless
* `export-env:resolve` - Resolve CloudFormation references and import variables
* `export-env:write` - Write environment variables to file


## Example

```bash
serverless export-env
```

This example will export all environment variables into a `.env` file in
your project root folder.


## Releases

### 1.0.0

* This is the initial release with all basic functionality
* TODO: Write some tests!
