# System problems

Audit of Task Planner as of 13 September 2026. This is a live product, not a scaffold: NestJS, Next.js, Prisma, and Redis-backed realtime are in use.

It is not possible to claim every latent defect in a multi-domain SaaS is gone. This document lists **confirmed problems**. Items marked **Fixed** were corrected in the same pass as this file.

## Fixed in this pass

| ID | Severity | Problem | Fix |
| --- | --- | --- | --- |
| P1 | High | Stale `currentWorkspaceId` in `localStorage` (wrong user, deleted workspace) caused API calls with an invalid `x-workspace-id` before the shell corrected it. | `WorkspaceGate` hydrates, validates membership, and selects a valid workspace **before** app pages render. |
| P2 | High | File preview/download used a raw `fetch` that did not refresh an expired access token. | Shared `authorizedFetch` in `api-client` retries once after refresh. |
| P3 | Medium | Activity and notification clicks ignored `goal`, `todo`, `page`, `team`, and `invitation` entity types, so rows did not navigate. | Shared `entityHref()` used by activity and notifications. |
| P4 | Medium | Automations existed on the API with no UI, so users could not create or toggle rules. | `/app/automations` page plus sidebar item (owners/admins create and toggle). |
| P5 | Medium | `TASK_OVERDUE` automations never ran; `markOverdue` only updated SQL. | After marking overdue, the service dispatches `TASK_OVERDUE`. |
| P6 | Low | Deleting a page did not invalidate the pages list cache, so the index could still show the page. | `useDeletePage` invalidates list/detail queries. |
| P7 | Low | Notifications page hid load failures (empty state instead of an error). | Error message is shown when the query fails. |
| P8 | Low | README and architecture docs still said domain modules were scaffolds only. | Docs updated to match the running system. |

## Remaining product limits (not treated as bugs)

These are intentional or require environment/product decisions, not silent defects:

1. **AI** needs a configured provider key. Without it, assist/plan/extract fall back or report unavailable — expected.
2. **Email notifications** depend on SMTP. Invitations and mail may no-op in local `.env` without a mailer.
3. **Workspace details** can only be edited by **OWNER** (API `@WorkspaceScoped(OWNER)`). Admins can invite members but cannot rename the workspace.
4. **Automation actions** in the schema include status/priority/task mutations; the live dispatcher only **sends notifications**. The UI only exposes notify actions so users are not offered dead options.
5. **Marketing homepage** still uses Instrument Serif; the dashboard uses Inter/Poppins.
6. **Platform Users** (`/app/users`) is limited to system `ADMIN` / `SUPER_ADMIN`.
7. **Legacy Prisma models** (`AutomationTriggerRow`, `MeetingFile`, `LegacySubtask`, …) remain in the schema from earlier iterations. They are unused by current services. Removing them would be a destructive migration and was not done.

## How to re-check the fixes

1. Log in as user A, switch workspace, log out, log in as user B with a different workspace — dashboard should not fire 403s for A’s id.
2. Expire or wait out the access token, then preview a file — download should succeed after refresh.
3. Open Activity for a team event — it should go to Teams, not sit unlinked.
4. As owner, create an “on complete, notify assignee” automation, complete a task — assignee gets an in-app notification.
5. Create a past-due open task, reload Tasks/My Day — status becomes overdue and overdue automations fire.
6. Delete a page and return to Pages — it should be gone without a hard refresh.
