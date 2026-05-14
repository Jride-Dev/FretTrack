import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import postgres from 'postgres';

const localDefaultUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.LOCAL_DATABASE_URL || localDefaultUrl;
const allowRemote = process.argv.includes('--allow-remote');
const resetTestData = process.argv.includes('--reset');
const reportDir = path.resolve('docs/test-reports');
const startedAt = new Date();
const runStamp = startedAt.toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(reportDir, `local-test-shops-${runStamp}.md`);
const ownerPassword = 'FretTrackTest123!';
const shops = Array.from({ length: 5 }, (_, index) => ({
  index: index + 1,
  id: `test${index + 1}-shop`,
  name: `test${index + 1} shop`,
  ownerEmail: `test${index + 1}.owner@frettrack.local`
}));

const brands = ['Fender', 'Gibson', 'Martin', 'Taylor', 'Ibanez', 'Yamaha', 'PRS', 'Gretsch', 'Squier', 'Epiphone'];
const electricModels = ['Stratocaster', 'Telecaster', 'Les Paul', 'SG', 'RG550', 'Silver Sky'];
const acousticModels = ['D-28', 'J-45', '814ce', 'FG830', '000-15M'];
const bassModels = ['Precision Bass', 'Jazz Bass', 'Thunderbird', 'SR500', 'Mustang Bass'];
const colors = ['Sunburst', 'Black', 'Olympic White', 'Natural', 'Lake Placid Blue', 'Candy Apple Red'];
const statuses = ['Checked In', 'On Bench', 'Waiting Parts', 'Completed'];
const damageTypes = ['finish chip', 'neck relief concern', 'scratch', 'loose jack', 'bridge lift', 'fret buzz', 'cracked nut'];
const errors = [];
const notices = [];

if (!allowRemote && !isLocalDatabaseUrl(databaseUrl)) {
  console.error(`Refusing to seed a non-local database URL: ${redactUrl(databaseUrl)}`);
  console.error('Use TEST_DATABASE_URL/LOCAL_DATABASE_URL pointing to localhost, or pass --allow-remote only for an intentionally disposable database.');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10
});

