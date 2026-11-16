const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('public/js/sync-config.js','utf8'),context);
const config=context.window.DowntimeSyncConfig;
(async()=>{const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
const read=await fetch(config.url+'/rest/v1/downtime_shared_workspace?id=eq.public&select=revision',{headers});if(!read.ok)throw Error('Read failed '+read.status);const rows=await read.json();
const response=await fetch(config.url+'/rest/v1/rpc/save_shared_downtime_workspace',{method:'POST',headers,body:JSON.stringify({expected_revision:rows[0]?.revision||0,workspace:{version:1,files:[],settings:{}}})});if(!response.ok)throw Error('Reset failed '+response.status);const result=await response.json();if(!result.ok)throw Error('Concurrent change; reset cancelled');console.log('Public workspace reset, revision '+result.revision);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
