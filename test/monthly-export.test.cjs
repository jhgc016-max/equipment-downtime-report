const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const X=require('../public/lib/xlsx.full.min.js'),Zip=require('../public/lib/jszip.min.js'),Export=require('../public/js/monthly-export.js'),P=require('../public/js/company-workbook.js');
test('December export preserves original workbook layout and roundtrips all 31 days of actual data',async()=>{
 const template=fs.readFileSync('public/templates/equipment-operation-template.xlsx'),source=X.read(fs.readFileSync('public/templates/december-test-operation.xlsx'),{type:'buffer'});
 const data=P.parse(source.SheetNames.map(name=>({name,aoa:X.utils.sheet_to_json(source.Sheets[name],{header:1,raw:true,defval:''})})));
 data.history=[{id:'test',process:'mach',start:'2026-12-31',end:'2026-12-31',equipment:['135NC'],codes:['B'],part:'pump',cause:'leak',action:'replace seal',down:.5,repair:1}];
 const out=await Export.build(template,data,'2026-12',Zip),wb=X.read(out,{type:'array'}),parsed=P.parse(wb.SheetNames.map(name=>({name,aoa:X.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''})})));
 assert.equal(parsed.daily.length,930);assert.equal(parsed.daily.reduce((s,r)=>s+r.run,0),7440);assert.equal(parsed.daily.filter(r=>r.date==='2026-12-31').length,30);
 assert.equal(parsed.history.length,1);assert.equal(parsed.history[0].down,.5);assert.equal(parsed.history[0].repair,1);assert.equal(parsed.history[0].action,'replace seal');
 const original=await Zip.loadAsync(template),exported=await Zip.loadAsync(out);assert.equal(await exported.file('xl/styles.xml').async('string'),await original.file('xl/styles.xml').async('string'));
 const originalWb=X.read(template,{type:'buffer'});for(const name of wb.SheetNames)assert.deepEqual(wb.Sheets[name]['!merges'],originalWb.Sheets[name]['!merges']);
 assert.equal(wb.Sheets[wb.SheetNames[0]].B1.v,'2026년 12월 NC 설비 가동률');
 assert.equal(wb.Sheets[wb.SheetNames[1]].B1.v,'2026년 12월 용접 ROBOT 가동률');
 assert.ok(wb.Sheets[wb.SheetNames[2]].B2.v.includes('12월'));
 assert.ok(wb.Sheets[wb.SheetNames[3]].B2.v.includes('12월'));
 for(let sn=1;sn<=4;sn++){
  const xml=await exported.file('xl/worksheets/sheet'+sn+'.xml').async('string');
  const refs=[...xml.matchAll(/<c\b[^>]*?\br="([A-Z]+\d+)"/g)].map(m=>m[1]);assert.equal(new Set(refs).size,refs.length,'no duplicate cell references');
  for(const match of xml.matchAll(/<c\b[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g))assert.ok(!/<c\b/.test(match[1]||''),'cells cannot be nested');
 }
});
test('February export uses the correct month boundary and leaves other month records out',async()=>{
 const data={equipment:[{name:'135NC',process:'mach'}],daily:[{date:'2026-02-28',equipment:'135NC',process:'mach',plan:8,run:7.5,down:.5,day:8,night:0},{date:'2026-03-01',equipment:'135NC',process:'mach',plan:8,run:8,down:0,day:8,night:0}],history:[]};
 const out=await Export.build(fs.readFileSync('public/templates/equipment-operation-template.xlsx'),data,'2026-02',Zip),wb=X.read(out,{type:'array'}),parsed=P.parse(wb.SheetNames.map(name=>({name,aoa:X.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''})})));
 assert.equal(parsed.daily.length,1);assert.equal(parsed.daily[0].date,'2026-02-28');assert.equal(parsed.daily[0].run,7.5);assert.equal(parsed.daily[0].down,.5);
});
