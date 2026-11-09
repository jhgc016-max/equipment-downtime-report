'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');const L=require('../public/js/scan-local.js');
async function verify(){
 let count=0;
 const text='설비명: TEST 작업자: 홍길동\n작업일자 2026-11-09\n작업 내역\n1 08:00 09:00 생산\n비가동 내역\n2 09:00 10:00 A 대기\n3 10:00 흐림';
 const p=L.parse(text,'mach',2,'OCR');assert.equal(p.equipment,'TEST');assert.equal(p.worker,'홍길동');assert.equal(p.date,'2026-11-09');assert.equal(p.work.length,1);assert.equal(p.downtime.length,2);assert.equal(p.downtime[1].end,'');assert.equal(p.sourcePage,2);assert.equal(p.raw.text,text);assert.ok(p.reviews.some(r=>r.field.includes('원문')));count++;
 assert.equal(L.parse('글자만 보임','weld',1,'OCR').downtime.length,0);assert.equal(L.parse('2026-02-30','mach',1,'PDF').date,'');count++;
 const items=[{str:'right',transform:[1,0,0,1,50,100]},{str:'bottom',transform:[1,0,0,1,0,50]},{str:'left',transform:[1,0,0,1,0,100]}];assert.equal(L.linesFromItems(items),'left right\nbottom');count++;
 let rendered=0,recognized=0,terminated=0,destroyed=0,cleaned=0;
 const page1={getTextContent:async()=>({items:[{str:text,transform:[1,0,0,1,0,100]}]}),getOperatorList:async()=>({fnArray:[]}),cleanup:()=>{cleaned++;}};
 const page2={...page1,getOperatorList:async()=>({fnArray:[1]}),getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>{rendered++;return {promise:Promise.resolve()};}};
 const deps={pdfLib:async()=>({OPS:{paintImageXObject:1,paintInlineImageXObject:2,paintImageMaskXObject:3},getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async(n)=>n===1?page1:page2,destroy:async()=>{destroyed++;}})})}),canvas:()=>({getContext:()=>({})}),ocrLib:async()=>({createWorker:async(langs)=>{assert.equal(langs,'kor+eng');return {recognize:async()=>{recognized++;return {data:{text:'1 08:00 09:00 A OCR行'}};},terminate:async()=>{terminated++;}};}})};
 const result=await L.read({mime:'application/pdf',base64:Buffer.from('%PDF-synthetic').toString('base64')},'mach',()=>{},deps);
 assert.equal(result.pages.length,2);assert.equal(rendered,1);assert.equal(recognized,1);assert.equal(result.pages[0].method,'PDF 텍스트');assert.equal(result.pages[1].method,'PDF 페이지 OCR');assert.equal(result.pages[1].downtime.length,1);assert.equal(result.pages[1].work.length,0);assert.ok(result.pages[1].raw.pdfText.includes('TEST'));assert.equal(destroyed,1);assert.equal(cleaned,2);assert.equal(terminated,1);count++;
 const image=await L.read({mime:'image/png',url:'blob:synthetic'},'',null,deps);assert.equal(image.pages[0].sourcePage,1);assert.equal(recognized,2);assert.equal(terminated,2);count++;
 const broken={...deps,ocrLib:async()=>({createWorker:async()=>({recognize:async()=>{throw new Error('synthetic OCR failure');},terminate:async()=>{terminated++;}})})};await assert.rejects(()=>L.read({mime:'image/png',url:'blob:x'},'',null,broken));assert.equal(terminated,3);count++;
 return count;
}
if(require.main===module)test('free local PDF and OCR pipeline',verify);module.exports={verify};