try {
  await ensureReportDirectory();
  await assertRequiredSchema();

  if (resetTestData) {
    await deleteExistingTestData();
  }

  const summary = [];
  for (const shop of shops) {
    const ownerId = deterministicUuid(`owner-${shop.id}`);
    await ensureOwnerUser(ownerId, shop);
    await ensureOwnerMembership(ownerId, shop);
    const shopSummary = await seedShopAsOwner(ownerId, shop);
    summary.push(shopSummary);
  }

  const checks = await runChecks();
  await writeReport({ summary, checks });
  console.log(`Seeded ${shops.length} local test shops.`);
  console.log(`Report written to ${reportPath}`);
  if (errors.length) {
    console.error(`${errors.length} error(s) logged. Review the report before trusting this seed run.`);
    process.exitCode = 1;
  }
} catch (error) {
  errors.push({ scope: 'fatal', message: error.message, stack: error.stack });
  await writeReport({ summary: [], checks: [] }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

async function assertRequiredSchema() {
  const requiredTables = ['customers', 'jobs', 'shop_members', 'job_parts', 'job_services', 'work_logs', 'job_images', 'job_events'];
  const rows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${requiredTables})
  `;
  const found = new Set(rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !found.has(table));

  if (missing.length) {
    throw new Error(`Local database is missing required tables: ${missing.join(', ')}. Start local Supabase and apply migrations first.`);
  }

  await sql`alter table work_logs add column if not exists text text not null default ''`;
}

async function deleteExistingTestData() {
  const shopIds = shops.map((shop) => shop.id);
  await sql.begin(async (tx) => {
    await tx`delete from job_events where shop_id = any(${shopIds})`;
    await tx`delete from job_images where job_id in (select id from jobs where shop_id = any(${shopIds}))`;
    await tx`delete from work_logs where job_id in (select id from jobs where shop_id = any(${shopIds}))`;
    await tx`delete from job_services where job_id in (select id from jobs where shop_id = any(${shopIds}))`;
    await tx`delete from job_parts where job_id in (select id from jobs where shop_id = any(${shopIds}))`;
    await tx`delete from customer_messages where job_id in (select id from jobs where shop_id = any(${shopIds}))`;
    await tx`delete from jobs where shop_id = any(${shopIds})`;
    await tx`delete from customers where shop_id = any(${shopIds})`;
    await tx`delete from job_daily_sequences where shop_id = any(${shopIds})`;
    await tx`delete from shop_members where shop_id = any(${shopIds})`;
    await tx`delete from auth.users where email like 'test%.owner@frettrack.local'`;
  });
}

async function ensureOwnerUser(ownerId, shop) {
  await sql`
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      ${ownerId}::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      ${shop.ownerEmail},
      crypt(${ownerPassword}, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ${sql.json({ display_name: `${shop.name} Owner` })},
      now(),
      now()
    )
    on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = now()
  `;
}

async function ensureOwnerMembership(ownerId, shop) {
  await sql`
    insert into shop_members (shop_id, user_id, role, display_name, created_at, updated_at)
    values (${shop.id}, ${ownerId}::uuid, 'owner', ${`${shop.name} Owner`}, now(), now())
    on conflict (shop_id, user_id) do update
    set role = 'owner',
        display_name = excluded.display_name,
        updated_at = now()
  `;
}

async function seedShopAsOwner(ownerId, shop) {
  const result = {
    shop: shop.name,
    shopId: shop.id,
    ownerEmail: shop.ownerEmail,
    customers: 0,
    jobs: 0,
    parts: 0,
    services: 0,
    workLogs: 0,
    images: 0,
    events: 0
  };

  await sql.begin(async (tx) => {
    await setOwnerSession(tx, ownerId);

    for (let customerNumber = 1; customerNumber <= 20; customerNumber += 1) {
      const customer = buildCustomer(shop, customerNumber);
      const [savedCustomer] = await tx`
        insert into customers ${tx(customer, Object.keys(customer))}
        on conflict (id) do update
        set display_name = excluded.display_name,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            email = excluded.email,
            email_normalized = excluded.email_normalized,
            phone = excluded.phone,
            phone_normalized = excluded.phone_normalized,
            address_line1 = excluded.address_line1,
            city = excluded.city,
            region = excluded.region,
            postal_code = excluded.postal_code,
            notes = excluded.notes,
            updated_at = excluded.updated_at
        returning *
      `;
      result.customers += 1;

      const jobPayload = buildJobPayload(shop, savedCustomer, customerNumber);
      const [savedJob] = await tx`select * from create_job_with_number(${tx.json(jobPayload)}::jsonb)`;
      result.jobs += 1;

      const childCounts = await seedJobChildren(tx, shop, savedJob, customerNumber);
      result.parts += childCounts.parts;
      result.services += childCounts.services;
      result.workLogs += childCounts.workLogs;
      result.images += childCounts.images;
      result.events += childCounts.events;
    }
  });

  return result;
}

async function setOwnerSession(tx, ownerId) {
  await tx`set local role authenticated`;
  await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
}

function buildCustomer(shop, customerNumber) {
  const phone = `111-222-${String(3400 + customerNumber).padStart(4, '0')}`;
  const displayName = `FicticiousJoe Customer ${customerNumber}`;
  return {
    id: deterministicUuid(`${shop.id}-customer-${customerNumber}`),
    shop_id: shop.id,
    display_name: displayName,
    first_name: 'FicticiousJoe',
    last_name: `Customer ${customerNumber}`,
    company_name: null,
    customer_type: 'individual',
    email: `ficticiousjoe.customer${customerNumber}@${shop.id}.example.test`,
    email_normalized: `ficticiousjoe.customer${customerNumber}@${shop.id}.example.test`,
    phone: phone,
    phone_normalized: phone.replace(/\D/g, ''),
    secondary_phone: `111-333-${String(3400 + customerNumber).padStart(4, '0')}`,
    address_line1: `${String(customerNumber).padStart(4, '0')} Fake St`,
    address_line2: customerNumber % 3 === 0 ? `Suite ${customerNumber}` : null,
    city: 'Faketown',
    region: 'California',
    postal_code: '02345',
    country: 'USA',
    notes: `Local seed customer for ${shop.name}.`,
    source: 'import',
    external_ref: `${shop.id}-fake-customer-${customerNumber}`,
    import_source: 'local-test-seed',
    import_batch_id: deterministicUuid(`${shop.id}-import-batch`),
    created_at: offsetDate(customerNumber + shop.index).toISOString(),
    updated_at: new Date().toISOString()
  };
}

function buildJobPayload(shop, customer, customerNumber) {
  const instrument = pickInstrument(customerNumber);
  const jobDate = offsetDate(customerNumber + shop.index);
  const measurements = buildMeasurements(customerNumber, instrument.type);
  const damageMap = buildDamageMap(customerNumber, instrument.type);

  return {
    id: deterministicUuid(`${shop.id}-job-${customerNumber}`),
    customer_id: customer.id,
    customer_name: customer.display_name,
    customer_first_name: customer.first_name,
    customer_last_name: customer.last_name,
    phone: customer.phone,
    email: customer.email,
    email_opt_in: customerNumber % 2 === 0,
    sms_opt_in: false,
    preferred_contact_method: customerNumber % 2 === 0 ? 'email' : 'none',
    guitar_brand: instrument.brand,
    model: instrument.model,
    serial: `${shop.id.toUpperCase()}-${String(customerNumber).padStart(4, '0')}`,
    color: pick(colors, customerNumber + shop.index),
    reason_for_visit: `${pick(damageTypes, customerNumber)} and setup check.`,
    date_received: isoDate(jobDate),
    job_date: isoDate(jobDate),
    shop_id: shop.id,
    status: pick(statuses, customerNumber),
    tech_details: {
      seedRun: runStamp,
      instrumentType: instrument.type,
      intakeNotes: `Seeded ${instrument.type.toLowerCase()} ticket for local database testing.`,
      damageMap,
      measurements,
      neckInspection: {
        initialRelief: measurements.neckRelief,
        finalRelief: customerNumber % 4 === 0 ? 'pending' : measurements.targetRelief,
        notes: `Randomized local test inspection ${customerNumber}.`
      },
      authorizationNotes: 'Fictitious local seed authorization only.',
      discountType: customerNumber % 5 === 0 ? 'percent' : 'none',
      discountValue: customerNumber % 5 === 0 ? '10' : ''
    },
    created_at: jobDate.toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function seedJobChildren(tx, shop, job, customerNumber) {
  const partRows = buildParts(shop, job, customerNumber);
  const serviceRows = buildServices(shop, job, customerNumber);
  const workLogRows = buildWorkLogs(shop, job, customerNumber);
  const imageRows = buildImageMetadata(shop, job, customerNumber);
  const eventRows = buildEvents(shop, job, customerNumber);

  await tx`insert into job_parts ${tx(partRows, 'id', 'job_id', 'name', 'quantity', 'cost', 'retail', 'created_at')} on conflict (id) do nothing`;
  await tx`insert into job_services ${tx(serviceRows, 'id', 'job_id', 'description', 'quantity', 'cost', 'retail', 'created_at')} on conflict (id) do nothing`;
  await tx`insert into work_logs ${tx(workLogRows, 'id', 'job_id', 'entry', 'text', 'created_at')} on conflict (id) do nothing`;
  await tx`insert into job_images ${tx(imageRows, 'id', 'job_id', 'url', 'public_url', 'storage_path', 'file_name', 'original_filename', 'uploaded_at', 'category', 'created_at')} on conflict (id) do nothing`;
  await tx`insert into job_events ${tx(eventRows, 'id', 'shop_id', 'job_id', 'event_type', 'event_label', 'event_note', 'event_data', 'created_at', 'created_by')} on conflict (id) do nothing`;

  return {
    parts: partRows.length,
    services: serviceRows.length,
    workLogs: workLogRows.length,
    images: imageRows.length,
    events: eventRows.length
  };
}

function buildParts(shop, job, customerNumber) {
  return [
    {
      id: deterministicUuid(`${shop.id}-${job.id}-strings`),
      job_id: job.id,
      name: customerNumber % 3 === 0 ? 'Bass strings' : 'String set',
      quantity: 1,
      cost: 6 + (customerNumber % 5),
      retail: 12 + (customerNumber % 8),
      created_at: new Date().toISOString()
    },
    {
      id: deterministicUuid(`${shop.id}-${job.id}-jack`),
      job_id: job.id,
      name: customerNumber % 4 === 0 ? 'Output jack' : 'Shop consumables',
      quantity: 1,
      cost: 2 + (customerNumber % 4),
      retail: 5 + (customerNumber % 6),
      created_at: new Date().toISOString()
    }
  ];
}

function buildServices(shop, job, customerNumber) {
  return [
    {
      id: deterministicUuid(`${shop.id}-${job.id}-setup`),
      job_id: job.id,
      description: 'Setup and inspection',
      quantity: 1,
      cost: 0,
      retail: 75 + (customerNumber % 5) * 10,
      created_at: new Date().toISOString()
    },
    {
      id: deterministicUuid(`${shop.id}-${job.id}-damage-review`),
      job_id: job.id,
      description: 'Damage map review',
      quantity: 1,
      cost: 0,
      retail: 20 + (customerNumber % 3) * 5,
      created_at: new Date().toISOString()
    }
  ];
}

function buildWorkLogs(shop, job, customerNumber) {
  return [
    {
      id: deterministicUuid(`${shop.id}-${job.id}-log-1`),
      job_id: job.id,
      entry: `Intake completed. Damage mapping simulated for test ticket ${customerNumber}.`,
      text: `Intake completed. Damage mapping simulated for test ticket ${customerNumber}.`,
      created_at: new Date().toISOString()
    },
    {
      id: deterministicUuid(`${shop.id}-${job.id}-log-2`),
      job_id: job.id,
      entry: 'Randomized measurements entered for local database capability test.',
      text: 'Randomized measurements entered for local database capability test.',
      created_at: new Date().toISOString()
    }
  ];
}

function buildImageMetadata(shop, job, customerNumber) {
  return [
    {
      id: deterministicUuid(`${shop.id}-${job.id}-image-front`),
      job_id: job.id,
      url: `local-test://${shop.id}/${job.id}/front-${customerNumber}.jpg`,
      public_url: `local-test://${shop.id}/${job.id}/front-${customerNumber}.jpg`,
      storage_path: `${job.id}/front-${customerNumber}.jpg`,
      file_name: `front-${customerNumber}.jpg`,
      original_filename: `front-${customerNumber}.jpg`,
      uploaded_at: new Date().toISOString(),
      category: 'damage-front',
      created_at: new Date().toISOString()
    }
  ];
}

