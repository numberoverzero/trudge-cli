import { DEFAULT_MIGRATION_TEMPLATE } from '../constants'
import { canonicalId, extractId, extractSteps, writeMigrationFile } from '../core'
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

    const migrationsDirectory = path.dirname(args.file)

    const [id, name] = extractId(args.file) ?? [null, '']
    if (id === null) throw new Error('filename must match d+..+?.sql (eg 003.users.sql)')

    const tpl = flags.tpl
      ? fs.readFileSync(flags.tpl, { encoding: 'utf-8' })
      : DEFAULT_MIGRATION_TEMPLATE

    const [upgrade, downgrade] = extractSteps(tpl) ?? ['', '']
    if (!upgrade || !downgrade) throw new Error('malformed template')

    const migration = {
      id: id,
      name: name,
      upgrade: upgrade,
      downgrade: downgrade,
    }
    writeMigrationFile(migrationsDirectory, migration)
    this.log(`created ${canonicalId(migration)}`)
  }
}
