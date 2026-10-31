# Exact deployed-handler synthetic baseline — RATA-3165

Owner: Luna. Consumer: Alex / native auth-and-ACL implementation owner.
Source: deployed-byte evidence on RATA-3174 document acceptance-evidence revision
9dbbb33e-0e05-44f4-a2f6-48e779d0bc97. Exact handler from commit
68ce82879a2c74b67bf86e3040eb76658c2b818c, SHA-256
0ecff4e5acf825731abfad8cbc3f072977de67173e6366e807b046a2a1357d79.
The copied handler is byte-identical, not edited or replaced by the policy oracle.

## Executed outcome

8/8 baseline characterization tests PASS; **privacy/security acceptance FAILS**.
The passing checks reproduce absence of authorization, not safe containment.
No/wrong key is rejected before storage; one shared-key caller can choose another
project, turn off project-only recall, read another-project direct ID, list/review
its records, fetch a full-memory trace, claim an arbitrary actor_id and confirm
other-project data as instruction-grade. Stale filters default recall but not
include_stale/direct-ID/list/history-derived reads. restrict_scope remains visible
through direct ID and caller-selected personal recall; it is not quarantine.

Execution uses the real Hono/zod handler and dependency substitution through an
import map: in-memory Supabase adapter, stub embedding result, empty edge type
import, and intercepted Deno.serve (no listener). Deno has no network or read/write
capability grant, only four named env variables populated with synthetic values.
This characterizes actual handler routing/filtering and request authentication,
not real Supabase/RLS, deployed latency, live schema, data custody or export systems
outside this handler. All input/records/IDs/keys are disposable synthetic values.
Review before/after history and trace-derived content were checked in memory.
Exact fixture restoration succeeds; this is not a deployed quarantine/restore.
No live API, private record, real key, provider model request or deployed change.

One initial run failed type-check because the new fake adapter's declaration was
wrong. The fake declaration was corrected; the exact handler stayed unchanged.
The accepted command type-checks then runs 8 tests; no --no-check bypass.
See executed-checks.json for command, exit, measured duration and complete output.

## Protected remedy packet (proposal only)

ACTION: establish verified caller-bound authorization covering every handler route.
REASON: shared-key possession and caller-supplied project/actor fields do not identify
Alex or Luna and cannot prevent cross-project/direct-ID/trace/review bypass.
SYSTEM: OB1 agent-memory API auth, shared route authorization and separately reviewed
Supabase grants/schema/deployment.
EXACT CHANGE: choose and approve a verifiable principal binding; reject unknown
principals; derive grants from verified subject, not request fields; enforce them
before recall/direct ID/list/review/history/usage/trace/derived output; implement
reversible scoped quarantine with read/export enforcement and audit attribution.
No token issuer, real subject identifiers, credential values or live schema are
invented. Those owner decisions are required before an executable migration patch.
RISK: accidental denial of existing legitimate clients or incomplete export boundary.
ROLLBACK: retain exact deployed source revision/bundle and schema/grant baseline;
prepare scoped inverse migration and synthetic restoration checks before deployment.
No production, authentication, permission, schema, credential or quarantine change
is authorized by these baseline tests. Keep RATA-3165 and J09 unaccepted pending the
exact design decision, implementation and deployed allow/deny/rollback evidence.

Original untracked policy model/tests/privacy specification hashes are unchanged.
Current task checkout and new harness/evidence are retained; no cleanup.

KNOWLEDGE: none — owner-local security acceptance evidence only; no private source
or shared-canon publication.