function buildEvents(shop, job, customerNumber) {
  return [
    {
      id: deterministicUuid(`${shop.id}-${job.id}-event-created`),
      shop_id: shop.id,
      job_id: job.id,
      event_type: 'job_created',
      event_label: 'Job created',
      event_note: `Local seed job ${customerNumber} created.`,
      event_data: sql.json({ seedRun: runStamp, jobNumber: job.job_number }),
      created_at: new Date().toISOString(),
      created_by: `${shop.name} Owner`
    },
    {
      id: deterministicUuid(`${shop.id}-${job.id}-event-damage`),
      shop_id: shop.id,
      job_id: job.id,
      event_type: 'damage_map_updated',
      event_label: 'Damage map simulated',
      event_note: 'Random local seed damage markers added.',
      event_data: sql.json({ markerCount: 3 }),
      created_at: new Date().toISOString(),
      created_by: `${shop.name} Owner`
    }
  ];
}

async function runChecks() {
  const checks = [];
  await recordCheck(checks, 'Expected customers per shop', async () => {
    const rows = await sql`
      select shop_id, count(*)::int as count
      from customers
      where shop_id = any(${shops.map((shop) => shop.id)})
      group by shop_id
      order by shop_id
    `;
    assertCounts(rows, 20, 'customers');
    return rows;
  });

  await recordCheck(checks, 'Expected jobs per shop', async () => {
    const rows = await sql`
      select shop_id, count(*)::int as count
      from jobs
      where shop_id = any(${shops.map((shop) => shop.id)})
      group by shop_id
      order by shop_id
    `;
    assertCounts(rows, 20, 'jobs');
    return rows;
  });

  await recordCheck(checks, 'Jobs are linked to customers', async () => {
    const [{ count }] = await sql`
      select count(*)::int as count
      from jobs
      where shop_id = any(${shops.map((shop) => shop.id)})
        and customer_id is null
    `;
    if (count !== 0) throw new Error(`${count} jobs are missing customer_id`);
    return { missingCustomerId: count };
  });

  await recordCheck(checks, 'Referenced customer delete is blocked', async () => {
    const [customer] = await sql`
      select id
      from customers
      where shop_id = ${shops[0].id}
      order by display_name
      limit 1
    `;
    try {
      await sql`delete from customers where id = ${customer.id}`;
    } catch (error) {
      return { blocked: true, message: error.message };
    }
    throw new Error('A customer referenced by a job was deleted.');
  });

  await recordCheck(checks, 'Owner cannot read another shop through RLS', async () => {
    const ownerId = deterministicUuid(`owner-${shops[0].id}`);
    const rows = await sql.begin(async (tx) => {
      await setOwnerSession(tx, ownerId);
      return tx`
        select count(*)::int as count
        from customers
        where shop_id = ${shops[1].id}
      `;
    });

    if (rows[0].count !== 0) {
      throw new Error(`test1 owner could read ${rows[0].count} customers from ${shops[1].id}`);
    }

    return { visibleOtherShopCustomers: rows[0].count };
  });

  await recordCheck(checks, 'Owner cannot insert into another shop through RLS', async () => {
    const ownerId = deterministicUuid(`owner-${shops[0].id}`);
    const otherShopCustomer = buildCustomer(shops[1], 999);
    otherShopCustomer.id = deterministicUuid('test1-owner-cross-shop-insert-attempt');

    try {
      await sql.begin(async (tx) => {
        await setOwnerSession(tx, ownerId);
        await tx`insert into customers ${tx(otherShopCustomer, Object.keys(otherShopCustomer))}`;
      });
    } catch (error) {
      return { blocked: true, message: error.message };
    }

    throw new Error(`test1 owner inserted a customer into ${shops[1].id}`);
  });

  return checks;
}

