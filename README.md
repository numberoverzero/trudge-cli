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
trudge-cli/1.0.0 linux-x64 node-v15.11.0
$ trudge --help [COMMAND]
USAGE
  $ trudge COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`trudge downgrade DATABASEFILE MIGRATIONFILE`](#trudge-downgrade-databasefile-migrationfile)
* [`trudge help [COMMAND]`](#trudge-help-command)
* [`trudge new FILE`](#trudge-new-file)
* [`trudge sync DATABASEFILE [MIGRATIONSDIR]`](#trudge-sync-databasefile-migrationsdir)
* [`trudge upgrade DATABASEFILE MIGRATIONFILE`](#trudge-upgrade-databasefile-migrationfile)

## `trudge downgrade DATABASEFILE MIGRATIONFILE`

apply a downgrade to the database

```
USAGE
  $ trudge downgrade DATABASEFILE MIGRATIONFILE

ARGUMENTS
  DATABASEFILE   sqlite database file
  MIGRATIONFILE  the migration to apply

OPTIONS
  -f, --force        force the migration to apply regardless of database state
  -h, --help         show CLI help
  -t, --table=table  [default: trudge_migrations] table name that tracks migration state
  -v, --verbose      write verbose database to stdout
  --log=log          file to write verbose database log

ALIASES
  $ trudge down

EXAMPLES
  $ trudge downgrade my.db migrations/01.hello_world.sql
  downgrade:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)
  $ trudge downgrade my.db migrations/01.hello_world.sql
  up to date
  $ trudge down my.db migrations/01.hello_world.sql -f
  downgrade:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)
```

_See code: [src/commands/downgrade.ts](https://github.com/numberoverzero/trudge-cli/blob/v1.0.0/src/commands/downgrade.ts)_

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

## `trudge new FILE`

create a new migration script from a template

```
USAGE
  $ trudge new FILE

ARGUMENTS
  FILE  path to write new script

OPTIONS
  -h, --help  show CLI help
  --tpl=tpl   path to script template

EXAMPLES
  $ trudge new ./migrations/1.hello_world.sql
  created fa07eb2a0b9c98b9349f8b7c0e2e23d344d55cfe

  $ trudge new ./migrations/1.hello_world.sql --tpl=./migrations/new_template.sql
  created 24dfbf1dc4f95dd849238ac5692d3e3256bf9ede
```

_See code: [src/commands/new.ts](https://github.com/numberoverzero/trudge-cli/blob/v1.0.0/src/commands/new.ts)_

## `trudge sync DATABASEFILE [MIGRATIONSDIR]`

attempt to synchronize the state of the database

```
USAGE
  $ trudge sync DATABASEFILE [MIGRATIONSDIR]

ARGUMENTS
  DATABASEFILE   sqlite database file
  MIGRATIONSDIR  [default: ./migrations/] path to the migrations directory

OPTIONS
  -U, --latest       force latest upgrade to rerun if everything is up to date
  -f, --force        downgrade any unexpected migrations instead of aborting
  -h, --help         show CLI help
  -t, --table=table  [default: trudge_migrations] table name that tracks migration state
  -v, --verbose      write verbose database to stdout
  --log=log          file to write verbose database log

EXAMPLES
  $ trudge sync my.db
  upgrade:001.hello_world.sql
  upgrade:002.add_users_table.sql
  upgrade:400.backfill_users.sql

  $ trudge sync my.db
  up to date

  $ trudge sync my.db -U
  reran upgrade:400.backfill_users.sql

  $ rm migrations/2.add_users_table.sql
  $ trudge sync my.db
  aborting, found 1 unexpected migrations in "my.db"
  002.add_users_table.sql

  $ trudge new migrations/310.backfill_index.sql
  created 4259dd3cbaf8ece27d19515ba5449615d6355472
  $ trudge sync my.db -f
  downgrade:002.add_users_table.sql
  upgrade:310.backfill_index.sql
```

_See code: [src/commands/sync.ts](https://github.com/numberoverzero/trudge-cli/blob/v1.0.0/src/commands/sync.ts)_

## `trudge upgrade DATABASEFILE MIGRATIONFILE`

apply an upgrade to the database

```
USAGE
  $ trudge upgrade DATABASEFILE MIGRATIONFILE

ARGUMENTS
  DATABASEFILE   sqlite database file
  MIGRATIONFILE  the migration to apply

OPTIONS
  -f, --force        force the migration to apply regardless of database state
  -h, --help         show CLI help
  -t, --table=table  [default: trudge_migrations] table name that tracks migration state
  -v, --verbose      write verbose database to stdout
  --log=log          file to write verbose database log

ALIASES
  $ trudge up

EXAMPLES
  $ trudge upgrade my.db migrations/01.hello_world.sql
  upgrade:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)
  $ trudge upgrade my.db migrations/01.hello_world.sql
  up to date
  $ trudge up my.db migrations/01.hello_world.sql -f
  upgrade:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)
```

_See code: [src/commands/upgrade.ts](https://github.com/numberoverzero/trudge-cli/blob/v1.0.0/src/commands/upgrade.ts)_
<!-- commandsstop -->
