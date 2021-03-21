import { DEFAULT_MIGRATION_TABLE_NAME } from './constants'
import {
  applyMigration,
  canonicalId,
  createMigrationsTable,
  Migration,
  MigrationMode,
  parseMigrationFile,
} from './core'
import { Command, flags } from '@oclif/command'
import { Input, OutputArgs, OutputFlags } from '@oclif/parser'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import chalk from 'chalk'
import fs from 'fs'

export abstract class BaseDbCommand extends Command {
  static flags = {
    help: flags.help({ char: 'h' }),
    table: flags.string({
      char: 't',
      description: 'table name that tracks migration state',
      default: DEFAULT_MIGRATION_TABLE_NAME,
    }),
    log: flags.string({
      description: 'file to write verbose database log',
      default: undefined,
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'write verbose database to stdout',
      default: false,
    }),
  }

  static args = [{ name: 'databaseFile', required: true, description: 'sqlite database file' }]

  protected db!: DatabaseType
  protected migrationTableName!: string
  protected logVerbose: (msg: string) => void = () => {
    /* do nothing */
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected args!: OutputArgs<any>
  protected flags!: OutputFlags<typeof BaseDbCommand.flags>

  async init(): Promise<void> {
    await super.init()
    const { args, flags } = this.parse(this.constructor as Input<typeof BaseDbCommand.flags>)
    this.args = args
    this.flags = flags

    // configure logging
    let logStream: fs.WriteStream
    if (this.flags.log)
      logStream = fs.createWriteStream(this.flags.log, { flags: 'w', encoding: 'utf-8' })
    const verboseLog = (msg: string) => {
      if (this.flags.log) logStream.write(msg + '\n', 'utf-8')
      if (this.flags.verbose) this.log(msg)
    }
    this.logVerbose = verboseLog

    this.db = new Database(this.args.databaseFile, { verbose: verboseLog })
    this.migrationTableName = this.flags.table
  }

  changeLine(
    migration: Migration,
    mode: MigrationMode,
    opts?: { pad?: number; color?: boolean },
  ): string {
    const id = migration.id.toString().padStart(opts?.pad ?? 0, '0')
    const cmode = opts?.color ? colorMode(mode) : mode
    return `${cmode}:${id}.${migration.name}.sql (${canonicalId(migration)})`
  }
}

export abstract class BaseApplyCommand extends BaseDbCommand {
  static flags = {
    ...BaseDbCommand.flags,
    force: flags.boolean({
      char: 'f',
      description: 'force the migration to apply regardless of database state',
      default: false,
    }),
  }
  static args = [
    ...BaseDbCommand.args,
    { name: 'migrationFile', required: true, description: 'the migration to apply' },
  ]

  protected migration!: Migration

  async init(): Promise<void> {
    await super.init()
    const maybeMigration = parseMigrationFile(this.args.migrationFile)
    if (!maybeMigration)
      this.error(
        `malformed filename "${this.args.migrationFile}" should be like 000.description.sql`,
      )
    this.migration = maybeMigration
  }

  apply(migration: Migration, mode: MigrationMode, force: boolean): boolean {
    createMigrationsTable(this.db, this.migrationTableName)
    const id = this.changeLine(migration, mode)
    let res: boolean
    this.logVerbose(`starting ${id}`)
    try {
      res = applyMigration(this.db, this.migrationTableName, migration, mode, force)
    } catch (err) {
      this.logVerbose(`failed ${id}`)
      throw err
    }
    this.logVerbose(`finished ${id}`)
    return res
  }
}

export function colorMode(mode: MigrationMode, msg?: string): string {
  return {
    upgrade: chalk.green,
    downgrade: chalk.red,
  }[mode](msg ?? mode)
}
