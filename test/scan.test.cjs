'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {buildRequest,convert,schema}=require('../desktop/extraction.cjs');

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
 return count;
}
if(require.main===module) test('offline file extraction contract',verify);
module.exports={verify};
