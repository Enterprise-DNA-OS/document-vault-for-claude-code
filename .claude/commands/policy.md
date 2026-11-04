---
description: "policy <document> --actor= --note= [--owner=] [--personal=true|false] [--purpose=] [--record-kind=general|nz-tax] [--period-end=] [--retain-until=] [--hold-reason=] [--review-on=] "
---

# policy

Read CLAUDE.md. policy <document> --actor= --note= [--owner=] [--personal=true|false] [--purpose=] [--record-kind=general|nz-tax] [--period-end=] [--retain-until=] [--hold-reason=] [--review-on=]

Run `npm run vault -- policy` with the arguments shown by `npm run vault -- help`. Use `--json` for reliable analysis. Read the current record first. Explain the result in the operator's words.

Only record a business action the operator instructed. Require their actor label and evidence. For revise and review, pass the current --expected version. A review approves that revision only. Actor labels are not authentication. No messages are sent.
