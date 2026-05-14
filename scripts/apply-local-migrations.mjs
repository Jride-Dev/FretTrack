import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import postgres from 'postgres';

const localDefaultUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.LOCAL_DATABASE_URL || localDefaultUrl;
const allowRemote = process.argv.includes('--allow-remote');
const migrationsDir = path.resolve('supabase/migrations');

if (!allowRemote && !isLocalDatabaseUrl(databaseUrl)) {
  console.error(`Refusing to apply migrations to a non-local database URL: ${redactUrl(databaseUrl)}`);
  console.error('Use TEST_DATABASE_URL/LOCAL_DATABASE_URL pointing to localhost, or pass --allow-remote only for an intentionally disposable database.');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10
});

try {
  await ensureMigrationHistory();
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.split('_')[0];
    const [{ already_applied: alreadyApplied }] = await sql`
      select exists (
        select 1
        from supabase_migrations.schema_migrations
        where version = ${version}
      ) as already_applied
    `;

    if (alreadyApplied) {
      console.log(`Skipping ${file}; already recorded locally.`);
      continue;
    }

    console.log(`Applying ${file}...`);
    const migrationSql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
      await tx`
        insert into supabase_migrations.schema_migrations (version, name, statements)
        values (${version}, ${file.replace(/^\d+_/, '').replace(/\.sql$/, '')}, array[]::text[])
      `;
    });
  }

  console.log('Local migrations are applied.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

async function ensureMigrationHistory() {
  await sql`create schema if not exists supabase_migrations`;
  await sql`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    )
  `;
}

function isLocalDatabaseUrl(value) {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(value) || /host=(localhost|127\.0\.0\.1|::1)(\s|$)/i.test(value);
}

function redactUrl(value) {
  return value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:[redacted]@');
}
