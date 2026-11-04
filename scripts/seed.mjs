import {readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {getDb,REPO_ROOT} from './lib/db.mjs';
export async function seed(db){
 await db.exec('BEGIN');
 try {
 await db.exec(readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));
 for(const [suffix,text] of [['1','Synthetic supplier agreement. Payment terms: thirty days. Review insurance before renewal.'],['2','Synthetic quarterly account pack. Income and expense supporting record.'],['4','Synthetic delivery dispute. Preserve correspondence until the dispute is resolved.'],['5','Synthetic supplier agreement. Payment terms: thirty days. Review insurance before renewal.']]){
 const data=Buffer.from(text);const revision=`20000000-0000-4000-8000-${suffix.padStart(12,'0')}`;
 await db.query('INSERT INTO files(revision_id,name,sha256,byte_size,content_base64,search_text) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[revision,`document-${suffix}.txt`,createHash('sha256').update(data).digest('hex'),data.length,data.toString('base64'),text]);
 }
 await db.exec('COMMIT');return {seeded:true,synthetic:true};
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const db=await getDb();try{console.log(JSON.stringify(await seed(db)));}finally{await db.close();}}
