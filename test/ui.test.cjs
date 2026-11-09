'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {test}=require('node:test');
async function verify() {
 const els={}; const el=id=>els[id] ||= {value:'',checked:false,hidden:false,innerHTML:'',dataset:{},listeners:{},classList:{add(){},remove(){}},addEventListener(t,fn){this.listeners[t]=fn;}};
 const store=new Map([['build-2611-11.ai','legacy-secret-to-remove']]);const readers=[];let calls=0,fail=true;
 const loc={origin:'http://localhost:8787',href:''};
 const context={window:{Scan:require('../public/js/scanread.js'),ScanAPI:require('../public/js/scan-api.js'),Downtime:require('../public/js/downtime.js')},document:{getElementById:el},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},location:loc,URL:class extends URL {static createObjectURL(f){return 'blob:'+f.name;}static revokeObjectURL(){}},AbortSignal,FileReader:class {readAsDataURL(f){readers.push(()=>this.onload({target:{result:'data:'+f.type+';base64,'+Buffer.from('%PDF-test').toString('base64')}}));}},fetch:async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.credentials,'omit');assert.equal(init.headers.Authorization,'Bearer browser-test-key');const request=JSON.parse(init.body);assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.input[0].content[1].type,'input_file');if(calls===1 && fail)return {ok:false,status:401};const S=context.window.Scan;
 function fixture(s){if(Array.isArray(s.type))return null;if(s.enum)return s.enum[0];if(s.type==='object')return Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,fixture(v)]));if(s.type==='array')return [];if(s.type==='integer')return 1;return '';}
 const data=fixture(context.window.ScanAPI.schema);const p=fixture(context.window.ScanAPI.schema.properties.pages.items);p.equipment='synthetic';data.pages=[p];return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]})};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/scan.js'),'utf8'),context);
 assert.equal(store.has('build-2611-11.ai'),false);
 el('btn-sc-sample').listeners.click();assert.ok(el('sc-pages').innerHTML.includes('150NC'));
 el('btn-sc-send').listeners.click();assert.equal(loc.href,'');el('sc-reviewed').checked=true;el('btn-sc-send').listeners.click();assert.equal(loc.href,'index.html#scan');assert.ok(store.has('build-2611-11.scan'));
 el('btn-sc-clear').listeners.click();
 el('sc-file').files=[{name:'first.pdf',type:'application/pdf',size:100},{name:'second.pdf',type:'application/pdf',size:100}];el('sc-file').listeners.change.call(el('sc-file'));
 readers[1]();readers[0]();assert.ok(el('sc-thumbs').innerHTML.indexOf('first.pdf')<el('sc-thumbs').innerHTML.indexOf('second.pdf'));
 el('sc-key').value='browser-test-key';el('sc-agree').checked=true;
 el('btn-sc-run').listeners.click();
 for(let i=0;i<20 && !el('sc-msg').innerHTML.includes('일부 파일');i++)await new Promise(setImmediate);
 assert.equal(calls,2);assert.ok(el('sc-thumbs').innerHTML.includes('이 파일 다시 처리'));assert.ok(el('sc-pages').innerHTML.includes('blob:second.pdf#page=1'));
 fail=false;el('sc-thumbs').listeners.click({target:{dataset:{retry:'0'}}});
 for(let i=0;i<20 && calls<3;i++)await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(calls,3);assert.ok(el('sc-pages').innerHTML.indexOf('first.pdf')<el('sc-pages').innerHTML.indexOf('second.pdf'));assert.equal(el('sc-reviewed').checked,false);
 assert.ok(![...store.values()].some(v=>v.includes('browser-test-key')));
 return 5;
}
if(require.main===module)test('offline UI workflow',verify);
module.exports={verify};
