import { BaseApplyCommand, colorMode } from '../base-cmd'
import { OutputFlags } from '@oclif/parser'
import chalk from 'chalk'

export class Downgrade extends BaseApplyCommand {
  static description = 'apply a downgrade to the database'
  static aliases = ['down']
  static examples = [
    `$ trudge downgrade my.db migrations/01.hello_world.sql
${colorMode('downgrade')}:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)`,
    `$ trudge downgrade my.db migrations/01.hello_world.sql
${chalk.green('up to date')}`,
    `$ trudge down my.db migrations/01.hello_world.sql -f
${colorMode('downgrade')}:1.hello_world.sql (a86c88c86fd3a2c0245e96294538b5c7b766697f)`,
  ]

  static args = [...BaseApplyCommand.args]
  static flags = { ...BaseApplyCommand.flags }

  async run(): Promise<void> {
    const flags = this.flags as OutputFlags<typeof BaseApplyCommand.flags>
    if (this.apply(this.migration, 'downgrade', flags.force)) {
      this.log(this.changeLine(this.migration, 'downgrade', { color: true }))
    } else {
      this.log(chalk.green('up to date'))
    }
  }
}
