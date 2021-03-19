trudge-cli
==========

sqlite migration tool

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/trudge-cli.svg)](https://npmjs.org/package/trudge-cli)
[![Downloads/week](https://img.shields.io/npm/dw/trudge-cli.svg)](https://npmjs.org/package/trudge-cli)
[![License](https://img.shields.io/npm/l/trudge-cli.svg)](https://github.com/numberoverzero/trudge-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g trudge-cli
$ trudge COMMAND
running command...
$ trudge (-v|--version|version)
trudge-cli/0.0.0 linux-x64 node-v15.11.0
$ trudge --help [COMMAND]
USAGE
  $ trudge COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`trudge hello [FILE]`](#trudge-hello-file)
* [`trudge help [COMMAND]`](#trudge-help-command)

## `trudge hello [FILE]`

describe the command here

```
USAGE
  $ trudge hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ trudge hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/numberoverzero/trudge-cli/blob/v0.0.0/src/commands/hello.ts)_

## `trudge help [COMMAND]`

display help for trudge

```
USAGE
  $ trudge help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_
<!-- commandsstop -->
