(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MonthlyExport=factory();})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col=i=>{let s='';for(;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
 const serial=d=>(Date.parse(d+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
 function sheetEditor(xml){
  const rows=new Map();const content=xml.match(/<sheetData[^>]*>([\s\S]*?)<\/sheetData>/)[1];
  for(const match of content.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)){
   const rn=Number(match[1].match(/\br="(\d+)"/)[1]),cells=new Map();
   for(const c of (match[2]||'').matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g))cells.set(c[1],c[0]);
   rows.set(rn,{attributes:match[1],cells});
  }
  function put(r,c,value,styleRow=r){
   if(!rows.has(r))rows.set(r,{attributes:' r="'+r+'"',cells:new Map()});
   const row=rows.get(r),ref=c+r,old=row.cells.get(ref)||rows.get(styleRow)?.cells.get(c+styleRow)||rows.get(styleRow)?.cells.get('C'+styleRow)||'',style=old.match(/\bs="(\d+)"/);
   let cell='<c r="'+ref+'"'+(style?' s="'+style[1]+'"':'');
   if(value==null||value==='')cell+='/>';
   else if(typeof value==='number'&&Number.isFinite(value))cell+='><v>'+value+'</v></c>';
   else cell+=' t="inlineStr"><is><t xml:space="preserve">'+escape(value)+'</t></is></c>';
   row.cells.set(ref,cell);
  }
  function cloneBlock(from,to){for(let offset=0;offset<11;offset++){
   const old=rows.get(from+offset);if(!old)continue;const cells=new Map();
   for(const [ref,cell] of old.cells){const cr=ref.replace(/\d+$/,'')+(to+offset);cells.set(cr,cell.replace(/\br="[A-Z]+\d+"/,'r="'+cr+'"'));}
   rows.set(to+offset,{attributes:old.attributes.replace(/\br="\d+"/,'r="'+(to+offset)+'"'),cells});
  }}
  return {put,cloneBlock,finish(){const body=[...rows].sort((a,b)=>a[0]-b[0]).map(([r,row])=>'<row'+row.attributes+'>'+[...row.cells].sort((a,b)=>{const idx=ref=>ref.match(/^[A-Z]+/)[0].split('').reduce((s,c)=>s*26+c.charCodeAt(0)-64,0);return idx(a[0])-idx(b[0]);}).map(x=>x[1]).join('')+'</row>').join('');return xml.replace(/(<sheetData[^>]*>)[\s\S]*?(<\/sheetData>)/,(_,a,b)=>a+body+b);}};
 }
 async function build(template,data,month,Zip){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('다운로드할 월을 선택하세요.');
  const zip=await Zip.loadAsync(template),X=typeof XLSX!=='undefined'?XLSX:require('../lib/xlsx.full.min.js');
  const wb=X.read(template,{type:template instanceof ArrayBuffer?'array':'buffer'}),days=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).getUTCDate(),end=month+'-'+days;
  const daily=data.daily.filter(r=>r.date.startsWith(month)),history=data.history.filter(r=>r.start<=end&&(r.end||r.start)>=month+'-01');
  for(let sn=1;sn<=4;sn++){
   const path='xl/worksheets/sheet'+sn+'.xml',ed=sheetEditor(await zip.file(path).async('string')),ws=wb.Sheets[wb.SheetNames[sn-1]],process=sn===1||sn===3?'mach':'weld';
   ed.put(sn<=2?1:2,'B',month.slice(0,4)+'년 '+Number(month.slice(5))+'월 '+(sn===1?'NC 설비 가동률':sn===2?'용접 ROBOT 가동률':sn===3?'대형가공 수리 내역 및 비가동 내역':'로봇시스템 수리 내역 및 비가동 내역'));
   if(sn<=2){
    const original=[];for(let r=16;r<500;r+=11){const name=ws['B'+r]?.v;if(!name)break;original.push({name,row:r});}
    const equipment=[...new Set([...original.map(e=>e.name),...data.equipment.filter(e=>e.process===process).map(e=>e.name)])];
    const blocks=[{row:4,name:null},...equipment.map((name,i)=>({row:16+i*11,name}))];
    for(const block of blocks){
     const r=block.row;if(block.name&&!original.some(e=>e.row===r))ed.cloneBlock(16,r);
     if(block.name)ed.put(r,'B',block.name);
     const ds=daily.filter(d=>d.process===process&&(!block.name||d.equipment===block.name));
     for(let day=1;day<=31;day++){
      const c=col(day+2),date=month+'-'+String(day).padStart(2,'0');ed.put(r,c,day<=days?serial(date):'');
      for(let offset=1;offset<=8;offset++)ed.put(r+offset,c,'');
      const records=ds.filter(d=>d.date===date);if(!records.length||day>days)continue;
      const sum=k=>records.every(d=>d[k]!=null)?records.reduce((s,d)=>s+d[k],0):null;
      const plan=sum('plan'),run=sum('run'),down=sum('down');
      ed.put(r+1,c,(sum('night')||0)>0?'주간+야간':'주간');
      for(const [offset,key] of [[2,'plan'],[3,'day'],[4,'night'],[5,'run'],[6,'down']])ed.put(r+offset,c,sum(key)==null?'':Math.round(sum(key)*60*1e8)/1e8);
      ed.put(r+7,c,plan>0?run/plan:'');
      const cc=[...new Set(history.filter(h=>h.process===process&&h.start<=date&&(h.end||h.start)>=date&&(!block.name||h.equipment.includes(block.name))).flatMap(h=>h.codes))];ed.put(r+8,c,cc.join(', '));
     }
     const plan=ds.reduce((s,d)=>s+d.plan,0),run=ds.reduce((s,d)=>s+d.run,0);ed.put(r+6,'AH',plan>0?run/plan:'');
    }
    const legend=data.legends?.[process];if(legend)ed.put(14,'B','범례) '+Object.entries(legend).map(([c,n])=>c+': '+n).join(', '));
   }else{
    const records=history.filter(h=>h.process===process),last=Math.max(sn===3?47:38,5+records.length);
    for(let r=5;r<=last;r++)for(let c=2;c<=17;c++)ed.put(r,col(c),'',5);
    records.forEach((h,i)=>{const values=[i+1,h.start,h.end,h.equipment.join('\n'),h.part,h.codes.join(', '),h.range||'',h.down==null?'':h.down*60,h.repair==null?'':h.repair*60,'',h.cause,h.action,'','',h.status||'',h.note||''];values.forEach((v,j)=>ed.put(5+i,col(j+2),v,5));});
    ed.put(last,'B',records.length+'건');ed.put(last,'C','합계');ed.put(last,'I',records.reduce((s,h)=>s+(h.down||0)*60,0));ed.put(last,'J',records.reduce((s,h)=>s+(h.repair||0)*60,0));
   }
   zip.file(path,ed.finish());
  }
  // Original styles, merges, widths, print settings and shared strings stay intact.
  // Replaced formula cells must not remain in Excel's old calculation chain.
  if(zip.file('xl/calcChain.xml')){
   zip.remove('xl/calcChain.xml');
   for(const path of ['xl/_rels/workbook.xml.rels','[Content_Types].xml']){
    const xml=await zip.file(path).async('string');zip.file(path,xml.replace(/<(?:Relationship|Override)\b[^>]*(?:calcChain|calcchain)[^>]*\/>/g,''));
   }
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
 }
 function open(data){
  const old=document.getElementById('monthly-export-dialog');if(old)old.remove();const dialog=document.createElement('dialog');dialog.id='monthly-export-dialog';
  dialog.innerHTML='<form><h2>월별 실적 엑셀 다운로드</h2><p class="muted">현재 불러온 자료에서 선택한 월의 가동표와 수리·조치 이력을 원본 4개 시트 서식에 채웁니다. 시간 단위는 분입니다.</p><label>다운로드할 월 <input name="month" type="month" required></label><p id="export-status" role="status"></p><div class="actions"><button class="primary" type="submit">선택한 월 다운로드</button><button type="button" id="export-close">취소</button></div></form>';
  document.body.appendChild(dialog);const form=dialog.querySelector('form'),input=form.elements.namedItem('month'),status=dialog.querySelector('#export-status');input.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
  input.onchange=()=>{status.textContent=data.daily.filter(r=>r.date.startsWith(input.value)).length+'개 날짜·설비 기록';};input.onchange();dialog.querySelector('#export-close').onclick=()=>dialog.close();
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
   try{const start=input.value+'-01',end=input.value+'-'+new Date(Date.UTC(+input.value.slice(0,4),+input.value.slice(5),0)).getUTCDate();if(!data.daily.some(r=>r.date.startsWith(input.value))&&!data.history.some(r=>r.start<=end&&(r.end||r.start)>=start))throw Error('선택한 월에 등록된 자료가 없습니다. 먼저 클라우드 자료를 불러오세요.');status.textContent='원본 서식에 데이터를 채우는 중…';const response=await fetch('templates/equipment-operation-template.xlsx');if(!response.ok)throw Error('엑셀 서식을 불러오지 못했습니다.');const bytes=await build(await response.arrayBuffer(),data,input.value,JSZip);const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=input.value+'_설비_가동비가동_실적.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='다운로드했습니다.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}
  };dialog.showModal();
 }
 return {build,open};
});
