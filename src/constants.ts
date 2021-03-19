export const DEFAULT_MIGRATION_TABLE_NAME = 'trudge_migrations'
export const DEFAULT_MIGRATION_DIRECTORY_NAME = 'migrations'

// prettier-ignore
export const DEFAULT_MIGRATION_TEMPLATE = `
--trudge:upgrade
  SELECT * from "REPLACEME_UPGRADE"
  ORDER BY id ASC;

--trudge:downgrade
  SELECT * from "REPLACEME_DOWNGRADE"
  ORDER BY id DESC;

`.trimStart()
