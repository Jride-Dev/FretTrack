alter table public.beta_access_requests
  add column if not exists operator_notified_at timestamptz;
