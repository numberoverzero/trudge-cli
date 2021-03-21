import { BaseDbCommand, colorMode } from '../base-cmd'
import { DEFAULT_MIGRATION_DIRECTORY_NAME } from '../constants'
import { synchronizeMigrations, SynchronizeState } from '../core'
import { flags } from '@oclif/command'
import chalk from 'chalk'

export default class Sync extends BaseDbCommand {
  static description = 'attempt to synchronize the state of the database'
  static examples = [
    `$ trudge sync my.db
${colorMode('upgrade')}:001.hello_world.sql
${colorMode('upgrade')}:002.add_users_table.sql
${colorMode('upgrade')}:400.backfill_users.sql
`,
    `$ trudge sync my.db
${chalk.green('up to date')}
`,
    `$ trudge sync my.db -U
reran ${colorMode('upgrade')}:400.backfill_users.sql
`,
    `$ rm migrations/2.add_users_table.sql
$ trudge sync my.db
${chalk.red('aborting, found 1 unexpected migrations in "my.db"')}
002.add_users_table.sql
`,
    `$ trudge new migrations/310.backfill_index.sql
created 4259dd3cbaf8ece27d19515ba5449615d6355472
$ trudge sync my.db -f
${colorMode('downgrade')}:002.add_users_table.sql
${colorMode('upgrade')}:310.backfill_index.sql
`,
  ]

  static flags = {
    ...BaseDbCommand.flags,
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

  static args = [
    ...BaseDbCommand.args,
    {
      name: 'migrationsDir',
      required: false,
      description: 'path to the migrations directory',
      default: `./${DEFAULT_MIGRATION_DIRECTORY_NAME}/`,
    },
  ]

  async run(): Promise<void> {
    const { args, flags } = this.parse(Sync)

    const state = synchronizeMigrations(this.db, this.migrationTableName, args.migrationsDir, {
      abortOnUnexpected: !flags.force,
      forceLatestIfSynchronized: flags.latest,
      verbose: this.logVerbose,
    })
    const idLength = _lengthOfLongestId(state)

    // aborted on unexpected
    if (!flags.force && state.before.unexpected.length > 0) {
      const unexpected = state.before.unexpected
      const ids = unexpected
        .slice()
        .reverse()
        .map((m) => `${m.id.toString().padStart(idLength, '0')}.${m.name}.sql`)
        .join('\n')
      this.log(
        chalk.red(
          `aborting, found ${unexpected.length} unexpected migrations in "${this.db.name}"`,
        ) + `\n${ids}`,
      )
      this.exit(1)
    }

    // no changes
    if (state.changes.length === 0) {
      this.log(chalk.green('up to date'))
      this.exit(0)
    }

    const lineOpts = { pad: idLength, color: true }

    // reran last?
    if (flags.latest && state.changes.length === 1 && state.before.shared.length > 0) {
      const changeId = state.changes[0][0].id
      const lastSharedId = state.before.shared[state.before.shared.length - 1].id
      // don't emit on any random change
      if (lastSharedId === changeId) {
        this.log(`reran ${this.changeLine(...state.changes[0], lineOpts)}`)
        this.exit()
      }
    }

    // describe all changes
    state.changes.forEach((change) => this.log(this.changeLine(...change, lineOpts)))
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
