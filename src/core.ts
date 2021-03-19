import { alwaysTrue, index, isDefined, valuesByKeyPred } from './util'
import { Database as DatabaseType, RunResult } from 'better-sqlite3'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

type Migration = {
  id: number
  name: string
  upgrade: string
  downgrade: string
}
type MigrationState = {
  shared: Migration[]
  missing: Migration[]
  unexpected: Migration[]
}
type MigrationMode = 'upgrade' | 'downgrade'

type SynchronizeOptions = {
  /**
   * When this is true and the database is tracking migrations that aren't in the
   * migrations directory, the function stops and no further changes are made.
   *
   * When this is false, synchronizeMigrations will walk try to downgrade all unexpected migrations.
   * You can provide a shouldApplyDowngrade function to control which unexpected migrations are downgraded.
   */
  abortOnUnexpected?: boolean
  /**
   * Called when there are unexpected migrations in the database and abortOnUnexpected is false.
   *
   * This function will be called with each unexpected migration (in descending order) and if the function
   * returns true, that migration will be downgraded.
   */
  shouldApplyDowngrade?: (m: Migration) => boolean
  /**
   * Called when there are migrations that haven't been applied to the database and either abortOnUnexpected was false,
   * or there were no unexpected migrations.
   *
   * This function will be called with each missing migration (in ascending order) and if the function returns true,
   * that migration will be upgraded.
   */
  shouldApplyUpgrade?: (m: Migration) => boolean

  /**
   * When the database is otherwise synchronized (no missing migrations, no unexpected migrations) this can be set to
   * true to force the last migration to be upgraded again.
   */
  forceLatestIfSynchronized?: boolean
}
type SynchronizeState = {
  before: MigrationState
  after: MigrationState
  changes: [Migration, MigrationMode][]
}

const DEFAULT_SYNCHRONIZE_OPTS: Required<SynchronizeOptions> = {
  abortOnUnexpected: true,
  shouldApplyDowngrade: alwaysTrue,
  shouldApplyUpgrade: alwaysTrue,
  forceLatestIfSynchronized: false,
}

function extractId(filename: string): [number, string] | null {
  const [, id, name] = path.basename(filename).match(/^(\d+).(.*?)\.sql$/) || []
  return id ? [Number(id), name] : null
}

function extractSteps(template: string): [string, string] | null {
  const [upgrade, downgrade] = template
    .split(/^--\s*?trudge:downgrade\b/im)
    .map((part) => part.replace(/^--.*?$/gm, '').trim())
  return downgrade ? [upgrade, downgrade] : null
}

function canonicalId(m: Migration): string {
  return createHash('sha1') // fast, secure enough
    .update(
      `id:${
        m.id
      }\nname:${m.name.trim()}\nupgrade:${m.upgrade.trim()}\ndowngrade:${m.downgrade.trim()}`,
    )
    .digest('hex')
}

/**
 * Create a migration file in the given directory.
 *
 * Does not overwrite existing files.
 * Fails if the id is in use
 * @param migrationsDirectory the directory to store the placeholder in
 * @param migration the migration to save
 * @returns The created file name without the directory.
 */
function writeMigrationFile(migrationsDirectory: string, migration: Migration): string {
  const existingMigrations = readMigrationsDir(migrationsDirectory)
  const sameId = existingMigrations.filter((o) => o.id === migration.id)
  if (sameId.length > 0) {
    const other = sameId[0]
    throw new Error(`id conflict: ${other.id}.${other.name}`)
  }
  const basename = `${migration.id}.${migration.name}.sql`
  const tpl = `--trudge:upgrade\n${migration.upgrade.trim()}\n--trudge:downgrade\n${migration.downgrade.trim()}\n\n`

  // fail on existing files
  fs.writeFileSync(path.join(migrationsDirectory, basename), tpl, {
    flag: 'wx',
  })
  return basename
}

/**
 * Load a {@link Migration} from a file.
 *
 * @example "001.addUsers.sql"
 *   -- trudge:upgrade
 *   CREATE TABLE Users (
 *     id    INTEGER PRIMARY KEY,
 *     email TEXT    NOT NULL
 *   );
 *
 *   -- trudge:downgrade
 *   DROP TABLE Users;
 *  @param migrationPath the full path to the migration file
 */
function parseMigrationFile(migrationPath: string): Migration | null {
  const [id, name] = extractId(migrationPath) ?? ['', '']
  if (!id) return null
  const template = fs.readFileSync(migrationPath, 'utf-8')
  const [upgrade, downgrade] = extractSteps(template) ?? ['', '']
  if (downgrade === undefined) {
    const msg = `malformed migration data from "${migrationPath}" (could not find trudge:downgrade)`
    throw new Error(msg)
  }
  return { id: Number(id), name, upgrade: upgrade, downgrade: downgrade }
}

/**
 * Return an unsorted list of Migration objects found in the directory.
 *
 * Malformed and non-migration files are ignored.
 * @param migrationsDirectory the directory to load migrations from
 */
function readMigrationsDir(migrationsDirectory: string): Migration[] {
  return fs
    .readdirSync(migrationsDirectory)
    .map((x) => parseMigrationFile(path.join(migrationsDirectory, x)))
    .filter(isDefined)
}

/**
 * Create a database table to track applied migrations if it doesn't exist
 * @param db the database connection
 * @param table the table that will store applied migrations
 */
