'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const {test}=require('node:test');
test('PostgreSQL RLS isolates accounts and the RPC enforces atomic revisions',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;insert into auth.users values ('${a}'),('${b}');`);
 await db.exec(fs.readFileSync(require.resolve('../supabase/setup.sql'),'utf8'));
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const save=async(revision,name)=>{const r=await db.query('select public.save_downtime_workspace($1,$2::jsonb) as result',[revision,JSON.stringify({version:1,files:[],settings:{target:name}})]);return r.rows[0].result;};
 await login(a);assert.equal((await save(0,80)).revision,1);assert.equal((await save(0,90)).ok,false);assert.equal((await save(1,90)).revision,2);
 await assert.rejects(()=>db.exec(`update public.downtime_workspaces set revision=99`));
 await login(b);assert.equal((await db.query('select * from public.downtime_workspaces')).rows.length,0);assert.equal((await save(0,75)).ok,true);const rows=await db.query('select user_id,revision from public.downtime_workspaces');assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].user_id,b);
 await login(a);assert.equal((await db.query('select revision from public.downtime_workspaces')).rows[0].revision,2);
 await assert.rejects(()=>db.query('select public.save_downtime_workspace(2,$1::jsonb)',[JSON.stringify({version:1,files:[],settings:{},token:'not-allowed'})]));
 await db.exec('reset role');await db.exec('set role anon');await assert.rejects(()=>db.query('select public.save_downtime_workspace(0,$1::jsonb)',[JSON.stringify({version:1,files:[],settings:{}})]));
 }finally{await db.close();}
});

test('public workspace supports unauthenticated cross-PC sync while private workspaces remain isolated',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;`);
 await db.exec(fs.readFileSync(require.resolve('../supabase/setup.sql'),'utf8'));
 const migration=fs.readFileSync(require.resolve('../supabase/public-sync.sql'),'utf8');
 await db.exec(migration);await db.exec(migration);
 const payload={version:1,files:[],settings:{target:85}};
 const save=async(rev,value=payload)=>(await db.query('select public.save_shared_downtime_workspace($1,$2::jsonb) as result',[rev,JSON.stringify(value)])).rows[0].result;
 await db.exec('set role anon');
 assert.equal((await save(0)).revision,1);
 assert.equal((await save(0)).ok,false);
 assert.equal((await db.query('select * from public.downtime_shared_workspace')).rows.length,1);
 for(const sql of ["update public.downtime_shared_workspace set revision=99","delete from public.downtime_shared_workspace","select * from public.downtime_workspaces"]){await assert.rejects(()=>db.exec(sql));}
 await assert.rejects(()=>save(1,{...payload,token:'forbidden'}));
 await assert.rejects(()=>save(1,{...payload,files:{}}));
 await assert.rejects(()=>save(1,{...payload,settings:{data:'x'.repeat(4194304)}}));
 await db.exec('reset role;set role authenticated');
 assert.equal((await save(1,{...payload,settings:{target:90}})).revision,2);
 await db.exec('reset role;set role anon');
 assert.equal((await db.query('select payload from public.downtime_shared_workspace')).rows[0].payload.settings.target,90);
 assert.equal((await save(1)).ok,false);
 }finally{await db.close();}
});
