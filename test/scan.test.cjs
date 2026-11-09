'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {buildRequest,convert,schema,upstreamError,apiKey}=require('../server/extraction.cjs');
const {createServer}=require('../server/server.cjs');
const S=require('../public/js/scanread.js');
function fixture(s) {
 if(Array.isArray(s.type)) return null;
 if(s.enum) return s.enum[0];
 if(s.type==='object') return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,fixture(v)]));
 if(s.type==='array') return [];
 if(s.type==='integer') return 1;
 return '';
}
function response(data) {return {status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]};}
const file={mime:'application/pdf',name:'synthetic.pdf',base64:Buffer.from('%PDF-synthetic offline fixture').toString('base64')};
async function verify() {
 let count=0;
 const check=(name,fn)=>{fn();count++;};
 check('PDF Responses input actually contains file and strict schema',()=>{
  const r=buildRequest(file,'mach'); assert.equal(r.model,'gpt-6.1-sol');assert.equal(r.store,false);assert.equal(r.input[0].content[1].type,'input_file');assert.equal(r.input[0].content[1].detail,'high');assert.ok(r.input[0].content[1].file_data.endsWith(file.base64));assert.equal(r.text.format.strict,true);assert.ok(!r.messages);
 });
 check('image input',()=>{const r=buildRequest({mime:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')},'');assert.equal(r.input[0].content[1].type,'input_image');assert.equal(r.input[0].content[1].detail,'high');});
 check('size and MIME signature rejection',()=>{assert.throws(()=>buildRequest({...file,mime:'image/jpeg'}));assert.throws(()=>buildRequest({...file,base64:Buffer.alloc(10*1024*1024+1).toString('base64')}));});
 let data=fixture(schema),p=fixture(schema.properties.pages.items);data.pages=[p];p.equipment='synthetic';p.work=[{no:1,start:null,end:null,model:null,part:null,job:null,qty:null,code:null,note:null}];p.reviews=[{field:'work[1].start',reason:'판독 불가'}];
 check('nullable row and provenance preserved',()=>{const o=convert(response(data)).pages[0];assert.equal(o.work.length,1);assert.equal(o.work[0].qty,'');assert.equal(o.raw.work.length,0);assert.equal(o.sourcePage,1);assert.equal(o.reviews[0].field,'work[1].start');assert.ok(S.validate(o).length);});
 check('incomplete/refusal/schema/missing pages rejected',()=>{assert.throws(()=>convert({status:'incomplete'}));assert.throws(()=>convert({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}));assert.throws(()=>convert(response({pages:[]})));assert.throws(()=>convert(response({...data,pageCount:2})));assert.throws(()=>convert(response({...data,extra:0})));});
 check('business validation and legacy sample conversion',()=>{assert.equal(S.time('24:20'),null);assert.equal(S.minutes('99:99'),null);assert.equal(S.date('2026-02-30'),null);const sample=S.parseReply(S.sampleReply());assert.equal(sample.pages.length,2);assert.equal(sample.pages[1].downtime.length,2);assert.ok(S.toFormRows(sample.pages).length>2);assert.equal(S.toFormRows([S.blankPage('mach')])[1][9],'');});
 check('safe authentication diagnostics',()=>{assert.throws(()=>apiKey('jhgc016'));assert.throws(()=>apiKey('sk-***'));assert.throws(()=>apiKey('sk-abc def'));const fake='sk-offline-test-placeholder-not-a-real-key';assert.equal(apiKey(' '+fake+' '),fake);const err=upstreamError(401,{error:{code:'invalid_api_key',message:'Incorrect key '+fake}});assert.ok(err.message.includes('invalid_api_key'));assert.ok(!err.message.includes(fake));assert.ok(!upstreamError(401,{error:{code:fake,message:fake}}).message.includes(fake));});
 check('upstream error categories',()=>{[400,401,403,404,413,429,500].forEach(s=>assert.ok(upstreamError(s).message.length>10));});
 const env={OPENAI_API_KEY:'offline-test-only',SCAN_ACCESS_TOKEN:'a'.repeat(32),ALLOWED_ORIGINS:'https://allowed.example'};
 let calls=0; const server=createServer(env,async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(init.body).model,'gpt-6.1-sol');return {ok:true,json:async()=>response(data)};});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(token=env.SCAN_ACCESS_TOKEN,origin='https://allowed.example')=>fetch(base+'/api/scan',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({file})});
 try {
  assert.equal((await post('bad')).status,401);assert.equal((await post(env.SCAN_ACCESS_TOKEN,'https://evil.example')).status,403);assert.equal(calls,0);count++;
  for(let i=0;i<5;i++){const r=await post();assert.equal(r.status,200);assert.equal((await r.json()).pages[0].sourcePage,1);}
  assert.equal((await post()).status,429);assert.equal(calls,5);count++;
  assert.equal((await fetch(base+'/.env')).status,404);count++;
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 return count;
}
if(require.main===module) test('offline extraction and authenticated relay',verify);
module.exports={verify};
