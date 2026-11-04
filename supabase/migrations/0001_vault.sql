CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Append-only evidence: updates and deletes are forbidden'; END $$;
CREATE TABLE documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(length(trim(code))>0),
 title text NOT NULL CHECK(length(trim(title))>0), class text NOT NULL DEFAULT 'Unfiled', owner text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 current_version integer NOT NULL DEFAULT 1 CHECK(current_version>0),
 source_key text UNIQUE, source_metadata jsonb NOT NULL DEFAULT '{}',
 review_on date, personal boolean NOT NULL DEFAULT false, purpose text NOT NULL DEFAULT '',
 record_kind text NOT NULL DEFAULT 'general' CHECK(record_kind IN ('general','nz-tax')),
 period_end date, retain_until date, hold_reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX documents_code_ci ON documents(lower(code));
CREATE TABLE revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES documents(id),
 version integer NOT NULL CHECK(version>0), title text NOT NULL, class text NOT NULL,
 source_version text, source_metadata jsonb NOT NULL DEFAULT '{}',
 note text NOT NULL CHECK(length(trim(note))>0), actor text NOT NULL CHECK(length(trim(actor))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,version)
);
ALTER TABLE documents ADD CONSTRAINT current_revision FOREIGN KEY (id,current_version) REFERENCES revisions(document_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revisions(id),
 name text NOT NULL CHECK(length(trim(name))>0 AND name !~ '[/\\]'),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'), byte_size integer NOT NULL CHECK(byte_size>=0 AND byte_size<=10485760),
 content_base64 text NOT NULL, search_text text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(revision_id,name),
 CHECK(octet_length(decode(content_base64,'base64'))=byte_size)
);
CREATE TABLE reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES revisions(id),
 decision text NOT NULL CHECK(decision IN ('approved','changes-needed')), actor text NOT NULL CHECK(length(trim(actor))>0),
 note text NOT NULL CHECK(length(trim(note))>0), next_review_on date NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid REFERENCES documents(id),
 action text NOT NULL, actor text NOT NULL CHECK(length(trim(actor))>0), detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fingerprint text NOT NULL UNIQUE, vault text NOT NULL,
 csv_text text NOT NULL, mapping jsonb NOT NULL, row_count integer NOT NULL CHECK(row_count>0), actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER documents_touch BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['revisions','files','reviews','events','imports'] LOOP
 EXECUTE format('CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_record()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['documents','revisions','files','reviews','events','imports'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 END LOOP;
END $$;
CREATE VIEW document_position AS
 SELECT d.*,r.id AS revision_id,r.source_version,
 (SELECT count(*)::int FROM files f WHERE f.revision_id=r.id) AS file_count,
 (SELECT coalesce(sum(byte_size),0)::bigint FROM files f WHERE f.revision_id=r.id) AS bytes,
 rv.decision AS review_decision,rv.actor AS reviewer,rv.created_at AS reviewed_at
 FROM documents d JOIN revisions r ON r.document_id=d.id AND r.version=d.current_version
 LEFT JOIN LATERAL (SELECT * FROM reviews WHERE revision_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) rv ON true;
CREATE VIEW attention_queue AS
 SELECT id,code,title,owner,current_version,review_on,'unfiled'::text AS reason FROM document_position WHERE status='active' AND (class='Unfiled' OR owner='')
 UNION ALL SELECT id,code,title,owner,current_version,review_on,'missing document bytes' FROM document_position WHERE status='active' AND file_count=0
 UNION ALL SELECT id,code,title,owner,current_version,review_on,'review overdue' FROM document_position WHERE status='active' AND review_on<current_date
 UNION ALL SELECT id,code,title,owner,current_version,review_on,'changes requested' FROM document_position WHERE status='active' AND review_decision='changes-needed';
CREATE VIEW compliance_findings AS
 SELECT id,code,'NZ-IPP9'::text AS rule,'Personal information needs a documented purpose and review date'::text AS finding FROM documents WHERE personal AND (purpose='' OR review_on IS NULL)
 UNION ALL SELECT id,code,'NZ-IPP9','Personal information purpose review overdue' FROM documents WHERE personal AND review_on<current_date
 UNION ALL SELECT id,code,'NZ-TAX7','Tax record needs an income year end and a retention date' FROM documents WHERE record_kind='nz-tax' AND (period_end IS NULL OR retain_until IS NULL)
 UNION ALL SELECT id,code,'NZ-TAX7','Retention date is earlier than seven years after income year end' FROM documents WHERE record_kind='nz-tax' AND retain_until<(period_end+interval '7 years')::date
 UNION ALL SELECT id,code,'LOCAL-HOLD','Hold is active: manual review required before any disposal' FROM documents WHERE hold_reason<>''
 UNION ALL SELECT id,code,'LOCAL-BYTES','Current revision has metadata only: reconcile original files' FROM document_position WHERE file_count=0;
CREATE VIEW duplicate_files AS
 SELECT f.sha256,min(f.name) AS example_file,count(DISTINCT d.id)::int AS documents,string_agg(DISTINCT d.code,', ' ORDER BY d.code) AS codes
 FROM files f JOIN revisions r ON r.id=f.revision_id JOIN documents d ON d.id=r.document_id AND d.current_version=r.version
 GROUP BY f.sha256 HAVING count(DISTINCT d.id)>1;
REVOKE ALL ON document_position,attention_queue,compliance_findings,duplicate_files FROM PUBLIC;
