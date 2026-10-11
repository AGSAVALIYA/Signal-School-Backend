-- Look of the app for everyone in the school, chosen by the principal (School settings → Look). Allowed values are
-- checked by the API (src/modules/schools/themes.js), so a new theme needs no migration.
ALTER TABLE schools ADD COLUMN theme TEXT NOT NULL DEFAULT 'signal';
