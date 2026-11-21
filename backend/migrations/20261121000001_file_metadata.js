// File: backend/migrations/20261121000001_file_metadata.js
//
// Photo metadata (file-metadata plan): what EXIF/GPS/XMP/IPTC say about an
// uploaded photo (utils/fileMetadata.js describes the shape), and when the
// file was read. NULL metadata_read_at = not read yet; the backend reads
// those in the background after starting (services/fileMetadata.js).

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE files
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS metadata_read_at TIMESTAMPTZ
  `);
  // The Files list's "has a location" filter and the map's photo layer.
  await knex.raw(`CREATE INDEX IF NOT EXISTS files_with_gps ON files (project_id) WHERE metadata \\? 'gps'`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS files_metadata_unread ON files (id) WHERE metadata_read_at IS NULL`);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS files_metadata_unread');
  await knex.raw('DROP INDEX IF EXISTS files_with_gps');
  await knex.raw('ALTER TABLE files DROP COLUMN IF EXISTS metadata_read_at, DROP COLUMN IF EXISTS metadata');
};
