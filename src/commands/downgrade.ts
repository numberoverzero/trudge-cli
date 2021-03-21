import { BaseApplyCommand } from '../base-cmd'
import { OutputFlags } from '@oclif/parser'
import chalk from 'chalk'

export class Downgrade extends BaseApplyCommand {
  static description = 'apply a downgrade to the database'
  static aliases = ['down']

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
