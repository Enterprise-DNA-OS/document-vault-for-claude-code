---
description: "review <document> --expected=N --decision=approved|changes-needed --note= --next-review=YYYY-MM-DD --actor= "
---

# review

Read CLAUDE.md. review <document> --expected=N --decision=approved|changes-needed --note= --next-review=YYYY-MM-DD --actor=

Run `npm run vault -- review` with the arguments shown by `npm run vault -- help`. Use `--json` for reliable analysis. Read the current record first. Explain the result in the operator's words.

Only record a business action the operator instructed. Require their actor label and evidence. For revise and review, pass the current --expected version. A review approves that revision only. Actor labels are not authentication. No messages are sent.
