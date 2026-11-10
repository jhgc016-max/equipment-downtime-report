'use strict';const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {test}=require('node:test');const Core=require('../public/js/sync-core.js');
function environment(config,{localReader=false,confirm=()=>true}={}){const elements={};const el=id=>elements[id]||={value:'',hidden:false,disabled:false,textContent:'',innerHTML:'',checkValidity:()=>true};const map=new Map();const intervals=[];let db=null,writes=0;let working={version:1,files:[{id:'file1',name:'confirmed scan',sheets:[{name:'일보',type:'form',aoa:[['설비','코드'],['150NC','C']]}]}],settings:{target:85}};
 const client={from(table){assert.equal(table,'downtime_shared_workspace');return {select(){return {eq(key,value){assert.equal(key,'id');assert.equal(value,'public');return {async maybeSingle(){return {data:db,error:null};}};}};}};},async rpc(name,args){assert.equal(name,'save_shared_downtime_workspace');if(args.expected_revision!==(db?.revision||0))return {data:{ok:false,...db}};db={revision:(db?.revision||0)+1,payload:structuredClone(args.workspace)};writes++;return {data:{ok:true,...db}};}};
 const context={window:{DowntimeSyncConfig:config,DowntimeSync:Core,supabase:{createClient(){return client;}},confirm,addEventListener(){}},document:{body:{dataset:{localReader:String(localReader)}},getElementById:el,createElement:()=>({}),querySelector:()=>({prepend(){}}),head:{appendChild(){throw new Error('Unexpected SDK download');}},addEventListener(){}},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},URL,setTimeout:fn=>{Promise.resolve().then(fn);return 1;},clearTimeout(){},setInterval:fn=>{intervals.push(fn);return 1;},clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/cloud-sync.js'),'utf8'),context);context.window.CloudSync.register({get:()=>structuredClone(working),apply:v=>{working=v;}});
 return {el,context,intervals,client,seed(value){db={revision:1,payload:structuredClone(value)};},get db(){return db;},get writes(){return writes;},get working(){return working;},remoteChange(value){db={revision:db.revision+1,payload:value};},tick:async()=>{for(let i=0;i<10;i++)await new Promise(setImmediate);}};
}
test('no Supabase project means no attempted login or false online status',async()=>{const e=environment({url:'',publishableKey:''});await e.tick();assert.equal(e.el('sync-now').disabled,true);assert.ok(e.el('sync-status').textContent.includes('프로젝트를 연결'));assert.equal(e.writes,0);});
test('no auth API: automatic public connection, first upload, autosave, remote pull and reviewed scan append',async()=>{const e=environment({url:'https://offline.supabase.co',publishableKey:'sb_publishable_offline_test'});await e.tick();assert.equal(e.writes,0);assert.equal(e.el('sync-conflict').hidden,false);await e.el('sync-use-local').onclick();assert.equal(e.writes,1);e.working.settings.target=90;e.context.window.CloudSync.changed();await e.tick();assert.equal(e.db.payload.settings.target,90);const remote=structuredClone(e.db.payload);remote.files[0].name='other PC';e.remoteChange(remote);await e.intervals.at(-1)();await e.tick();assert.equal(e.working.files[0].name,'other PC');await e.context.window.CloudSync.addScan({id:'scan2',name:'reviewed',aoa:[['설비','코드'],['150NC','C']]});assert.equal(e.db.payload.files.length,2);assert.equal(e.db.payload.files[1].sheets[0].aoa[1][1],'C');});

test('local reader cancels duplicate-date replacement without writes, then replaces after confirmation',async()=>{
 let approved=false;const prompts=[];
 const e=environment({url:'https://offline.supabase.co',publishableKey:'sb_publishable_offline_test'},{localReader:true,confirm:message=>{prompts.push(message);return approved;}});
 const head=['설비','날짜'];e.seed({version:1,files:[{id:'old',name:'old scan',sheets:[{name:'일보',type:'form',aoa:[head,['A','2026-11-03'],['B','2026-11-04']]}]}],settings:{target:85}});await e.tick();
 assert.equal(e.writes,0);assert.equal(e.intervals.length,0);
 const scan={id:'new',name:'new scan',aoa:[head,['A','2026-11-03']]};
 assert.equal(await e.context.window.CloudSync.addScan(scan),false);assert.equal(e.writes,0);assert.ok(prompts[0].includes('2026-11-03'));assert.ok(prompts[0].includes('old scan'));
 approved=true;assert.equal(await e.context.window.CloudSync.addScan(scan),true);assert.equal(e.writes,1);assert.equal(e.db.payload.files[0].sheets[0].aoa[1][1],'2026-11-04');
 assert.equal(await e.context.window.CloudSync.addScan(scan),true);assert.equal(e.writes,1);
});
test('local reader does not silently replace after concurrent change or report network failure as success',async()=>{
 const e=environment({url:'https://offline.supabase.co',publishableKey:'sb_publishable_offline_test'},{localReader:true});await e.tick();
 const scan={id:'new',name:'new scan',aoa:[['날짜'],['2026-11-03']]};
 e.client.rpc=async()=>({data:{ok:false,revision:2}});await assert.rejects(()=>e.context.window.CloudSync.addScan(scan),/다른 PC/);
 e.client.rpc=async()=>({error:new Error('offline')});await assert.rejects(()=>e.context.window.CloudSync.addScan(scan),/동기화에 실패/);
 assert.equal(e.writes,0);
});
