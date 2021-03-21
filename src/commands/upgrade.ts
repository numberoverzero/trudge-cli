import { BaseApplyCommand } from '../base-cmd'
import { OutputFlags } from '@oclif/parser'
import chalk from 'chalk'

export class Upgrade extends BaseApplyCommand {
  static description = 'apply an upgrade to the database'
  static aliases = ['up']

  static args = [...BaseApplyCommand.args]
  static flags = { ...BaseApplyCommand.flags }

  async run(): Promise<void> {
    const flags = this.flags as OutputFlags<typeof BaseApplyCommand.flags>
    if (this.apply(this.migration, 'upgrade', flags.force)) {
      this.log(this.changeLine(this.migration, 'upgrade', { color: true }))
    } else {
      this.log(chalk.green('up to date'))
    }
  }
}
