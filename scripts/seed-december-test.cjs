const fs=require('fs'),vm=require('vm'),X=require('../public/lib/xlsx.full.min.js'),P=require('../public/js/company-workbook.js'),C=require('../public/js/operation-core.js'),D=require('../public/js/downtime.js');
(async()=>{
const wb=X.read(fs.readFileSync('public/templates/december-test-operation.xlsx'),{type:'buffer'}),incoming=P.parse(wb.SheetNames.map(name=>({name,aoa:X.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''})})));
if(incoming.equipment.length!==30||incoming.daily.length!==930||C.validate(incoming).length)throw Error('Test workbook validation failed');
incoming.source='가상 테스트 자료 · 2026년 12월 · 설비당 매일 8시간';incoming.daily.forEach(r=>r.testData=true);
const window={OperationCore:C,Downtime:D,CompanyWorkbook:P};vm.runInNewContext(fs.readFileSync('public/js/sync-config.js','utf8'),{window});vm.runInNewContext(fs.readFileSync('public/js/operation-sync.js','utf8'),{window});const cfg=window.DowntimeSyncConfig,headers={apikey:cfg.publishableKey,'Content-Type':'application/json'};
const read=await fetch(cfg.url+'/rest/v1/downtime_shared_workspace?id=eq.public&select=revision,payload',{headers});if(!read.ok)throw Error('Read failed '+read.status);const cloud=(await read.json())[0];
const before=cloud?.payload?window.OperationSync.decode(cloud.payload):{equipment:[],daily:[],history:[]},merged=C.mergeData(before,incoming);
const workspace={version:1,settings:cloud?.payload?.settings||{},files:[{id:'operation-analysis',name:'가상 12월 테스트 포함',sheets:[{name:'분석자료',type:'operation-v1',aoa:[[JSON.stringify(merged)]]}]}]};
const response=await fetch(cfg.url+'/rest/v1/rpc/save_shared_downtime_workspace',{method:'POST',headers,body:JSON.stringify({expected_revision:cloud?.revision||0,workspace})});if(!response.ok)throw Error('Save failed '+response.status);const result=await response.json();if(!result.ok)throw Error('Concurrent change; nothing replaced');
console.log('Added 930 December test rows, 30 equipment, 31 days, 7440 operating hours, zero downtime; other dates preserved. Revision '+result.revision);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
