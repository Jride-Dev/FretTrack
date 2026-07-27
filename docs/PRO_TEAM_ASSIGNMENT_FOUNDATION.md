# Pro Team Assignment Foundation

FretTrack `0.2.9-beta.2` establishes the first persisted multi-user job workflow before Stripe work. A real beta shop needs multiple employees to coordinate current repairs now; billing automation can follow after the workflow and entitlement boundaries have been tested.

## Primary technician assignment

Each job may reference one `public.shop_members.id` through `jobs.assigned_member_id`. The shop membership UUID is authoritative; names and emails are not. `assigned_member_display_name` is a non-authoritative snapshot used only so a historical job remains understandable if that membership is later removed. Existing jobs remain unassigned and are not rewritten.

Only confirmed, unblocked members of the job's own shop can receive a new assignment. Database validation rejects inactive or cross-shop memberships. Assignment may be cleared at any time by an authorized user.

## Assignment permission matrix

| Role | View assignment | Assign/reassign | Clear | Self-service |
| --- | --- | --- | --- | --- |
| Owner | Yes | Any active same-shop member | Yes | Included in full management |
| Admin | Yes | Any active same-shop member | Yes | Included in full management |
| Technician | Yes | No assignment of another member | Only when assigned to self | May claim an unassigned job; may remove self |
| Viewer | Yes | No | No | No |

These rules require existing job-write access, a writable shop lifecycle, and the team-assignment entitlement. They do not weaken normal job permissions.

## Job workflows

New Job defaults to **Unassigned** and offers only choices allowed for the current role. It never assigns the creator automatically. Job Detail shows the current technician to every role that can already view the job. Owners/admins receive a same-shop active-member selector; technicians receive **Assign myself** or **Remove myself** only when policy allows; viewers and unavailable plans receive readable, disabled output.

Changing assignment does not change job status.

## Current Jobs filtering

The full Current Jobs page includes an Assigned Technician column, active-member filter, **Unassigned** option, and assigned-technician sorting. A removed or inactive historical assignee displays from the saved fallback with an inactive label. Existing search, priority, status, due, scope, and sorting behavior remains.

The compact Current Jobs sidebar remains the restrained summary layout and does not add full assignment detail.

## Team workload

Shop Settings contains a modest Pro Team Workload summary:

- active jobs assigned to each active member;
- overdue assigned jobs using existing promise-date logic;
- active unassigned jobs;
- links into Current Jobs with the matching assignee filter.

This is workload visibility. It does not create productivity scores, rankings, efficiency grades, time surveillance, or employee performance scoring.

## Audit behavior

The targeted assignment RPC writes `job_assigned`, `job_reassigned`, or `job_unassigned` events with the actor, prior membership ID/name, and new membership ID/name. IDs remain authoritative. Audit insertion follows the existing safe-event principle: a logging failure is warned about but does not corrupt an otherwise valid assignment update.

## Shop versus Pro

This phase does not change the existing `team_members` entitlement, membership rows, role management, or shop account access. Those remain governed by the current Team Members lifecycle. The new `team_assignment` entitlement is the advanced Pro workflow boundary:

- Shop/non-Pro: existing assignment data remains readable; assignment filters, workload view, and write controls degrade to a locked/read-only state.
- Pro: advanced assignment controls, Current Jobs assignee filtering, and workload visibility are enabled.
- Enterprise compatibility: enabled with Pro behavior.

No historical assignment is hidden when a subscription expires.

## Beta entitlement behavior

Active Pro trials receive `team_assignment`. An approved beta member in a writable beta shop also keeps an explicit server-validated access path so approved testers such as the current UK beta shop can exercise the workflow during the beta lifecycle. Expired, canceled, or read-only lifecycle states still block assignment writes.

## Concurrency limitations

Assignment changes use a targeted RPC rather than the normal full-record job save. The caller sends `assignment_updated_at`; the database locks the job row and rejects a stale assignment timestamp with a refresh-and-retry error. Ordinary job updates intentionally omit assignment columns, so editing notes or status from an older screen cannot overwrite a coworker's newer assignment.

This is optimistic concurrency for one field, not realtime collaborative editing. The app refreshes/reconciles assignment state after a successful change. Full presence, live cursors, conflict merging, and realtime collaboration remain future work.

## Migration

`20260727151302_pro_team_assignment_foundation.sql` adds the nullable assignment columns and index, entitlement rows, same-shop/active-member validation, role-enforcement trigger, safe member-list RPC, targeted assignment RPC, audit events, and assignment-aware job creation.

The migration is intentionally not applied by this branch.

## Remaining Phase 2 work

- richer invitation and inactive-member lifecycle UX;
- optional assignment-aware scheduling shortcuts;
- notification preferences for assignment changes;
- broader concurrency/realtime collaboration;
- final paid-plan packaging and limits;
- Stripe products, checkout, portal, webhooks, and automated billing.

No billing or Stripe code is included in this phase.
