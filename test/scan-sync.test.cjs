'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');
const {prepareScan,scanDate}=require('../public/js/sync-core.js');
const header=['설비','날짜','코드'];
const workspace=()=>({version:1,settings:{target:85},files:[
 {id:'old',name:'이전 스캔',sheets:[{name:'일보',type:'form',aoa:[header,['A','2026-11-03','A'],['B','2026.11.04','B']]}]},
 {id:'old2',name:'중복 스캔',sheets:[{name:'일보',type:'form',aoa:[header,['C','20261103','C']]}]},
 {id:'other',name:'다른 자료',sheets:[{name:'수리',type:'repair',aoa:[header,['X','2026-11-03','X']]}]}
]});
test('same-date scan replacement removes matching rows across files and keeps other dates and sheet types',()=>{
 const original=workspace(),before=structuredClone(original);
 const plan=prepareScan(original,{id:'new',name:'새 스캔',aoa:[header,['D','2026-11-03','D']]});
 assert.deepEqual(original,before);assert.equal(plan.duplicates[0].date,'2026-11-03');assert.equal(plan.duplicates[0].rows,2);
 assert.deepEqual(plan.duplicates[0].files,['이전 스캔','중복 스캔']);
 assert.equal(plan.payload.files.length,3);assert.equal(plan.payload.files[0].sheets[0].aoa[1][1],'2026.11.04');
 assert.equal(plan.payload.files[1].id,'other');assert.equal(plan.payload.files[2].id,'new');assert.equal(plan.payload.settings.target,85);
});
test('new dates append and repeated successful send does not duplicate a scan',()=>{
 const scan={id:'new',name:'새 스캔',aoa:[header,['D','2026-11-05','D']]};const plan=prepareScan(workspace(),scan);
 assert.equal(plan.duplicates.length,0);assert.equal(plan.payload.files.length,4);
 const again=prepareScan(plan.payload,scan);assert.equal(again.alreadySaved,true);assert.deepEqual(again.payload,plan.payload);
});
test('invalid or missing incoming dates block replacement and Excel dates normalize',()=>{
 assert.throws(()=>prepareScan(workspace(),{id:'new',name:'bad',aoa:[header,['D','2026-02-30','D']]}));
 assert.throws(()=>prepareScan(workspace(),{id:'new',name:'bad',aoa:[['설비'],['D']]}));
 assert.equal(scanDate(46329),'2026-11-03');assert.equal(scanDate('2026년 11월 3일'),'2026-11-03');
});
test('blank date cells inherit their preceding date when replacing existing input-form rows',()=>{
 const value={version:1,settings:{},files:[{id:'old',name:'mixed',sheets:[{name:'일보',type:'form',aoa:[header,['A','2026-11-03','A'],['A','','B'],['A','2026-11-04','C'],['A','','D']]}]}]};
 const plan=prepareScan(value,{id:'new',name:'scan',aoa:[header,['B','2026-11-03','B']]});
 assert.equal(plan.duplicates[0].rows,2);assert.deepEqual(plan.payload.files[0].sheets[0].aoa,[header,['A','2026-11-04','C'],['A','','D']]);
});
