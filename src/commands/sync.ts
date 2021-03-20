import { DEFAULT_MIGRATION_DIRECTORY_NAME, DEFAULT_MIGRATION_TABLE_NAME } from '../constants'
import { Migration, MigrationMode, synchronizeMigrations, SynchronizeState } from '../core'
import { Command, flags } from '@oclif/command'
import Database from 'better-sqlite3'
import chalk from 'chalk'
import fs from 'fs'

export default class Sync extends Command {
  static description = 'attempt to synchronize the state of the database'
  static examples = [
    `$ trudge sync my.db
${_modeColor('upgrade')}:001.hello_world.sql
${_modeColor('upgrade')}:002.add_users_table.sql
${_modeColor('upgrade')}:400.backfill_users.sql
`,
    `$ trudge sync my.db
${chalk.green('up to date')}
`,
    `$ trudge sync my.db -U
reran ${_modeColor('upgrade')}:400.backfill_users.sql
`,
    `$ rm migrations/2.add_users_table.sql
$ trudge sync my.db
${chalk.red('aborting, found 1 unexpected migrations in "my.db"')}
002.add_users_table.sql
`,
    `$ trudge new migrations/310.backfill_index.sql
created 4259dd3cbaf8ece27d19515ba5449615d6355472
$ trudge sync my.db -f
${_modeColor('downgrade')}:002.add_users_table.sql
${_modeColor('upgrade')}:310.backfill_index.sql
`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    migrations: flags.string({
      char: 'm',
      description: 'path to the migrations directory',
      default: `./${DEFAULT_MIGRATION_DIRECTORY_NAME}/`,
    }),
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
    force: flags.boolean({
      char: 'f',
      description: 'downgrade any unexpected migrations instead of aborting',
      default: false,
    }),
    latest: flags.boolean({
      char: 'U',
      description: 'force latest upgrade to rerun if everything is up to date',
      default: false,
    }),
  }

  static args = [{ name: 'databaseFile', required: true, description: 'sqlite database file' }]

  async run(): Promise<void> {
    const { args, flags } = this.parse(Sync)

    let logStream: fs.WriteStream
    if (flags.log) logStream = fs.createWriteStream(flags.log, { flags: 'w', encoding: 'utf-8' })
    const verboseLog = (msg: string) => {
      if (flags.log) logStream.write(msg + '\n', 'utf-8')
      if (flags.verbose) this.log(msg)
    }

    const db = new Database(args.databaseFile, { verbose: verboseLog })

    const state = synchronizeMigrations(db, flags.table, flags.migrations, {
      abortOnUnexpected: !flags.force,
      forceLatestIfSynchronized: flags.latest,
      verbose: verboseLog,
    })
    const idLength = _lengthOfLongestId(state)
    const pad = (id: number) => id.toString().padStart(idLength, '0')

    // aborted on unexpected
    if (!flags.force && state.before.unexpected.length > 0) {
      const unexpected = state.before.unexpected
      const ids = unexpected
        .slice()
        .reverse()
        .map((m) => `${pad(m.id)}.${m.name}.sql`)
        .join('\n')
      this.log(
        chalk.red(
          `aborting, found ${unexpected.length} unexpected migrations in "${args.databaseFile}"`,
        ) + `\n${ids}`,
      )
      this.exit(1)
    }

    // no changes
    if (state.changes.length === 0) {
      this.log(chalk.green('up to date'))
      this.exit(0)
    }

    const describe = ([change, mode]: [Migration, MigrationMode]) => {
      return `${_modeColor(mode)}:${pad(change.id)}.${change.name}.sql`
    }

    // reran last?
    if (flags.latest && state.changes.length === 1 && state.before.shared.length > 0) {
      const changeId = state.changes[0][0].id
      const lastSharedId = state.before.shared[state.before.shared.length - 1].id
      // don't emit on any random change
      if (lastSharedId === changeId) {
        this.log(`reran ${describe(state.changes[0])}`)
        this.exit()
      }
    }

    // describe all changes
    state.changes.forEach((change) => this.log(describe(change)))
    this.exit()
  }
}

function _lengthOfLongestId(state: SynchronizeState): number {
  // this is gross
  const all = [
    ...state.after.missing,
    ...state.after.shared,
    ...state.after.unexpected,
    ...state.before.missing,
    ...state.before.shared,
    ...state.before.unexpected,
    ...state.changes.map(([m]) => m),
  ]
  // ...and we unpack it all **again**
  return Math.max(...all.map((m) => m.id)).toString().length
}

function _modeColor(mode: MigrationMode, msg?: string): string {
  return {
    upgrade: chalk.green,
    downgrade: chalk.red,
  }[mode](msg ?? mode)
}
