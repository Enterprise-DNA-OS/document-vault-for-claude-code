# Document record checks

This base checks recorded evidence. It does not certify legal compliance, make retention decisions or delete information. A qualified business owner resolves applicable duties, litigation holds, sector rules and jurisdiction before any disposal. Australian rules are not implemented by the NZ checks below.

## NZ-TAX7: tax evidence retention

[Inland Revenue: record keeping](https://www.ird.govt.nz/managing-my-tax/record-keeping) says records of cash and electronic sales and purchases must be kept for seven years. The base requires an income-year-end date and a retain-until date on records explicitly classified nz-tax, and flags retain-until earlier than seven years after period_end.

The income-year-end anchor is a conservative local policy calculation, not an interpretation that every document has the same statutory start date. Confirm the correct period, any longer request from Inland Revenue and sector duties. General documents are not silently classified as tax records. A check passing does not establish completeness, authenticity or lawful storage location.

## NZ-IPP9: personal information purpose review

[Office of the Privacy Commissioner: Principle 9](https://www.privacy.org.nz/privacy-principles/9/) says personal information should not be retained beyond its lawful purpose. For records explicitly marked personal, the base flags a missing purpose, missing review date or past review date. The law does not set a universal number of days for these reviews. The operator chooses and documents the review schedule.

The check cannot determine whether a purpose remains lawful or necessary. Review originals, other obligations and active holds before deciding retention or disposal. Backups and exported copies also need an agreed policy.

## Local checks

LOCAL-HOLD flags any active hold reason, including on archived documents. A hold is an operator record, not an automatic legal determination. Archiving never deletes bytes or removes the hold.

LOCAL-BYTES flags a current revision with no original file. Imported metadata alone is insufficient evidence to approve a document. The CLI refuses an approved review where no bytes are held. SHA-256 checks establish byte consistency, not authenticity, identity or a digital signature.

Revision and review evidence is append-only through database triggers. Actor labels identify the recorded operator, but do not authenticate them. Owners with database administration rights can bypass application controls. Use a reviewed access and backup design before multi-user deployment.

Sources checked 2026-11-04. No deletion, external transmission or regulatory filing command is provided.
