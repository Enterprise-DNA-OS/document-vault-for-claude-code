---
description: "import m-files --file=export.csv --vault=stable-vault-name --object-type=Document --actor= [--mapping=map.json] [--manifest=files.json --files-root=directory] [--dry-run] "
---

# import

Read CLAUDE.md. import m-files --file=export.csv --vault=stable-vault-name --object-type=Document --actor= [--mapping=map.json] [--manifest=files.json --files-root=directory] [--dry-run]

Run `npm run vault -- import` with the arguments shown by `npm run vault -- help`. Use `--json` for reliable analysis. Read the current record first. Explain the result in the operator's words.

Read docs/replace-m-files.md first. Export all intended results and reconcile export limits. Map the real column headings and original files explicitly. Run --dry-run, reconcile object and file counts, then load only on instruction. An import returning metadata_only is not a completed file migration. Never interpret source State as a new approval.
