# Beta Messaging And Feedback

## System Announcements

Use `system_announcements` for one-time in-app notices. Logged-in users see active notices that are global or targeted to their shop. Users can dismiss each notice once.

Global maintenance notice:

```sql
insert into public.system_announcements (
  title,
  message,
  severity,
  starts_at,
  ends_at
) values (
  'Maintenance tonight',
  'FretTrack will be unavailable while bug fixes deploy.',
  'warning',
  now(),
  now() + interval '2 hours'
);
```

Shop-specific notice:

```sql
insert into public.system_announcements (
  title,
  message,
  severity,
  target_shop_id
) values (
  'Photo upload patch',
  'Please avoid uploading photos for the next 15 minutes.',
  'urgent',
  'house-of-bass'
);
```

Severity values: `info`, `warning`, `urgent`.

## Beta Feedback

Logged-in users can submit reports through **Report Issue** in the app header. Reports include shop id, user id, user email, current URL, browser info, and the selected job number when a job is open.

Recent reports:

```sql
select
  created_at,
  shop_id,
  user_email,
  feedback_type,
  severity,
  subject,
  message,
  job_number,
  page_url,
  browser_info
from public.beta_feedback
order by created_at desc
limit 50;
```

Mark a report triaged:

```sql
update public.beta_feedback
set status = 'triaged'
where id = '<feedback-id>';
```

Status values: `new`, `triaged`, `fixed`, `deferred`, `closed`.
