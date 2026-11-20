const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../public/js/operation-core.js');
function setup(conflict=false,changed=false){
 const original={id:'one',process:'mach',start:'2026-11-16',end:'2026-11-16',equipment:['NC'],codes:['B'],down:2,repair:0,cause:'old',action:''};
 const current={imported:true,equipment:[{name:'NC',process:'mach'}],daily:[{date:'2026-11-16',equipment:'NC',process:'mach',plan:10,run:8,down:2}],history:[{...original,cause:changed?'other':original.cause},{...original,id:'two'}]};let written,applied;
 const client={from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:{revision:9,payload:{settings:{keep:true}}}}}}},async rpc(name,args){written=args;return {data:{ok:!conflict}}}};
 const window={OperationCore:Core,OperationSync:{decode:()=>structuredClone(current),apply:v=>applied=v},DowntimeSync:{snapshot:v=>v}};
 const source=fs.readFileSync('public/js/cloud-sync.js','utf8').replace('  init();','  client=window.testClient;');window.testClient=client;
 vm.runInNewContext(source,{window,document:{body:{dataset:{}}}});
 return {window,original,current,get written(){return written},get applied(){return applied}};
}
test('editing history replaces original even after its date changes and preserves daily data',async()=>{
 const ctx=setup();await ctx.window.CloudSync.updateHistory(ctx.original,{...ctx.original,start:'2026-11-17',end:'2026-11-17',cause:'new'});
 const saved=JSON.parse(ctx.written.workspace.files[0].sheets[0].aoa[0][0]);assert.equal(saved.history.length,2);assert.equal(saved.history[0].start,'2026-11-17');assert.equal(saved.history[0].cause,'new');assert.deepEqual(saved.daily,ctx.current.daily);assert.equal(ctx.written.expected_revision,9);assert.ok(ctx.applied);
});
test('editing rejects a concurrently changed original or workspace revision',async()=>{
 const changed=setup(false,true);await assert.rejects(changed.window.CloudSync.updateHistory(changed.original,changed.original));assert.equal(changed.written,undefined);
 const conflict=setup(true);await assert.rejects(conflict.window.CloudSync.updateHistory(conflict.original,conflict.original));assert.equal(conflict.applied,undefined);
});
