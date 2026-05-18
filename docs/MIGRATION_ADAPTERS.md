# Migration Adapters

This page captures the migration gaps that surfaced during a large HubSpot
portal mirror and how hscli should handle them in future runs.

## Upstreamed into hscli

- Read-only profiles now support HubSpot read endpoints that use `POST`
  payloads, such as CRM search, batch-read, lists search, CMS batch-read,
  communication-preference status batch-read, and association batch-read.
- Standard CRM objects expose batch create/update/upsert/archive flows.
- Custom object records expose batch read/create/update/archive flows.
- CRM association replay has `crm associations batch-read` and
  `crm associations batch-create`, including explicit v4 association types.
- Custom object schema PATCH fails early when the payload contains
  `properties`; use `crm properties batch-create <objectType>` instead.
- Property batch-create accepts source property dumps and removes common
  migration hazards: HubSpot-defined/read-only definitions, known reserved
  names, blank enum options, empty enums, and label/name collisions.
- Owner-reference properties keep `referencedObjectType` and automatically add
  `externalOptions: true`, which HubSpot requires for referenced options.
- Forms can translate legacy v2 payloads into v3 payloads, split oversized
  field groups, preflight missing target properties, and remap consent
  subscription type IDs.
- Business units can be captured through the internal browser-session endpoint
  when the public settings endpoint is unavailable.
- Business units can be created through the internal browser-session endpoint
  with `--skip-existing`, which removes the need for DevTools snippets in the
  common sandbox replay path.
- Permission sets can be listed/created/updated/deleted through the internal
  browser-session endpoint.
- Browser-session adapters share one guarded resolver: `--ui-domain` must be a
  HubSpot app host, and Netscape/JSON cookie exports are filtered to that host
  so unrelated cookies are not forwarded.
- User creates suppress invite/welcome emails by default. Passing
  `--allow-invite-email` is required before hscli will allow payloads such as
  `sendWelcomeEmail:true`.
- `crm migration id-map apply` remaps local batch payload fields without making
  HubSpot calls, which is the default path for owners, teams, business units,
  custom object type IDs, and other source-to-target IDs.

## Still Adapter-First

These surfaces are supported by migration-specific adapters or manual review
until their endpoint behavior is stable enough to promote to first-class CLI
commands:

- Permission-set assignment and team-assignment flows, especially when super
  admins must be left untouched.
- Team creation/update. The public team API is read-only on many portals, so
  creation stays adapter-first until the internal endpoint contract is proven.
- Workflow full replay and activation. hscli has workflow preflight and raw
  create/update commands, but a safe migration still needs an adapter that
  remaps action references, strips/replaces send-email actions for sandbox
  safety, lands workflows disabled, and performs a two-pass workflow ID remap.
- Subscription type replay through internal email/subscription-definition
  endpoints when public communication-preference definitions are incomplete for
  brand-scoped portals.
- Reports, dashboards, playbooks, snippets, and some sales-email assets. These
  are UI-only or internal-only on many portals and should stay documented as
  non-public migration exceptions unless endpoint coverage is proven.
- Static list membership replay for large datasets. Use hscli for list CRUD and
  membership operations, but rely on a migration adapter for batching, source
  filtering, dependency ordering, and explicit skip policies for out-of-scope
  lists.

## Operator Rule

Prefer hscli first for every read/write path. If a browser-session/internal
adapter is required, keep it explicit, scoped to one migration phase, rate
limited, idempotent, and backed by an id-map or verifier output that hscli can
consume later.
