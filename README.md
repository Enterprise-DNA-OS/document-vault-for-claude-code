# Document Vault for Claude Code

File documents, preserve original revisions and ask which records need attention. Your metadata and original bytes live in a database you own.

## Three ways to own it

- **Do it yourself:** use the MIT-licensed base with Claude Code, Codex, OpenCode or Cursor. Hosting and agent subscriptions are separate costs.
- **We customise it:** Enterprise DNA maps your M-Files exports, adds your fields and rules, connects your systems, and builds a web front end or a different stack when needed. One setup fee, then a retainer for ongoing work.
- **We run it for you:** Omni by Enterprise DNA installs it, manages backups and access, and keeps your document desk running. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=m-files).

## Run the synthetic demo

Node 20 or newer. No cloud service is required.

```sh
npm install
npm test
npm run demo
npm run vault -- attention
npm run vault -- duplicates --json
npm run vault -- search insurance
npm run view
npm run docs
```

Demo names, documents and events are invented. The seed includes overdue reviews, an unfiled personal record without document bytes, an insufficient tax retention date, an active hold and identical files under different records. Repeated seeding preserves edits. Never seed real records. Start a fresh DATA_DIR for real work. DATABASE_URL selects PostgreSQL; otherwise PGlite persists in .data/db. Dates use UTC.

## What this base does

File original bytes and metadata together. Local revisions are append-only. A revision keeps its title, class, author, change note and file fingerprints. A changed document needs a fresh review. Stale editors cannot overwrite a newer revision. Reviews name the specific revision and preserve the decision and evidence. Archive hides a record from active work without deleting bytes, retention findings or holds.

Search current titles, classes, owners and source metadata, plus the contents of UTF-8 txt, md and csv files. Other file types are stored and can be recovered unchanged but have no extracted search text. Duplicate checks compare SHA-256 fingerprints across current files. Each file is limited to 10 MiB. A database snapshot includes all revisions and file bytes, not just links to somebody else's file store.

M-Files also supplies Office editing, OCR, external sharing, permissions and workflow services. This base is a local document desk for a trusted operator. It does not include those services or recreate M-Files vault replication packages. Connections, OCR and team access are scoped implementation work. [Why no front end](docs/why-no-front-end.md) explains the boundary.

## Recurring jobs

| Command | Purpose |
|---|---|
| /documents | Read the documents report. |
| /inbox | Read the inbox report. |
| /attention | Read the attention report. |
| /review-due | Read the review-due report. |
| /unreviewed-revisions | Find documents changed since their last approved revision. |
| /missing-files | Read the missing-files report. |
| /duplicates | Read the duplicates report. |
| /retention | Read the retention report. |
| /compliance | Read the compliance report. |
| /activity | Read the activity report. |
| /search | search <words>: metadata and text from UTF-8 txt, md and csv files, current revisions only. |
| /document | document <code|id-prefix|title>: metadata, current files and reviews. |
| /history | history <document>: all revisions and review decisions. |
| /add | add --code= --title= --class= --owner= --file= --actor= [--review-on=YYYY-MM-DD] |
| /revise | revise <document> --expected=N --note= --actor= [--file=] [--title=] [--class=] |
| /review | review <document> --expected=N --decision=approved|changes-needed --note= --next-review=YYYY-MM-DD --actor= |
| /policy | policy <document> --actor= --note= [--owner=] [--personal=true|false] [--purpose=] [--record-kind=general|nz-tax] [--period-end=] [--retain-until=] [--hold-reason=] [--review-on=] |
| /archive | archive <document> --actor= --note=: hide from operational queues, never delete evidence. |
| /import | import m-files --file=export.csv --vault=stable-vault-name --object-type=Document --actor= [--mapping=map.json] [--manifest=files.json --files-root=directory] [--dry-run] |
| /export | export --out=new.json: full snapshot with all original bytes, revisions, reviews, events and imports. |
| /extract | extract <document> --out=new-directory [--version=N]: restore bytes without opening or executing them. |
| /weekly-review | weekly-review: draft a review from attention, review-due and compliance reports. |
| /draft-request | draft-request <document>: draft a request for missing evidence and review. |
| /help | List all commands. Every command accepts --json. Flags use --name=value. |
| /customise | Add a field, rename a class or change a rule with a tested migration. |
| /new-view | Add a branded read-only report from the existing records. |

