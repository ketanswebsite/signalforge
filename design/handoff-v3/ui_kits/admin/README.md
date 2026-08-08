# UI kit — SutrAlgo admin portal

Internal tool. Same design system, denser layout, side navigation instead of a top nav.

Built from `public/admin-v2.html` and the admin JS modules in `public/js/` (`admin-analytics-v2`, `admin-user-management-v2`, `admin-subscriptions`, `admin-signal-testing`, `admin-communication-hub`, `admin-database`, `admin-query-builder`, `admin-audit`, `admin-rbac`, `admin-settings`).

## Sections
| Section | Covers |
| --- | --- |
| Analytics | Customers, trials, conversion, revenue, plus a "needs a look" list |
| Users | Search, filter, open a person in a sheet, change plan or grant complimentary access |
| Subscriptions | Payment history and the money that needs chasing |
| Signal testing | Change the formula's parameters and replay history before publishing |
| Broadcasts | One message to a segment, by email or Telegram, with a send-me-a-test step |
| Database | Table list, read-only query box, results as a table |
| Audit log | Every change including automated jobs, filterable by people vs system |
| Settings & roles | Platform switches, an RBAC matrix, and a danger zone |

## Notes
Admin reuses `../platform/chart.spec.jsx` rather than duplicating it. Screens live in `sections.spec.jsx`; the shell (masthead + side nav) in `admin-shell.spec.jsx`. Below 960px the side nav becomes a horizontal scrolling strip and the layout stacks — the portal is usable on a tablet, though it is not designed for a phone.