function createMigrationsTable(db: DatabaseType, table: string): void {
  db.transaction(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS "${table}" (
        id        INTEGER PRIMARY KEY,
        name      TEXT    NOT NULL,
        upgrade   TEXT    NOT NULL,
        downgrade TEXT    NOT NULL
      )`,
    ).run()
  })()
}

/**
 * Return an unsorted list of Migration objects in the database.
 * Returns an empty list if the table does not exist.
 * @param db the database connection
 * @param table the table that stores applied migrations
 * @param create calls createMigrationsTable before reading when true
 * @returns
 */
function readMigrationsTable(db: DatabaseType, table: string, create = true): Migration[] {
  if (create) createMigrationsTable(db, table)
  return db.prepare(`SELECT id, name, upgrade, downgrade FROM "${table}" ORDER BY id ASC`).all()
}

function compareMigrationState(expected: Migration[], applied: Migration[]): MigrationState {
  // build tables of {id: migration} for expected, applied
  // use Set math on the table keys (migration ids) to pull out values
  // sort results ascending

  const eByFp: { [key: string]: Migration } = index(expected, canonicalId)
  const aByFp: { [key: string]: Migration } = index(applied, canonicalId)

  const shared: Migration[] = valuesByKeyPred(eByFp, (id) => id in aByFp)
  const missing: Migration[] = valuesByKeyPred(eByFp, (id) => !(id in aByFp)) // expected migrations weren't applied
  const unexpected: Migration[] = valuesByKeyPred(aByFp, (id) => !(id in eByFp)) // unexpected migrations were applied

  const ascending = (x: Migration, y: Migration) => x.id - y.id
  return {
    shared: shared.sort(ascending),
    missing: missing.sort(ascending),
    unexpected: unexpected.sort(ascending),
  }
}

/**
 * Apply a migration to the database.  Returns true if the migration was applied.
 * When force is true, the migration is always applied in the given mode.
 *
 * When force is false, the migration is only applied when the database state does not match the given mode.
 * @param db the database connection
 * @param table the table that stores applied migrations
 * @param migration the migration to apply
 * @param mode whether to apply the migration upgrade or downgrade
 * @param force apply the migration in the given mode regardless of current state
 * @returns true if the migration was applied, false otherwise
 */
function applyMigration(
  db: DatabaseType,
  table: string,
  migration: Migration,
  mode: MigrationMode,
  force = false,
): boolean {
  const insertStmt = `
    INSERT OR IGNORE INTO "${table}" (id, name, upgrade, downgrade) VALUES (?, ?, ?, ?)
    `
  const removeStmt = `
    DELETE FROM "${table}" WHERE id = ?
    `
  if (force) {
    switch (mode) {
      case 'upgrade': {
        db.transaction(() => {
          db.exec(migration.upgrade)
          db.prepare(insertStmt).run(
            migration.id,
            migration.name,
            migration.upgrade,
            migration.downgrade,
          )
        })()
        break
      }
      case 'downgrade': {
        db.transaction(() => {
          db.exec(migration.downgrade)
          db.prepare(removeStmt).run(migration.id)
        })()
        break
      }
      default: {
        throw new Error('bug in applyMigration')
      }
    }
    return true
  } else {
    let res: RunResult
    let applied = false
    switch (mode) {
      case 'upgrade': {
        db.transaction(() => {
          res = db
            .prepare(insertStmt)
            .run(migration.id, migration.name, migration.upgrade, migration.downgrade)
          applied = res.changes > 0
          if (applied) db.exec(migration.upgrade)
        })()
        break
      }
      case 'downgrade': {
        db.transaction(() => {
          res = db.prepare(removeStmt).run(migration.id)
          applied = res.changes > 0
          if (applied) db.exec(migration.downgrade)
        })()
        break
      }
      default: {
        throw new Error('bug in applyMigration')
      }
    }
    return applied
  }
}

function synchronizeMigrations(
  db: DatabaseType,
  table: string,
  migrationsDirectory: string,
  options: SynchronizeOptions = {},
): SynchronizeState {
  const opts = { ...DEFAULT_SYNCHRONIZE_OPTS, ...options }

  const expected = readMigrationsDir(migrationsDirectory)
  const beforeState = compareMigrationState(expected, readMigrationsTable(db, table, true))
  const changes: [Migration, MigrationMode][] = []

  function summarize(): SynchronizeState {
    return {
      before: beforeState,
      after: compareMigrationState(expected, readMigrationsTable(db, table, false)),
      changes: changes,
    }
  }

  const applyLatest =
    opts.forceLatestIfSynchronized &&
    beforeState.shared.length > 0 &&
    beforeState.missing.length === 0 &&
    beforeState.unexpected.length === 0

  if (beforeState.unexpected.length > 0) {
    // unexpected current state, abort
    if (opts.abortOnUnexpected) return summarize()

    // walk backwards along unexpected so we pop most recent first
    beforeState.unexpected
      .slice()
      .reverse()
      .forEach((migration) => {
        if (opts.shouldApplyDowngrade(migration)) {
          if (applyMigration(db, table, migration, 'downgrade', false)) {
            changes.push([migration, 'downgrade'])
          }
        }
      })
  }

  if (beforeState.missing.length > 0) {
    // walk forwards along missing so we push oldest first
    beforeState.missing.forEach((migration) => {
      if (opts.shouldApplyUpgrade(migration)) {
        if (applyMigration(db, table, migration, 'upgrade', false)) {
          changes.push([migration, 'upgrade'])
        }
      }
    })
  }

  if (applyLatest) {
    const latest = beforeState.shared[beforeState.shared.length - 1]
    if (applyMigration(db, table, latest, 'upgrade', true)) {
      changes.push([latest, 'upgrade'])
    }
  }

  return summarize()
}

export {
  Migration,
  applyMigration,
  canonicalId,
  compareMigrationState,
  createMigrationsTable,
  extractId,
  extractSteps,
  parseMigrationFile,
  readMigrationsDir,
  readMigrationsTable,
  synchronizeMigrations,
  writeMigrationFile,
}