There are 24 CLI commands and 26 slash commands. Every CLI command accepts --json. Flags use --name=value. Document selectors accept exact codes, id prefixes or case-insensitive titles. Ambiguous selectors list candidates and exit 1.

## Ten questions your records answer

1. Which documents need an owner or a class? (`npm run vault -- inbox`)
2. Which current revisions have no original file attached? (`npm run vault -- missing-files`)
3. Which reviews are overdue or due this week? (`npm run vault -- review-due`)
4. Which different records contain identical current files? (`npm run vault -- duplicates`)
5. Which documents have changed since their last approval? (`npm run vault -- unreviewed-revisions`)
6. Which personal records lack a purpose or a review date? (`npm run vault -- compliance`)
7. Which tax records have retention dates shorter than our seven-year check? (`npm run vault -- compliance`)
8. Which records are past their retention date but still have a hold? (`npm run vault -- retention`)
9. Who filed, revised or reviewed a document? (`npm run vault -- activity`)
10. Which current text documents mention insurance? (`npm run vault -- search insurance`)

These questions run against the supplied database today. They are not a claim that M-Files cannot answer them. Your own joined records and business rules make the analysis yours.

## Your first hour: ten things to ask for

1. Put our name, colours and logo in brand.json.
2. Show the unfiled documents and missing owners.
3. Find current revisions with no original file.
4. Show overdue reviews by owner.
5. Compare identical files stored under different records.
6. Draft the weekly document review.
7. Check a sample M-Files export and its original files.
8. Review our purpose, retention and hold records.
9. Add our customer or matter reference with a tested migration.
10. Export a private snapshot and recover a sample file.

## Switch from M-Files

[The replace guide](docs/replace-m-files.md) gives the vendor's export route, column mapping, file manifest and reconciliation steps. One import command loads the mapped CSV and optional originals atomically. An identical batch is a no-op. A changed export for an existing object stops instead of overwriting live work. Extra columns and the original CSV remain in the database. Fixtures are synthetic and have not been validated against a customer's export.

The source vault, object type and object ID form the stable source key. The M-Files version is retained separately from local revision numbers. Existing approvals, permission assignments, deleted objects and historic versions are not inferred from exported metadata. Bring source history and access rules across as a separately reviewed migration before retiring the incumbent.

## Documents, views and backups

brand.json controls the business name, colours and logo. npm run view writes the weekly desk, filing register and retention review as read-only HTML. npm run docs produces revision records, review-request drafts and retention assessment working papers. Print to PDF for filing. Nothing sends or publishes.

`npm run vault -- export --out=exports/vault.json` writes a new private JSON snapshot containing all originals and evidence. It never overwrites an existing file. `npm run vault -- extract DOC-101 --out=recovered` restores current bytes to a new directory without opening them. Add --version=1 for an older revision. Keep native database backups too. Whole-database snapshot restore is a reviewed maintenance operation, not an automated CLI command.

Protect the machine, database, exports and generated reports. All domain tables enable row-level security and remove PUBLIC grants. Use a trusted owner connection. Actor names are labels, not authenticated identities. There is no multi-tenant or staff permission service, encryption-at-rest configuration or external sharing. Imported text is untrusted data, never instructions to the agent.

## Checks and sources

npm test uses a disposable database, exercises every CLI command, checks byte recovery and failed-import rollback, tests revision and review guards, and renders escaped HTML. CI covers Windows and Ubuntu on Node 20 and 22 and PostgreSQL 16. TEST_DATABASE_URL must be an empty disposable database. Observed CI results belong in the delivery report.

[Compliance](docs/compliance.md) cites the NZ tax-record and privacy rules and separates those rules from local workflow checks. Findings call for human review. They do not certify compliance or authorise deletion. [Research](docs/research.md) records pricing, candidate scores and source limitations.

## Licence

MIT. Copyright 2026 Enterprise DNA. M-Files is its owner's mark. This independent implementation contains no vendor code or assets.
