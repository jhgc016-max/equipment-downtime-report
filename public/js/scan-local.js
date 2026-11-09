/* Free local PDF text extraction and OCR. No document upload or model API. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./scanread.js'));else root.ScanLocal=factory(root.Scan);})(typeof self!=='undefined'?self:this,function(S){
'use strict';
const PDF='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/';
let pdfPromise,ocrPromise;
function linesFromItems(items){
 const lines=[];
 items.filter(i=>i.str&&i.str.trim()).forEach(i=>{const y=i.transform[5],x=i.transform[4];let line=lines.find(l=>Math.abs(l.y-y)<3);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,text:i.str});});
 return lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n');
}
function parse(text,form,pageNo,method){
 const p=S.blankPage(form==='weld'||(!form&&/ROBOT|로봇|트랙|용접/i.test(text))?'weld':'mach');p.downtime=[];
 p.sourcePage=pageNo;p.confidence='low';p.sourceText=text;p.method=method;p.raw={text};p.reviews=[{field:'전체',reason:'무료 인식 초안입니다. 원본의 모든 행·열, 시간, 코드와 누락 여부를 확인하세요. 손글씨와 표는 정확히 인식되지 않을 수 있습니다.'}];
 const dt=text.match(/\b(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);if(dt)p.date=S.date(dt[1]+'-'+dt[2]+'-'+dt[3])||'';
 let section='';
 text.split(/\r?\n/).forEach((line,index)=>{
  const equip=line.match(/(?:설비명|설비번호|트랙)\s*[:：]?\s*([^:：]+?)(?=\s+(?:작업자|작업일|날짜|시작|종료)|$)/);if(equip&&!p.equipment)p.equipment=(line.includes('트랙')?'트랙 ':'')+equip[1].trim();
  const worker=line.match(/작업자\s*[:：]?\s*(\S+)/);if(worker&&!p.worker)p.worker=worker[1];
  if(/비가동\s*내역/.test(line))section='down';else if(/작업\s*내역|생산\s*현황/.test(line))section='work';
  const times=[...line.matchAll(/(?<![\d:])(?:[01]?\d|2[0-4])\s*[:시]\s*[0-5]\d(?:분)?(?![\d:])/g)];
  if(/(?:시작|종료|가동시간)/.test(line)&&!/^\s*\d+\s/.test(line)){
   if(/시작/.test(line)&&times[0])p.start=S.time(times[0][0])||'';
   if(/종료/.test(line)&&times.length)p.end=S.time(times[times.length-1][0])||'';
   return;
  }
  if(!times.length)return;
  const number=line.match(/^\s*(\d{1,3})(?:[.)]|\s)/);const no=number?+number[1]:index+1;
  const code=(line.match(/(?:^|\s)([A-H])(?:\s|$)/)||[])[1]||'';
  const down=section==='down'||!!code;
  const row={no,start:S.time(times[0][0])||'',end:times[1]?S.time(times[1][0])||'':'',note:line,code,rawCode:code};
  if(down)p.downtime.push(row);else p.work.push({...row,model:'',part:'',job:'',qty:''});
  p.reviews.push({field:(down?'downtime':'work')+'['+no+'] · 원문 '+(index+1)+'줄',reason:'원문: '+line+' — 행·열과 가동/비가동 분류를 확인하세요.'});
 });
 if(!p.work.length&&!p.downtime.length)p.reviews.push({field:'전체',reason:'시간 행을 자동 분류하지 못했습니다. 아래 인식 텍스트를 수정해 다시 채우거나 작업·비가동 행을 직접 추가하세요.'});
 return p;
}
async function pdfLib(){if(!pdfPromise)pdfPromise=import(PDF+'build/pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=PDF+'build/pdf.worker.mjs';return lib;}).catch(()=>{pdfPromise=null;throw new Error('PDF 읽기 도구 다운로드 실패. 인터넷 연결을 확인하고 다시 처리하세요.');});return pdfPromise;}
async function ocrLib(){if(!ocrPromise)ocrPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>{s.remove();ocrPromise=null;reject(new Error('OCR 도구 다운로드 실패. 인터넷 연결을 확인하세요.'));};document.head.appendChild(s);});return ocrPromise;}
async function read(file,form,progress,deps){
 deps=deps||{};
 let worker,pdf;const pages=[];
 const report=t=>{if(progress)progress(t);};
 async function recognize(image){if(!worker){report('한국어·영어 OCR 도구 준비 중 (첫 실행은 오래 걸릴 수 있습니다)');const lib=await (deps.ocrLib?deps.ocrLib():ocrLib());worker=await lib.createWorker('kor+eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://tessdata.projectnaptha.com/4.0.0',logger:m=>{if(m.status==='recognizing text')report('글자 인식 '+Math.round((m.progress||0)*100)+'%');}});}return (await worker.recognize(image)).data.text;}
 try{
  if(file.mime!=='application/pdf'){const text=await recognize(file.url);return {pages:[parse(text,form,1,'OCR')]};}
  const lib=await (deps.pdfLib?deps.pdfLib():pdfLib());const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
  const task=lib.getDocument({data:bytes,isEvalSupported:false,verbosity:0,cMapUrl:PDF+'cmaps/',cMapPacked:true,standardFontDataUrl:PDF+'standard_fonts/',wasmUrl:PDF+'wasm/'});
  task.onPassword=()=>{task.destroy();};
  pdf=await task.promise;
  if(pdf.numPages>30)throw new Error('한 번에 최대 30쪽까지 읽습니다. PDF를 나누어 올려 주세요.');
  for(let n=1;n<=pdf.numPages;n++){
   report(n+'/'+pdf.numPages+'쪽 읽는 중');const page=await pdf.getPage(n);
   let text=linesFromItems((await page.getTextContent()).items),method='PDF 텍스트';const pdfText=text;let ocrText=null;
   const ops=await page.getOperatorList();const images=[lib.OPS.paintImageXObject,lib.OPS.paintInlineImageXObject,lib.OPS.paintImageMaskXObject];
   if(text.trim().length<30||ops.fnArray.some(op=>images.includes(op))){
    const base=page.getViewport({scale:1});const scale=Math.min(2.5,3000/Math.max(base.width,base.height));const vp=page.getViewport({scale});
    const canvas=deps.canvas?deps.canvas():document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
    try{await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;ocrText=await recognize(canvas);text=ocrText.trim()?ocrText:pdfText;method='PDF 페이지 OCR';}finally{canvas.width=canvas.height=0;}
   }
   const result=parse(text,form,n,method);result.raw={pdfText,ocrText,text};pages.push(result);page.cleanup();
  }
  return {pages};
 }catch(e){if(e.name==='PasswordException'||e.name==='AbortException')throw new Error('암호로 보호된 PDF는 잠금을 해제한 뒤 올려 주세요.');throw e;}
 finally{if(worker)await worker.terminate();if(pdf)await pdf.destroy();}
}
return {read,parse,linesFromItems};
});
