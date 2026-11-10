'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');const {pathToFileURL}=require('node:url');const path=require('node:path');
const {createLocalServer,errorMessage}=require('../desktop/server.cjs');const API=require('../desktop/extraction.cjs');
const file={mime:'application/pdf',base64:Buffer.from('%PDF-synthetic').toString('base64')};
function fixture(s){if(Array.isArray(s.type))return null;if(s.enum)return s.enum[0];if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,fixture(v)]));if(s.type==='array')return [];if(s.type==='integer')return 1;return '';}
function payload(){const p=fixture(API.schema.properties.pages.items);return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({pageCount:1,pages:[p]})}]}]};}
test('local login is authenticated, consented, scoped and preserves completed pages',async()=>{
 let shared=false,calls=0;
 const client={getSession:async()=>({status:shared?'connected':'disconnected',sharing:shared,identity:{email:'synthetic@example.invalid'},credentials:{accessToken:'must-never-reach-browser'}}),signIn:async()=>{shared=true;},cancelSignIn(){},disconnect:async()=>{shared=false;},listModels:async()=>[{slug:'gpt-6.1-sol',displayName:'Test Sol'}],streamResponse:async options=>{calls++;assert.equal(options.model,'gpt-6.1-sol');assert.equal(options.request.input[0].content[1].type,'input_file');assert.equal(options.request.input[0].content[1].detail,'high');assert.equal(options.request.text.format.strict,true);return {response:payload(),text:'unused'};}};
 const local=createLocalServer(client);const launch=await local.start();const origin=new URL(launch).origin;
 const unlocked=await fetch(launch,{redirect:'manual'});assert.equal(unlocked.status,302);const cookie=unlocked.headers.get('set-cookie').split(';')[0];assert.ok(unlocked.headers.get('set-cookie').includes('HttpOnly'));
 const call=(route,body,extra={})=>fetch(origin+'/api/chatgpt/'+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  assert.equal((await fetch(origin+'/scan.html')).status,401);assert.equal((await fetch(launch,{redirect:'manual'})).status,401);
  assert.equal((await call('sign-in',{}, {Origin:'https://evil.invalid'})).status,403);const badHost=await new Promise((resolve,reject)=>{const request=require('node:http').get(origin+'/api/chatgpt/session',{headers:{Host:'evil.invalid',Cookie:cookie}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});assert.equal(badHost,403);
  assert.equal((await call('scan',{file,model:'gpt-6.1-sol',consent:true})).status,403);assert.equal(calls,0);
  const login=await call('sign-in',{});assert.equal(login.status,200);const s=await login.json();assert.equal(s.sharing,true);assert.ok(!JSON.stringify(s).includes('must-never'));
  assert.equal((await call('models')).status,200);assert.equal((await call('scan',{file,model:'gpt-6.1-sol',consent:false})).status,403);
  assert.equal((await call('scan',{file,model:'wrong-model',consent:true})).status,400);assert.equal(calls,0);
  const result=await call('scan',{file,model:'gpt-6.1-sol',consent:true});assert.equal(result.status,200);assert.equal((await result.json()).pages[0].sourcePage,1);assert.equal(calls,1);
  const out=await call('sign-out',{});assert.equal((await out.json()).sharing,false);assert.ok(!errorMessage({code:'invalid_request',message:'secret text'}).includes('secret text'));
 }finally{local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve));}
});
test('modified SDK sends PDF/schema with OAuth and returns the completed response',async t=>{
 const {streamResponse}=await import(pathToFileURL(path.resolve(__dirname,'../vendor/siwc-local/dist/responses.js')).href);
 const request=API.buildRequest(file,'mach');const output=payload();
 t.mock.method(globalThis,'fetch',async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/responses');const b=JSON.parse(init.body);assert.deepEqual(b.input,request.input);assert.deepEqual(b.text,request.text);assert.equal(b.store,false);assert.equal(b.stream,true);assert.equal(b.model,'gpt-6-luna');assert.equal(b.service_tier,'default');assert.equal(b.max_output_tokens,undefined);assert.equal(b.temperature,undefined);assert.equal(new Headers(init.headers).get('authorization'),'Bearer synthetic-test-token');return new Response('data: '+JSON.stringify({type:'response.completed',response:output})+'\n\n',{headers:{'content-type':'text/event-stream'}});});
 const result=await streamResponse('synthetic-test-token',{model:'gpt-6-luna',input:'',instructions:request.instructions,request},new AbortController().signal);assert.deepEqual(result.response,output);assert.equal(API.convert(result.response).pages.length,1);
});
test('Windows DPAPI roundtrip and ciphertext rejection without persisted secrets',{skip:process.platform!=='win32'},async()=>{
 const e=require('../desktop/windows-security.cjs').encryption();assert.equal(await e.isAvailable(),true);const text='synthetic offline token';const cipher=await e.encrypt(text);assert.ok(!Buffer.from(cipher).includes(Buffer.from(text)));assert.equal(await e.decrypt(cipher),text);await assert.rejects(e.decrypt(Buffer.from('invalid ciphertext')));
});

test('completed metadata can omit JSON already present in delta or done events',async t=>{
 const {completedScanResponse}=require('../desktop/server.cjs');
 const {streamResponse}=await import(pathToFileURL(path.resolve(__dirname,'../vendor/siwc-local/dist/responses.js')).href);
 const full=payload();const text=full.output[0].content[0].text;
 const event=x=>'data: '+JSON.stringify(x)+'\n\n';let wire='';
 t.mock.method(globalThis,'fetch',async()=>new Response(wire,{headers:{'content-type':'text/event-stream'}}));
 for(const events of [
  [{type:'response.output_text.delta',output_index:0,content_index:0,delta:text.slice(0,40)},{type:'response.output_text.delta',output_index:0,content_index:0,delta:text.slice(40)}],
  [{type:'response.output_text.done',output_index:0,content_index:0,text}],
  [{type:'response.output_item.done',output_index:0,item:full.output[0]}],
  [{type:'response.output_text.delta',output_index:0,content_index:0,delta:text},{type:'response.output_text.done',output_index:0,content_index:0,text}],
 ]){
  wire=events.map(event).join('')+event({type:'response.completed',response:{status:'completed'}});
  const result=await streamResponse('synthetic-test-token',{model:'gpt-6-luna',input:'test'},new AbortController().signal);
  assert.equal(API.convert(completedScanResponse(result)).pages[0].sourcePage,1);
 }
 assert.throws(()=>completedScanResponse({text,response:{status:'incomplete'}}));
 assert.throws(()=>API.convert(completedScanResponse({text:'{broken',response:{status:'completed'}})));
 assert.throws(()=>API.convert(completedScanResponse({text:'{}',response:{status:'completed'}})));
 assert.throws(()=>API.convert(completedScanResponse({text,response:{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'test'}]}]}})));
 assert.throws(()=>completedScanResponse({text:'',response:{status:'completed'}}));
});