async function recordCheck(checks, name, fn) {
  try {
    checks.push({ name, status: 'passed', details: await fn() });
  } catch (error) {
    const failed = { name, status: 'failed', message: error.message };
    checks.push(failed);
    errors.push({ scope: name, message: error.message, stack: error.stack });
  }
}

function assertCounts(rows, expectedCount, label) {
  const counts = new Map(rows.map((row) => [row.shop_id, row.count]));
  shops.forEach((shop) => {
    if (counts.get(shop.id) !== expectedCount) {
      throw new Error(`${shop.id} has ${counts.get(shop.id) || 0} ${label}, expected ${expectedCount}`);
    }
  });
}

async function writeReport({ summary, checks }) {
  await ensureReportDirectory();
  const lines = [
    '# Local Test Shop Seed Report',
    '',
    `Started: ${startedAt.toISOString()}`,
    `Database: ${redactUrl(databaseUrl)}`,
    `Reset test data first: ${resetTestData ? 'yes' : 'no'}`,
    '',
    '## Shops',
    '',
    ...summary.flatMap((shop) => [
      `### ${shop.shop}`,
      '',
      `- Shop ID: \`${shop.shopId}\``,
      `- Owner email: \`${shop.ownerEmail}\``,
      `- Local owner password: \`${ownerPassword}\``,
      `- Customers: ${shop.customers}`,
      `- Jobs: ${shop.jobs}`,
      `- Parts: ${shop.parts}`,
      `- Services: ${shop.services}`,
      `- Work logs: ${shop.workLogs}`,
      `- Image metadata rows: ${shop.images}`,
      `- Events: ${shop.events}`,
      ''
    ]),
    '## Checks',
    '',
    ...checks.flatMap((check) => [
      `- ${check.status === 'passed' ? 'PASS' : 'FAIL'}: ${check.name}`,
      check.message ? `  - ${check.message}` : ''
    ].filter(Boolean)),
    '',
    '## Errors And Bugs',
    '',
    errors.length ? errors.map((error) => `- ${error.scope}: ${error.message}`).join('\n') : '- None logged.',
    '',
    '## Notes',
    '',
    '- This seed run uses fake local-only customer, job, damage, image metadata, and work-log data.',
    '- The script refuses remote database URLs unless `--allow-remote` is passed.',
    '- Shop accounts are represented by `auth.users` rows and owner `shop_members` rows because there is no standalone `shops` table yet.',
    ''
  ];

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
}

