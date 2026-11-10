'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../public/js/operation-core.js');
const D=require('../public/js/downtime.js');
const data=require('../public/data/operation-reference.json');
test('reference records preserve 17 originals, 33 allocations and 45.5 hours',()=>{
  const h=C.history(data,'2026-11-01','2026-11-30');assert.equal(data.equipment.length,31);assert.equal(h.count,17);assert.equal(h.rows.length,33);assert.equal(h.total,45.5);
  const shared=data.history.find(r=>r.down===4&&r.equipment.length===4);
  assert.ok(shared);assert.equal(h.rows.filter(r=>r.id===shared.id).reduce((s,r)=>s+r.allocated,0),4);
  const mct=C.history(data,'2026-11-01','2026-11-30',{process:'mach',equipment:'MCT 호리젠탈'});assert.equal(mct.count,2);assert.equal(mct.total,3);
  assert.equal(C.history(data,'2026-11-01','2026-11-30',{process:'mach',code:'B'}).total,3);
  assert.equal(C.history(data,'2026-11-01','2026-11-30',{process:'weld',code:'B'}).count,0);
});
test('weighted calculations distinguish zero, missing data and original history from operation totals',()=>{
  const input={imported:true,equipment:[{name:'NC',process:'mach'},{name:'ROBOT',process:'weld'},{name:'empty',process:'mach'}],daily:[{date:'2026-11-02',equipment:'NC',process:'mach',plan:100,down:10,run:90},{date:'2026-11-02',equipment:'ROBOT',process:'weld',plan:200,down:40,run:160}],history:[{id:'r',start:'2026-11-01',end:'2026-11-04',process:'mach',equipment:['NC','empty'],codes:['B','C'],down:4,repair:2}]};
  const t=C.aggregate(input,'2026-11-02','2026-11-02');assert.equal(t.plan,300);assert.equal(t.down,50);assert.equal(t.run,250);assert.equal(t.rate,250/300*100);
  assert.equal(C.history(input,'2026-11-02','2026-11-02').total,4);assert.equal(C.equipment(input,'2026-11-02','2026-11-02').find(e=>e.name==='empty').plan,null);
  const categories=C.categories(input,'2026-11-02','2026-11-02','mach');assert.deepEqual(categories.map(c=>c.hours),[5,5]);
  assert.equal(C.aggregate(input,'2026-12-01','2026-12-31').hasData,false);assert.equal(C.sum([{plan:10,run:10,down:0}]).down,0);
  assert.equal(C.validate(input).length,0);const bad=structuredClone(input);bad.daily.push({...bad.daily[0],down:200,date:'2026-02-30'});assert.ok(C.validate(bad).length>=3);
  bad.daily[2]={...bad.daily[0]};assert.ok(C.validate(bad).some(e=>e.includes('중복')));
});
test('range transitions use six weeks, twelve months, Monday boundaries and absent days',()=>{
  assert.deepEqual(C.range('2026-11','week'),{start:'2026-09-28',end:'2026-11-08'});
  assert.deepEqual(C.range('2026-11','month'),{start:'2025-12-01',end:'2026-11-30'});
  assert.equal(C.monday('2026-11-08'),'2026-11-02');
  const buckets=C.buckets(data,'2026-11-02','2026-11-08','day');assert.equal(buckets.length,7);assert.equal(buckets[0].down,18);assert.equal(buckets[4].hasData,false);
  assert.ok(C.equipment(data,'2026-11-02','2026-11-08').every(e=>!e.hasData));
  assert.equal(C.equipment(data,'2026-11-01','2026-11-30').filter(e=>e.hasData).length,30);
});
test('existing Excel parser adapter keeps full-precision minutes and does not invent day/night split',()=>{
  const S=D.normSettings({}),sample=D.sample();const result=D.analyze(D.merge(sample.sheets.map(s=>D.parseSheet(s.aoa,D.detectSheet(s.aoa,s.name).type,{sheet:s.name},S))),S);
  const next=C.fromLegacy(result,D);assert.ok(next.daily.length>0);assert.ok(C.validate(next).some(e=>e.includes('가동 + 비가동')));assert.equal(next.daily[0].day,null);assert.equal(next.daily[0].plan,result.kinds.equip.days[0].plan/60);
});
test('analysis UI renders all tabs, drills into equipment, categories and weekly history, and prints report',async()=>{
  const elements={},listeners={},storage=new Map();
  function el(id){return elements[id]||=( {id,innerHTML:'',textContent:'',dataset:{},value:'',setAttribute(){},classList:{toggle(){return true;}},showModal(){this.open=true;},close(){this.open=false;},focus(){}});}
  const tabs=['trend','equipment','history','report'].map(tab=>{const t=el('tab-'+tab);t.dataset.tab=tab;return t;});let printed=0;
  const document={getElementById:el,querySelectorAll:q=>q==='[data-tab]'?tabs:[],querySelector:()=>null,addEventListener:(event,fn)=>listeners[event]=fn};
  const context={document,window:{OperationCore:C,Downtime:D,addEventListener(){},print(){printed++;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async()=>({ok:true,json:async()=>structuredClone(data)}),MouseEvent:class{},console};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/operation.js'),'utf8'),context);await new Promise(setImmediate);
  const click=(dataset,id='')=>listeners.click({target:{closest:()=>({dataset,id,hasAttribute:k=>Object.hasOwn(dataset,k.replace(/^data-/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()))})}});
  assert.ok(el('tab-content').innerHTML.includes('전체 종합'));
  click({start:'2026-11-02',end:'2026-11-08'});assert.ok(el('tab-content').innerHTML.includes('33행 · 원본 17건'));
  click({category:'mach:B'});assert.ok(el('tab-content').innerHTML.includes('2행 · 원본 2건'));assert.ok(el('tab-content').innerHTML.includes('3.0h'));
  click({tab:'equipment'});click({monthView:''});assert.ok(el('tab-content').innerHTML.includes('MCT 호리젠탈'));
  click({equipment:'MCT 호리젠탈',process:'mach'});assert.ok(el('tab-content').innerHTML.includes('2행 · 원본 2건'));
  click({tab:'report'});assert.ok(el('tab-content').innerHTML.includes('규칙 기반 자동 분석'));click({},'print-report');assert.equal(printed,1);
  click({tab:'trend'});click({unit:'month'});assert.ok(el('kpis').innerHTML.includes('2025-12-01 ~ 2026-11-30'));
});
