#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';

export const reads={
 documents:"SELECT code,title,class,owner,current_version,file_count,review_decision,status FROM document_position ORDER BY code",
 inbox:"SELECT code,title,class,owner FROM documents WHERE status='active' AND (class='Unfiled' OR owner='') ORDER BY code",
 attention:"SELECT code,title,owner,reason,review_on FROM attention_queue ORDER BY review_on NULLS FIRST,code,reason",
 'review-due':"SELECT code,title,owner,current_version,review_on,review_decision FROM document_position WHERE status='active' AND (review_on IS NULL OR review_on<=current_date+7) ORDER BY review_on NULLS FIRST,code",
 'unreviewed-revisions':"SELECT d.code,d.title,d.current_version,max(r.version) AS last_approved_version FROM documents d JOIN revisions r ON r.document_id=d.id JOIN reviews v ON v.revision_id=r.id AND v.decision='approved' WHERE d.status='active' GROUP BY d.id HAVING max(r.version)<d.current_version ORDER BY d.code",
 'missing-files':"SELECT code,title,source_key,current_version FROM document_position WHERE file_count=0 ORDER BY code",
 duplicates:'SELECT example_file,documents,codes,sha256 FROM duplicate_files ORDER BY codes',
 retention:"SELECT code,title,record_kind,period_end,retain_until,hold_reason FROM documents WHERE retain_until<=current_date OR hold_reason<>'' ORDER BY retain_until,code",
 compliance:'SELECT code,rule,finding FROM compliance_findings ORDER BY code,rule',
 activity:'SELECT d.code,e.action,e.actor,e.detail,e.created_at FROM events e LEFT JOIN documents d ON d.id=e.document_id ORDER BY e.created_at,e.id',
};
export const help={
 ...Object.fromEntries(Object.keys(reads).map(k=>[k,'Read the '+k+' report.'])),
 search:'search <words>: metadata and text from UTF-8 txt, md and csv files, current revisions only.',
 document:'document <code|id-prefix|title>: metadata, current files and reviews.',
 history:'history <document>: all revisions and review decisions.',
 add:'add --code= --title= --class= --owner= --file= --actor= [--review-on=YYYY-MM-DD]',
 revise:'revise <document> --expected=N --note= --actor= [--file=] [--title=] [--class=]',
 review:'review <document> --expected=N --decision=approved|changes-needed --note= --next-review=YYYY-MM-DD --actor=',
 policy:'policy <document> --actor= --note= [--owner=] [--personal=true|false] [--purpose=] [--record-kind=general|nz-tax] [--period-end=] [--retain-until=] [--hold-reason=] [--review-on=]',
 archive:'archive <document> --actor= --note=: hide from operational queues, never delete evidence.',
 import:'import m-files --file=export.csv --vault=stable-vault-name --object-type=Document --actor= [--mapping=map.json] [--manifest=files.json --files-root=directory] [--dry-run]',
 export:'export --out=new.json: full snapshot with all original bytes, revisions, reviews, events and imports.',
 extract:'extract <document> --out=new-directory [--version=N]: restore bytes without opening or executing them.',
 'weekly-review':'weekly-review: draft a review from attention, review-due and compliance reports.',
 'draft-request':'draft-request <document>: draft a request for missing evidence and review.',
 help:'List all commands. Every command accepts --json. Flags use --name=value.',
};
const allowed={
 ...Object.fromEntries(Object.keys(reads).map(k=>[k,[]])),search:[],document:[],history:[],help:[],
 add:['code','title','class','owner','file','actor','review-on'],revise:['expected','note','actor','file','title','class'],
 review:['expected','decision','note','next-review','actor'],policy:['actor','note','owner','personal','purpose','record-kind','period-end','retain-until','hold-reason','review-on'],
 archive:['actor','note'],import:['file','vault','object-type','actor','mapping','manifest','files-root','dry-run'],export:['out'],extract:['out','version'],'weekly-review':[],'draft-request':[]
};
export function parseArgs(argv){const flags={},pos=[];for(const a of argv){if(a.startsWith('--')){const at=a.indexOf('=');const k=a.slice(2,at<0?undefined:at);if(Object.hasOwn(flags,k))throw Error('Repeated flag: '+k);flags[k]=at<0?true:a.slice(at+1);}else pos.push(a);}return {pos,flags};}
const hash=(v)=>createHash('sha256').update(v).digest('hex');
const need=(f,k)=>{if(typeof f[k]!=='string'||!f[k].trim())throw Error('Required --'+k+'=value');return f[k].trim();};
const date=(s)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Use a valid ISO calendar date: '+s);return s;};
const integer=(v)=>{if(!/^[1-9]\d*$/.test(String(v))||!Number.isSafeInteger(Number(v)))throw Error('Expected a positive integer');return Number(v);};
const safeName=(s)=>{if(!s||s==='.'||s==='..'||/[\\/\x00-\x1f]/.test(s)||/[<>:"|?*]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))throw Error('Unsafe or nonportable filename: '+s);return s;};
function loadFile(file){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>10485760)throw Error('Each file must be a regular file no larger than 10 MiB');const bytes=fs.readFileSync(file);const name=safeName(path.basename(file));const text=/\.(txt|md|csv)$/i.test(name)?new TextDecoder('utf-8',{fatal:true}).decode(bytes):'';return {name,sha256:hash(bytes),byte_size:bytes.length,content_base64:bytes.toString('base64'),search_text:text};}
async function transaction(db,fn,dry=false){await db.exec('BEGIN');try{const out=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return out;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function event(db,id,action,actor,detail){await db.query('INSERT INTO events(document_id,action,actor,detail) VALUES($1,$2,$3,$4)',[id,action,actor,JSON.stringify(detail)]);}
async function insertFile(db,revision,file){await db.query('INSERT INTO files(revision_id,name,sha256,byte_size,content_base64,search_text) VALUES($1,$2,$3,$4,$5,$6)',[revision,file.name,file.sha256,file.byte_size,file.content_base64,file.search_text]);}
export async function resolveDocument(db,input,lock=false){
 if(!input)throw Error('A document code, id prefix or title is required');
 const all=await db.query('SELECT * FROM documents ORDER BY code');const q=input.toLowerCase();
 let matches=all.filter(d=>d.code.toLowerCase()===q||d.id===input);
 if(!matches.length)matches=all.filter(d=>d.id.toLowerCase().startsWith(q)||d.title.toLowerCase().includes(q));
 if(matches.length!==1){const e=Error(matches.length?'Ambiguous document. Choose an exact code.':'Document not found');e.candidates=matches.map(d=>({id:d.id,code:d.code,title:d.title}));throw e;}
 return lock?(await db.query('SELECT * FROM documents WHERE id=$1 FOR UPDATE',[matches[0].id]))[0]:matches[0];
}
async function revision(db,d,n,actor,note,{title=d.title,cls=d.class,metadata=d.source_metadata,sourceVersion=null}={}){
 const r=(await db.query('INSERT INTO revisions(document_id,version,title,class,source_version,source_metadata,note,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[d.id,n,title,cls,sourceVersion,metadata,note,actor]))[0];return r.id;
}
const assertCurrent=(d,f)=>{if(d.status!=='active')throw Error('Document is archived');if(integer(need(f,'expected'))!==d.current_version)throw Error('Revision changed. Read the current version and retry.');};
function privateWrite(file,body){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true,mode:0o700});fs.writeFileSync(file,body,{flag:'wx',mode:0o600});}
const summaryColumns='code,title,class,owner,current_version,file_count,review_on,review_decision,status';
export async function run(db,argv){
 const {pos,flags:f}=parseArgs(argv);const [cmd='help',...args]=pos;
 if(!Object.hasOwn(help,cmd))throw Error('Unknown command: '+cmd);
 for(const key of Object.keys(f))if(key!=='json'&&!allowed[cmd].includes(key))throw Error('Unknown flag --'+key+' for '+cmd);
 for(const key of ['json','dry-run'])if(Object.hasOwn(f,key)&&f[key]!==true)throw Error('--'+key+' takes no value');
 const maxArgs=['search'].includes(cmd)?Infinity:['document','history','revise','review','policy','archive','import','extract','draft-request'].includes(cmd)?1:0;
 if(args.length>maxArgs)throw Error('Too many arguments for '+cmd);
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='help')return Object.entries(help).map(([command,usage])=>({command,usage}));
 if(cmd==='search'){
  const q=args.join(' ').trim();if(!q)throw Error('Search words are required');
  return db.query(`SELECT DISTINCT ${summaryColumns.split(',').map(c=>'p.'+c).join(',')} FROM document_position p LEFT JOIN files f ON f.revision_id=p.revision_id WHERE strpos(lower(p.title||' '||p.class||' '||p.owner||' '||p.source_metadata::text||' '||coalesce(f.search_text,'')),lower($1))>0 ORDER BY p.code`,[q]);
 }
 if(cmd==='document'||cmd==='history'){
  const d=await resolveDocument(db,args[0]);
  const revisions=await db.query('SELECT id,version,title,class,source_version,note,actor,created_at FROM revisions WHERE document_id=$1 ORDER BY version',[d.id]);
  const reviews=await db.query('SELECT r.version,v.decision,v.actor,v.note,v.next_review_on,v.created_at FROM reviews v JOIN revisions r ON r.id=v.revision_id WHERE r.document_id=$1 ORDER BY r.version,v.created_at',[d.id]);
  if(cmd==='history')return {code:d.code,revisions,reviews};
  const files=await db.query('SELECT f.id,f.name,f.sha256,f.byte_size FROM files f JOIN revisions r ON r.id=f.revision_id WHERE r.document_id=$1 AND r.version=$2 ORDER BY name',[d.id,d.current_version]);
  return {document:d,files,reviews};
 }
 if(cmd==='add'){
  const actor=need(f,'actor'),file=loadFile(need(f,'file'));const code=need(f,'code'),title=need(f,'title'),cls=need(f,'class'),owner=need(f,'owner');
  const reviewOn=f['review-on']?date(f['review-on']):null;
  return transaction(db,async()=>{const d=(await db.query('INSERT INTO documents(code,title,class,owner,review_on) VALUES($1,$2,$3,$4,$5) RETURNING *',[code,title,cls,owner,reviewOn]))[0];const r=await revision(db,d,1,actor,'Initial filing');await insertFile(db,r,file);await event(db,d.id,'filed',actor,{code,sha256:file.sha256});return {code,version:1};});
 }
 if(cmd==='revise'){
  const actor=need(f,'actor'),note=need(f,'note');const incoming=f.file?loadFile(need(f,'file')):null;
  return transaction(db,async()=>{const d=await resolveDocument(db,args[0],true);assertCurrent(d,f);const title=f.title===undefined?d.title:need(f,'title'),cls=f.class===undefined?d.class:need(f,'class');
   const n=d.current_version+1,r=await revision(db,d,n,actor,note,{title,cls});
   if(incoming)await insertFile(db,r,incoming);else await db.query(`INSERT INTO files(revision_id,name,sha256,byte_size,content_base64,search_text) SELECT $1,f.name,f.sha256,f.byte_size,f.content_base64,f.search_text FROM files f JOIN revisions v ON v.id=f.revision_id WHERE v.document_id=$2 AND v.version=$3`,[r,d.id,d.current_version]);
   await db.query('UPDATE documents SET current_version=$1,title=$2,class=$3,review_on=current_date WHERE id=$4',[n,title,cls,d.id]);await event(db,d.id,'revised',actor,{from:d.current_version,to:n,note});return {code:d.code,version:n,review:'required'};
  });
 }
 if(cmd==='review'){
  const actor=need(f,'actor'),note=need(f,'note'),decision=need(f,'decision'),next=date(need(f,'next-review'));
  if(!['approved','changes-needed'].includes(decision))throw Error('Invalid decision');
  return transaction(db,async()=>{const d=await resolveDocument(db,args[0],true);assertCurrent(d,f);
   const p=(await db.query('SELECT * FROM document_position WHERE id=$1',[d.id]))[0];
   if(decision==='approved'&&!p.file_count)throw Error('Cannot approve metadata without document bytes');
   if((await db.query('SELECT $1::date<=current_date AS invalid',[next]))[0].invalid)throw Error('Next review date must be in the future');
   await db.query('INSERT INTO reviews(revision_id,decision,actor,note,next_review_on) VALUES($1,$2,$3,$4,$5)',[p.revision_id,decision,actor,note,next]);
   await db.query('UPDATE documents SET review_on=$1 WHERE id=$2',[next,d.id]);await event(db,d.id,'reviewed',actor,{version:d.current_version,decision,note,next});return {code:d.code,version:d.current_version,decision};
  });
 }
 if(cmd==='policy'){
  const actor=need(f,'actor'),note=need(f,'note');const cols={'owner':'owner','personal':'personal','purpose':'purpose','record-kind':'record_kind','period-end':'period_end','retain-until':'retain_until','hold-reason':'hold_reason','review-on':'review_on'};const changes={};
  for(const [flag,col] of Object.entries(cols))if(Object.hasOwn(f,flag)){
   let value=f[flag];if(typeof value!=='string')throw Error('--'+flag+' requires a value');
   if(['period-end','retain-until','review-on'].includes(flag))value=value?date(value):null;
   if(flag==='personal'){if(!['true','false'].includes(value))throw Error('Personal must be true or false');value=value==='true';}
   if(flag==='record-kind'&&!['general','nz-tax'].includes(value))throw Error('Invalid record kind');changes[col]=value;
  }
  if(!Object.keys(changes).length)throw Error('Provide at least one policy field');
  return transaction(db,async()=>{const d=await resolveDocument(db,args[0],true);const keys=Object.keys(changes);await db.query('UPDATE documents SET '+keys.map((k,i)=>`${k}=$${i+1}`).join(',')+` WHERE id=$${keys.length+1}`,[...Object.values(changes),d.id]);await event(db,d.id,'policy-reviewed',actor,{before:Object.fromEntries(keys.map(k=>[k,d[k]])),after:changes,note});return {code:d.code,changed:changes};});
 }
 if(cmd==='archive'){
  const actor=need(f,'actor'),note=need(f,'note');return transaction(db,async()=>{const d=await resolveDocument(db,args[0],true);if(d.status==='archived')throw Error('Already archived');await db.query("UPDATE documents SET status='archived' WHERE id=$1",[d.id]);await event(db,d.id,'archived',actor,{note});return {code:d.code,status:'archived',bytes_preserved:true};});
 }
 if(cmd==='import'){
  if(args[0]!=='m-files')throw Error('Supported import: m-files');return importMFiles(db,f);
 }
 if(cmd==='export'){
  const out=need(f,'out');const snapshot=await transaction(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');const data={format:'document-vault/1',exported_at:new Date().toISOString()};for(const name of ['documents','revisions','files','reviews','events','imports'])data[name]=await db.query('SELECT * FROM '+name+' ORDER BY id');return data;});
  privateWrite(out,JSON.stringify(snapshot,null,2)+'\n');return {file:path.resolve(out),documents:snapshot.documents.length,revisions:snapshot.revisions.length,files:snapshot.files.length};
 }
 if(cmd==='extract'){
  const d=await resolveDocument(db,args[0]);const n=f.version?integer(f.version):d.current_version,out=path.resolve(need(f,'out'));
  const files=await db.query('SELECT f.* FROM files f JOIN revisions r ON r.id=f.revision_id WHERE r.document_id=$1 AND r.version=$2 ORDER BY f.name',[d.id,n]);if(!files.length)throw Error('No files on that revision');
  const names=new Set();for(const file of files){safeName(file.name);if(names.has(file.name.toLowerCase()))throw Error('Filenames collide on Windows');names.add(file.name.toLowerCase());const bytes=Buffer.from(file.content_base64,'base64');if(bytes.length!==file.byte_size||hash(bytes)!==file.sha256)throw Error('File integrity mismatch: '+file.name);}
  fs.mkdirSync(out,{mode:0o700});for(const file of files)privateWrite(path.join(out,file.name),Buffer.from(file.content_base64,'base64'));return {directory:out,files:files.length,version:n};
 }
 if(cmd==='weekly-review'||cmd==='draft-request'){
  let body,title;
  if(cmd==='weekly-review'){title='Weekly document review';const reports={};for(const key of ['attention','review-due','compliance'])reports[key]=await run(db,[key]);body=Object.entries(reports).map(([k,v])=>'## '+k+'\n\n'+human(v)).join('\n\n');}
  else {const d=await resolveDocument(db,args[0]);title='Document review request: '+d.code;const p=(await db.query('SELECT * FROM document_position WHERE id=$1',[d.id]))[0];body=`Owner: ${d.owner||'Unassigned'}\nDocument: ${d.title}\nRevision: ${d.current_version}\nFiles held: ${p.file_count}\nReview date: ${d.review_on||'Not set'}\n\nPlease reconcile the original files, review the current revision and record the next review date.\n\n`+human(await db.query('SELECT rule,finding FROM compliance_findings WHERE id=$1 ORDER BY rule',[d.id]));}
  const out=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',cmd+'-'+randomUUID()+'.md');privateWrite(out,'# '+title+'\n\nDraft for internal review. Nothing sent.\n\n'+body+'\n');return {draft:out,sent:false};
 }
}
const defaultMap={id:'ID',title:'Name or title',version:'Version',class:'Class',owner:'Owner'};
async function importMFiles(db,f){
 const actor=need(f,'actor'),vault=need(f,'vault'),objectType=need(f,'object-type'),csvText=fs.readFileSync(need(f,'file'),'utf8');
 const mapping=f.mapping?JSON.parse(fs.readFileSync(need(f,'mapping'),'utf8')):defaultMap;
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object')throw Error('Mapping must be an object');
 for(const [key,value] of Object.entries(mapping))if(!Object.hasOwn(defaultMap,key)||typeof value!=='string'||!value)throw Error('Mapping accepts id,title,version,class,owner column names only');
 for(const key of ['id','title','version'])if(!mapping[key])throw Error('Mapping requires '+key);
 const rows=parseCsv(csvText);if(!rows.length)throw Error('Empty CSV');
 if(Boolean(f.manifest)!==Boolean(f['files-root']))throw Error('Provide both --manifest and --files-root');
 const manifest=f.manifest?JSON.parse(fs.readFileSync(need(f,'manifest'),'utf8')):[];
 if(!Array.isArray(manifest))throw Error('Manifest must be an array of {id, version, files}');
 const seen=new Set(),used=new Set();const root=f['files-root']?fs.realpathSync(need(f,'files-root')):null;
 const prepared=rows.map((row,i)=>{
  for(const col of Object.values(mapping))if(!Object.hasOwn(row,col))throw Error(`Row ${i+2}: mapped column missing: ${col}`);
  const id=row[mapping.id].trim(),title=row[mapping.title].trim(),version=row[mapping.version].trim();if(!id||!title||!/^\d+$/.test(version))throw Error(`Row ${i+2}: id, title and numeric source version required`);
  if(seen.has(id))throw Error('Duplicate source id in batch: '+id);seen.add(id);
  const matches=manifest.filter(m=>String(m.id)===id&&String(m.version)===version);if(matches.length>1)throw Error('Duplicate manifest entry: '+id);
  const files=[];
  if(matches.length){const entry=matches[0];used.add(entry);if(!Array.isArray(entry.files)||!entry.files.length)throw Error('Manifest entry needs files');for(const rel of entry.files){if(typeof rel!=='string'||path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..'))throw Error('Manifest file must be a relative path within files-root');const resolved=fs.realpathSync(path.resolve(root,rel));if(resolved===root||!resolved.startsWith(root+path.sep))throw Error('Manifest file escapes files-root');files.push(loadFile(resolved));}if(new Set(files.map(x=>x.name.toLowerCase())).size!==files.length)throw Error('Duplicate filenames in one object');}
  return {source_key:JSON.stringify([vault,objectType,id]),id,title,version,cls:mapping.class?row[mapping.class]||'Unfiled':'Unfiled',owner:mapping.owner?row[mapping.owner]:'',metadata:row,files};
 });
 if(used.size!==manifest.length)throw Error('Manifest contains unmatched objects or versions');
 const fingerprint=hash(JSON.stringify({vault,objectType,csvText,mapping,files:prepared.map(p=>({id:p.id,files:p.files.map(x=>({name:x.name,sha256:x.sha256}))}))}));
 return transaction(db,async()=>{
  if((await db.query('SELECT id FROM imports WHERE fingerprint=$1',[fingerprint])).length)return {imported:0,duplicate:true,dry_run:!!f['dry-run']};
  for(const p of prepared){
   if((await db.query('SELECT code FROM documents WHERE source_key=$1',[p.source_key])).length)throw Error('Source object already exists. Reconcile changed exports rather than overwriting live work: '+p.id);
   const code='MF-'+hash(p.source_key).slice(0,16);
   const d=(await db.query('INSERT INTO documents(code,title,class,owner,source_key,source_metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[code,p.title,p.cls,p.owner,p.source_key,p.metadata]))[0];
   const r=await revision(db,d,1,actor,'M-Files CSV import',{sourceVersion:p.version});for(const file of p.files)await insertFile(db,r,file);await event(db,d.id,'imported',actor,{source_key:p.source_key,source_version:p.version,files:p.files.length});
  }
  await db.query('INSERT INTO imports(fingerprint,vault,csv_text,mapping,row_count,actor) VALUES($1,$2,$3,$4,$5,$6)',[fingerprint,vault,csvText,JSON.stringify({objectType,columns:mapping}),rows.length,actor]);
  return {imported:prepared.length,files:prepared.reduce((n,p)=>n+p.files.length,0),metadata_only:prepared.filter(p=>!p.files.length).length,dry_run:!!f['dry-run'],reconcile_export_count:true};
 },!!f['dry-run']);
}
export function human(result){
 if(Array.isArray(result)){if(!result.length)return '(none)';const keys=Object.keys(result[0]);const rows=result.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?v.toISOString():v&&typeof v==='object'?JSON.stringify(v):v])));return table(rows,keys.map(key=>({key,label:key,width:90})));}
 if(result&&typeof result==='object')return Object.entries(result).map(([k,v])=>Array.isArray(v)?`${k}\n${human(v)}`:`${k}: ${v&&typeof v==='object'?JSON.stringify(v,null,2):v}`).join('\n');return String(result);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):human(result));}catch(e){const info={error:e.message,...(e.candidates?{candidates:e.candidates}:{})};console.error(process.argv.includes('--json')?JSON.stringify(info):human(info));process.exitCode=1;}finally{await db?.close();}}
