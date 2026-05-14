alter table work_logs
add column if not exists text text not null default '';
