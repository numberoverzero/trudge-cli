import { MIGRATION_FILENAME_REGEX } from './constants'
import { alwaysTrue, count, index, isDefined, valuesByKeyPred } from './util'
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

  /**
   * Optional verbose logger to call before and after each migration
   */
  verbose?: (msg: string) => void
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
  verbose: () => {
    /* no logging */
  },
}

/**
 * The hex sha-1 digest of the canonicalized migration
 * @param m a migration
 * @returns hex string of the sha-1 digest
 */
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
 * Splits the string into (upgrade, downgrade) strings.
 * Returns null if the string is malformed.
 *
 * @example 001.init.sql
 * ---trudge:upgrade
 * CREATE TABLE IF NOT EXISTS Users (
 *   id    INTEGER PRIMARY KEY,
 *   email TEXT    NOT NULL
 * );
 * --trudge:downgrade
 * DROP TABLE IF EXISTS Users;
 *
 * @param template string to split
 * @returns the trimmed {upgrade:string, downgrade: string} or null
 */
function splitTemplate(template: string): { upgrade: string; downgrade: string } | null {
  const [upgrade, downgrade] = template
    .split(/^--\s*?trudge:downgrade\b/im)
    .map((part) => part.replace(/^--.*?$/gm, '').trim())
  return downgrade ? { upgrade, downgrade } : null
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
 *  @param filename the full path to the migration file
 */
function parseMigrationFile(filename: string): Migration | null {
  const [, id, name] = path.basename(filename).match(MIGRATION_FILENAME_REGEX) || []
  if (id === null || id === undefined) return null
  const template = fs.readFileSync(filename, 'utf-8')
  const steps = splitTemplate(template)
  if (!steps) {
    const msg = `malformed migration data from "${filename}" (could not find --trudge:downgrade)`
    throw new Error(msg)
  }
  return { id: Number(id), name, ...steps }
}

/**
 * Return an unsorted list of Migration objects found in the directory.
 *
 * Malformed and non-migration files are ignored.
 * @param dir the directory to load migrations from
 */
function readMigrationsDir(dir: string): Migration[] {
  const migrations = fs
    .readdirSync(dir)
    .map((x) => parseMigrationFile(path.join(dir, x)))
    .filter(isDefined)

  // explode on duplicate ids since we rely on them for sequencing
  const counts = count(migrations, (m) => m.id)
  const invalidIds = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
  if (invalidIds.length) {
    const msg = `migrations directory ${dir} contains duplicate ids: [${invalidIds.join(', ')}]`
    throw new Error(msg)
  }
  return migrations
}

/**
 * Create a database table to track applied migrations if it doesn't exist
 * @param db the database connection
 * @param tableName the table that will store applied migrations
 */
function createMigrationsTable(db: DatabaseType, tableName: string): void {
  db.transaction(() => {
    db.prepare(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (
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
 * @param tableName the table that stores applied migrations
 * @param create calls createMigrationsTable before reading when true
 * @returns
 */
function readMigrationsTable(db: DatabaseType, tableName: string, create = true): Migration[] {
  if (create) createMigrationsTable(db, tableName)
  return db.prepare(`SELECT id, name, upgrade, downgrade FROM "${tableName}" ORDER BY id ASC`).all()
}

/**
 * Pass in the expected state (usually from readMigrationsDir) and the applied state
 * (usually from readMigrationsTable) to get a diff of the state.
 *
 * Returns:
 *   shared: migrations that were both expected and applied
 *   missing: migrations that were expected, and have not been applied
 *   unexpected: migrations that were applied, but not expected
 * @param expected usually readMigrationsDir
 * @param applied usually readMigrationsTable
 * @returns arrays of missing, unexpected, and shared migrations
 */
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
 * @param tableName the table that stores applied migrations
 * @param migration the migration to apply
 * @param mode whether to apply the migration upgrade or downgrade
 * @param force apply the migration in the given mode regardless of current state
 * @returns true if the migration was applied, false otherwise
 */
function applyMigration(
  db: DatabaseType,
  tableName: string,
  migration: Migration,
  mode: MigrationMode,
  force = false,
): boolean {
  const insertStmt = `
    INSERT OR IGNORE INTO "${tableName}" (id, name, upgrade, downgrade) VALUES (?, ?, ?, ?)
    `
  const removeStmt = `
    DELETE FROM "${tableName}" WHERE id = ?
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

/**
 * Attempt to make the database's tracked migrations current against all
 * migration files in the provided migrations folder
 * @param db the database connection
 * @param migrationsTableName the table that stores applied migrations
 * @param migrationsDirectory the directory containing expected migrations
 * @param options advanced controls for synchronization
 * @returns a summary of the state before changes were made, after changes were made,
 *          and the ordered list of migrations that were applied
 */
function synchronizeMigrations(
  db: DatabaseType,
  migrationsTableName: string,
  migrationsDirectory: string,
  options: SynchronizeOptions = {},
): SynchronizeState {
  const opts = { ...DEFAULT_SYNCHRONIZE_OPTS, ...options }

  const expected = readMigrationsDir(migrationsDirectory)
  const beforeState = compareMigrationState(
    expected,
    readMigrationsTable(db, migrationsTableName, true),
  )
  const changes: [Migration, MigrationMode][] = []

  function summarize(): SynchronizeState {
    return {
      before: beforeState,
      after: compareMigrationState(expected, readMigrationsTable(db, migrationsTableName, false)),
      changes: changes,
    }
  }

  function apply(migration: Migration, mode: MigrationMode, force: boolean): boolean {
    const id = `${mode}:${migration.id}.${migration.name}.sql (${canonicalId(migration)})`
    let res: boolean
    opts.verbose(`starting ${id}`)
    try {
      res = applyMigration(db, migrationsTableName, migration, mode, force)
    } catch (err) {
      opts.verbose(`failed ${id}`)
      throw err
    }
    opts.verbose(`finished ${id}`)
    return res
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
          if (apply(migration, 'downgrade', false)) {
            changes.push([migration, 'downgrade'])
          }
        }
      })
  }

  if (beforeState.missing.length > 0) {
    // walk forwards along missing so we push oldest first
    beforeState.missing.forEach((migration) => {
      if (opts.shouldApplyUpgrade(migration)) {
        if (apply(migration, 'upgrade', false)) {
          changes.push([migration, 'upgrade'])
        }
      }
    })
  }

  if (applyLatest) {
    const latest = beforeState.shared[beforeState.shared.length - 1]
    if (apply(latest, 'upgrade', true)) {
      changes.push([latest, 'upgrade'])
    }
  }

  return summarize()
}

export {
  Migration,
  MigrationMode,
  SynchronizeState,
  applyMigration,
  canonicalId,
  compareMigrationState,
  createMigrationsTable,
  parseMigrationFile,
  readMigrationsDir,
  readMigrationsTable,
  splitTemplate,
  synchronizeMigrations,
}
