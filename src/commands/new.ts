import { DEFAULT_MIGRATION_TEMPLATE, MIGRATION_FILENAME_REGEX } from '../constants'
import { canonicalId, readMigrationsDir, splitTemplate } from '../core'
import { Command, flags } from '@oclif/command'
import fs from 'fs'
import path from 'path'

export default class New extends Command {
  static description = 'create a new migration script from a template'

  static examples = [
    `$ trudge new ./migrations/1.hello_world.sql
created fa07eb2a0b9c98b9349f8b7c0e2e23d344d55cfe
`,
    `$ trudge new ./migrations/1.hello_world.sql --tpl=./migrations/new_template.sql
created 24dfbf1dc4f95dd849238ac5692d3e3256bf9ede
`,
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tpl: flags.string({ description: 'path to script template' }),
  }

  static args = [{ name: 'file', required: true, description: 'path to write new script' }]

  async run(): Promise<void> {
    const { args, flags } = this.parse(New)

    const [id, name] = path.basename(args.file).match(MIGRATION_FILENAME_REGEX) || []
    if (id === null) {
      this.error(
        `malformed filename "${path.basename(args.file)}" should be like 000.description.sql`,
      )
    }
    const tpl = flags.tpl
      ? fs.readFileSync(flags.tpl, { encoding: 'utf-8' })
      : DEFAULT_MIGRATION_TEMPLATE
    const steps = splitTemplate(tpl)
    if (!steps)
      this.error(`malformed template "${flags.tpl}" is missing header '--trudge:downgrade'`)
    const existingMigrations = readMigrationsDir(path.dirname(args.file))
    const same = existingMigrations.filter((o) => o.id === Number(id))[0]
    if (same) {
      this.error(`id conflict "${same.id}.${same.name}.sql" exists`)
    }
    const hash = canonicalId({ id: Number(id), name: name, ...steps })
    fs.writeFileSync(args.file, tpl, { flag: 'wx' })
    this.log(`created ${hash}`)
  }
}