async function ensureReportDirectory() {
  await fs.mkdir(reportDir, { recursive: true });
}

function pick(list, index) {
  return list[index % list.length];
}

function pickInstrument(customerNumber) {
  const type = pick(['Electric', 'Acoustic', 'Bass'], customerNumber);
  const modelList = type === 'Acoustic' ? acousticModels : type === 'Bass' ? bassModels : electricModels;
  return {
    type,
    brand: pick(brands, customerNumber),
    model: pick(modelList, customerNumber)
  };
}

function buildMeasurements(customerNumber, instrumentType) {
  const bassOffset = instrumentType === 'Bass' ? 0.02 : 0;
  return {
    neckRelief: `${(0.006 + (customerNumber % 6) * 0.001 + bassOffset).toFixed(3)} in`,
    targetRelief: `${(0.005 + (customerNumber % 4) * 0.001 + bassOffset).toFixed(3)} in`,
    actionLow: `${(4 / 64 + (customerNumber % 3) / 64).toFixed(3)} in`,
    actionHigh: `${(5 / 64 + (customerNumber % 4) / 64).toFixed(3)} in`,
    pickupHeightBass: `${(5 / 64 + (customerNumber % 2) / 64).toFixed(3)} in`,
    pickupHeightTreble: `${(4 / 64 + (customerNumber % 2) / 64).toFixed(3)} in`
  };
}

function buildDamageMap(customerNumber, instrumentType) {
  return {
    instrumentType,
    markers: Array.from({ length: 3 }, (_, index) => ({
      id: deterministicUuid(`damage-${customerNumber}-${index}`),
      x: Number((0.2 + ((customerNumber + index) % 6) * 0.1).toFixed(2)),
      y: Number((0.25 + ((customerNumber + index * 2) % 5) * 0.12).toFixed(2)),
      side: index % 2 === 0 ? 'front' : 'back',
      severity: pick(['Cosmetic', 'Structural', 'Critical'], customerNumber + index),
      note: `${pick(damageTypes, customerNumber + index)} marker ${index + 1}`
    }))
  };
}

function offsetDate(offsetDays) {
  const date = new Date(Date.UTC(2026, 4, 1));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function deterministicUuid(input) {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = `${hash.toString(16).padStart(8, '0')}${Buffer.from(input).toString('hex').padEnd(24, '0')}`.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isLocalDatabaseUrl(value) {
  return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(value) || /host=(localhost|127\.0\.0\.1|::1)(\s|$)/i.test(value);
}

function redactUrl(value) {
  return value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:[redacted]@');
}
