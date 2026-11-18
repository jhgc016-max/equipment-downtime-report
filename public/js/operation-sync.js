/* Reuse the shared workspace protocol on the analysis page. Captured reference data is never uploaded. */
(function(){
  'use strict';
  const RAW='equipment.operation.workspace.v1',ANALYSIS='downtime.operation.v1';
  function read(){
    try {const local=JSON.parse(localStorage.getItem(RAW)||'null');if(local)return window.DowntimeSync.snapshot(local);}catch{}
    try {const saved=JSON.parse(localStorage.getItem('equipment.sync.v1:public-shared-v1')||'null');if(saved?.payload)return window.DowntimeSync.snapshot(saved.payload);}catch{}
    return {version:1,files:[],settings:{}};
  }
  function announce(message){window.dispatchEvent(new CustomEvent('operation-workspace-updated',{detail:{message}}));}
  function decode(workspace){
    const sheets=workspace.files.flatMap(f=>f.sheets),normalized=sheets.filter(s=>s.type==='operation-v1');
    const D=window.Downtime,C=window.OperationCore;
    let base=normalized.reduce((a,s)=>C.mergeData(a,JSON.parse(s.aoa[0][0])),{equipment:[],daily:[],history:[]});
    const company=window.CompanyWorkbook?.parse(sheets);if(company)base=C.mergeData(base,company);
    const settings={...workspace.settings,equipGroups:{...workspace.settings.equipGroups,...Object.fromEntries(base.equipment.map(e=>[e.name,e.process]))}};
    const parts=workspace.files.flatMap(f=>f.sheets.filter(s=>s.type!=='skip'&&s.type!=='operation-v1'&&(!company||s.type==='form')).map(s=>D.parseSheet(s.aoa,s.type,{file:f.name,sheet:s.name},settings)));
    if(!parts.length)return base;
    const input=D.merge(parts),extra=C.fromLegacy(D.analyze(input,settings),D);
    // Scan downtime rows are also action history; the operation totals remain separate.
    input.records.filter(r=>r.kind==='equip'&&r.cls==='down').forEach((r,i)=>extra.history.push({id:'scan-'+r.date+'-'+r.subject+'-'+r.start+'-'+r.end+'-'+i,process:r.group,start:r.date,end:r.date,equipment:[r.subject],codes:[String(r.code).split(':').pop()].filter(c=>c!=='?'),part:'',cause:r.note||'',action:r.note||'',down:(r.end-r.start)/60,repair:null}));
    return C.mergeData(base,extra);
  }
  function apply(value){
    const workspace=window.DowntimeSync.snapshot(value),D=window.Downtime,C=window.OperationCore;
    const next=decode(workspace);
    const errors=C.validate(next);
    localStorage.setItem(RAW,JSON.stringify(workspace));
    if((next.daily.length||next.history.length||next.equipment.length)&&!errors.length){
      next.source='공개 자료 자동 동기화';localStorage.setItem(ANALYSIS,JSON.stringify(next));announce('공유 자료를 분석 화면에 반영했습니다.');
    }else if(!workspace.files.length){localStorage.removeItem(ANALYSIS);announce('공유 자료가 비어 있어 참고 운영자료를 표시합니다.');}
    else announce('공유 자료를 불러왔습니다. 분석할 설비 기록이 없거나 확인할 값이 있습니다. 자료 관리에서 확인하세요.');
  }
  window.OperationSync={get:read,apply,decode,async saveData(incoming){return window.CloudSync.saveAnalysis(incoming);},set(value){const workspace=window.DowntimeSync.snapshot(value);localStorage.setItem(RAW,JSON.stringify(workspace));window.CloudSync?.changed();}};
})();
