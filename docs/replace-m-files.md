# Switch from M-Files

## Export from the source

M-Files documents [exporting search results](https://userguide.m-files.com/user-guide/latest/eng/exporting_search_results.html): expose every intended result, use Export in the listing context menu, select the information, and choose whether to include object files. Export limits depend on the client and configuration. The [web export guide](https://userguide.m-files.com/user-guide/web/latest/deu/web_exporting_to_csv.html) documents a limit of 1,000 items and says the new desktop client also exports files. The English web guide now redirects to [the current export help page](https://empower.m-files.com/content/web-exporting-to-csv).

Choose one vault and object type per import. Include the object ID, title and source version. Include class and owner when available. Export all required batches and count them against the source before proceeding. Keep the untouched export and files in a protected folder. Exporting a view is not a backup of a whole vault.

## Map the actual headings

The supplied synthetic fixture uses ID, Name or title, Version, Class and Owner. It demonstrates the import contract, not a guaranteed set of column names in every M-Files installation. Properties and language differ between vaults. Create a mapping with the exact headings in your export:

```json
{
  "id": "ID",
  "title": "Name or title",
  "version": "Version",
  "class": "Class",
  "owner": "Owner"
}
```

id, title and version are required. Omit class or owner from a custom mapping if your export lacks those properties. Such records enter the filing inbox. Unknown columns remain in source_metadata, including workflow, state and custom properties. The original CSV and mapping are stored too. They do not become local approval decisions or retention policies automatically.

Input is UTF-8 comma-separated CSV, including BOM, quoted commas, doubled quotes and embedded newlines. Convert other delimiters or encodings explicitly and retain the original. Duplicate headers, unequal rows, blank required fields and duplicate source IDs stop the whole batch. Source versions must be numeric. Object IDs are treated as text, scoped by vault and object type.

## Match the original files

For files exported alongside the CSV, make a reviewed manifest that maps each source object and version to the relative paths of its originals. This manifest is our migration mapping, not an M-Files export format. Multiple files per object are supported. Never infer a match from a similar title alone.

```json
[
  {"id": "41", "version": "3", "files": ["terms.txt"]}
]
```

Each file must be at most 10 MiB. Paths must stay within files-root, including after resolving symlinks. Filenames must be portable to Windows and Linux and unique within each object. UTF-8 txt, md and csv content is searchable. PDFs, Office documents and other binary files are retained exactly but need a separately scoped text-extraction step for content search.

## Run the one-command import

First run against a fresh demo or staging database:

```sh
npm run vault -- import m-files --file=fixtures/m-files.csv --vault=demo-vault --object-type=Document --mapping=fixtures/mapping.json --manifest=fixtures/files.json --files-root=fixtures --actor=Migration-reviewer --dry-run --json
```

Check imported, files and metadata_only counts. Remove --dry-run to commit the same batch. For real work, use a new database and your protected export paths, never the demo seed. Without manifest and files-root the same command imports metadata only and flags every record under missing-files. That is not a completed document migration.

All rows and bytes commit together or roll back together. A fingerprint detects an identical repeated batch. A different batch containing an existing source object is rejected, including when it would add a missing original. Reconcile it explicitly: use revise with the expected local version to attach a reviewed single original, or write a tested migration for multi-file history. This avoids silent overwrites and false approvals.

## Reconcile before switching

Compare counts by vault, object type and class. Recover samples with extract, compare their bytes, and inspect every missing-files record. Check duplicates, ownership, review dates and retention findings. Review imported source versions and custom fields. File originals are stored in the database as base64 with their byte counts and SHA-256 fingerprints.

The normal view/search export is a selected snapshot. It does not prove that prior revisions, deleted objects, permissions, audit trails, signatures, workflow definitions or external links have been moved. Preserve historical archives and map access rules separately. Never claim that a source State column proves that someone reviewed the imported bytes.

Run the two systems alongside each other until the owner confirms file counts, recovery, history, access and workflows. A small, clean selected set can be imported in one working day. Whole-vault migration effort depends on volume, file sizes, export limits and the history required. Do not cancel M-Files on the strength of a successful metadata import alone.

## Leave this system

export writes a new complete JSON snapshot containing all document and file records, revisions, reviews, events and source imports. extract restores a selected revision's originals without opening or executing them. Keep native database backups as well. Full restore is a reviewed maintenance task and requires count and hash reconciliation.

Sources checked 2026-11-04. Fixtures are invented. No customer M-Files export was available for validation in this build.
