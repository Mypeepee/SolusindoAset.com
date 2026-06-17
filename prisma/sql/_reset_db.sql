-- Full reset of the local `kosku` database (used by `npm run db:reset`).
-- 1) Drop everything: tables, data, AND all sequences in one shot.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2) Recreate the custom sequences referenced via dbgenerated() defaults in
--    schema.prisma. Prisma `db push` does NOT create these automatically, so
--    they must exist before the schema is pushed (otherwise: P1014).
CREATE SEQUENCE IF NOT EXISTS pengguna_code_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS agent_code_seq    START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS project_code_seq  START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS klien_code_seq    START 1 INCREMENT 1;

-- 3) After this file runs, `prisma db push` builds all tables fresh.
