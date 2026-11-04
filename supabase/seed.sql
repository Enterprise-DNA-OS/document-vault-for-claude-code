INSERT INTO documents(id,code,title,class,owner,review_on,personal,purpose,record_kind,period_end,retain_until,hold_reason)
VALUES
 ('10000000-0000-4000-8000-000000000001','DOC-101','Supplier agreement','Contracts','Morgan',current_date-12,false,'Supplier terms','general',null,current_date+365,''),
 ('10000000-0000-4000-8000-000000000002','DOC-102','Quarterly account pack','Finance','Avery',current_date+20,false,'Tax evidence','nz-tax',(current_date-interval '1 year')::date,current_date+365,''),
 ('10000000-0000-4000-8000-000000000003','DOC-103','Customer contact consent','Unfiled','',current_date-30,true,'','general',null,null,''),
 ('10000000-0000-4000-8000-000000000004','DOC-104','Delivery dispute correspondence','Operations','Jamie',current_date+10,true,'Resolve delivery dispute','general',null,current_date-1,'Open dispute, preserve evidence'),
 ('10000000-0000-4000-8000-000000000005','DOC-105','Supplier agreement copy','Contracts','Morgan',current_date+15,false,'Duplicate review','general',null,current_date+365,'')
ON CONFLICT DO NOTHING;
INSERT INTO revisions(id,document_id,version,title,class,note,actor)
SELECT ('20000000-0000-4000-8000-'||right(id::text,12))::uuid,id,1,title,class,'Synthetic demonstration record','Demo seed' FROM documents WHERE code IN ('DOC-101','DOC-102','DOC-103','DOC-104','DOC-105') ON CONFLICT DO NOTHING;
