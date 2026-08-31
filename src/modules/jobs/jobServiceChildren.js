import { supabase } from '../../shared/lib/supabaseClient';
import { getActiveShopId as getActiveShopIdFromModule } from './jobServiceNormalization.js';

export async function syncJobChildren(job) {
  if (!job.invoiceFinalizedAt) {
    const partRows = job.parts.map((part) => ({
      id: part.id,
      shop_id: getActiveShopIdFromModule(part.shopId || job.shopId),
      job_id: job.id,
      part_id: part.partId || null,
      name: part.name,
      sku: part.sku || null,
      quantity: Number(part.quantity || 1),
      cost: Number(part.cost || 0),
      retail: Number(part.retail || 0),
      unit_cost: Number(part.cost || 0),
      retail_price: Number(part.retail || 0),
      created_at: part.createdAt
    }));
    await syncReplaceableJobChildren('job_parts', job.id, partRows, 'Billing parts');

    const serviceRows = job.services.map((service) => ({
      id: service.id,
      job_id: job.id,
      description: service.description,
      quantity: Number(service.quantity || 1),
      cost: Number(service.cost || 0),
      retail: Number(service.retail || 0),
      created_at: service.createdAt
    }));
    await syncReplaceableJobChildren('job_services', job.id, serviceRows, 'Billing services');
  }

  const workLogs = job.workLog.map((log) => ({
    id: log.id,
    job_id: log.jobId || log.job_id || job.id,
    entry: log.entry || log.text,
    text: log.text || log.entry,
    created_at: log.createdAt || log.timestamp
  }));

  if (workLogs.length) {
    let { error } = await supabase.from('work_logs').upsert(workLogs);
    if (isMissingColumnError(error, 'text')) {
      const legacyWorkLogs = workLogs.map(({ text, ...log }) => log);
      ({ error } = await supabase.from('work_logs').upsert(legacyWorkLogs));
    }
    if (error) {
      console.error('Supabase sync work logs failed.', error);
      throw new Error(`Work log save failed: ${error.message}`);
    }
  }

  const savedWorkLogIds = workLogs.map((log) => log.id);
  let deleteQuery = supabase.from('work_logs').delete().eq('job_id', job.id);

  if (savedWorkLogIds.length) {
    deleteQuery = deleteQuery.not('id', 'in', `(${savedWorkLogIds.join(',')})`);
  }

  const { error: deleteWorkLogsError } = await deleteQuery;
  if (deleteWorkLogsError) {
    console.error('Supabase stale work log cleanup failed.', deleteWorkLogsError);
    throw new Error(`Work log cleanup failed: ${deleteWorkLogsError.message}`);
  }
}

export async function syncReplaceableJobChildren(tableName, jobId, rows, label) {
  if (rows.length) {
    const { error: saveError } = await supabase.from(tableName).upsert(rows, { onConflict: 'id' });
    if (saveError) {
      console.error(`Supabase ${label.toLowerCase()} save failed.`, saveError);
      throw new Error(`${label} save failed: ${saveError.message}`);
    }
  }

  const savedIds = rows.map((row) => row.id);
  let cleanupQuery = supabase.from(tableName).delete().eq('job_id', jobId);
  if (savedIds.length) {
    cleanupQuery = cleanupQuery.not('id', 'in', `(${savedIds.join(',')})`);
  }

  const { error: cleanupError } = await cleanupQuery;
  if (cleanupError) {
    console.error(`Supabase stale ${label.toLowerCase()} cleanup failed.`, cleanupError);
    throw new Error(`${label} cleanup failed: ${cleanupError.message}`);
  }
}

export function isMissingColumnError(error, columnName) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || '');
  return message.includes(`'${columnName}' column`) || message.includes(`column "${columnName}"`);
}

export function shouldRetryWithLegacyJobPayload(error) {
  if (!error) {
    return false;
  }

  const message = String(error.message || error.details || '');
  return (
    ['customer_id', 'job_date', 'promise_date', 'priority', 'job_day_code', 'daily_sequence', 'shop_id'].some((columnName) => isMissingColumnError(error, columnName))
    || message.includes('violates check constraint')
    || message.includes('schema cache')
  );
}
