const fs=require('node:fs'),vm=require('node:vm'),X=require('../public/lib/xlsx.full.min.js'),P=require('../public/js/company-workbook.js'),C=require('../public/js/operation-core.js');
(async()=>{
 const wb=X.read(fs.readFileSync(process.argv[2]),{type:'buffer'});
 const sheets=wb.SheetNames.map(name=>({name,type:'skip',aoa:X.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:''}).map((row,i)=>{const r=row.slice();if(/수리.*내역/.test(name)){r[10]='';r[13]='';r[14]='';}else if(i===1)r[1]='';return r;})}));
 const data=P.parse(sheets);if(!data)throw Error('Unsupported workbook');const errors=C.validate(data);console.log('Equipment '+data.equipment.length+', daily '+data.daily.length+', history '+data.history.length);console.log('Validation: '+JSON.stringify(errors));
 if(errors.length)throw Error('Validation failed');
 console.log(JSON.stringify(C.aggregate(data,'2026-11-01','2026-11-30')));
 fs.writeFileSync('public/data/operation-reference.json',JSON.stringify(data,null,2)+'\n');
 const context={window:{}};vm.runInNewContext(fs.readFileSync('public/js/sync-config.js','utf8'),context);const config=context.window.DowntimeSyncConfig,headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 const r=await fetch(config.url+'/rest/v1/downtime_shared_workspace?id=eq.public&select=revision',{headers});if(!r.ok)throw Error('Cloud read '+r.status);const rows=await r.json();
 const response=await fetch(config.url+'/rest/v1/rpc/save_shared_downtime_workspace',{method:'POST',headers,body:JSON.stringify({expected_revision:rows[0]?.revision||0,workspace:{version:1,settings:{},files:[{id:'company-november-2026',name:'11월 설비 비가동 이력 (수정본).xlsx',sheets}]}})});if(!response.ok)throw Error('Cloud write '+response.status);const result=await response.json();if(!result.ok)throw Error('Concurrent update, cancelled');console.log('Cloud imported, revision '+result.revision);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
