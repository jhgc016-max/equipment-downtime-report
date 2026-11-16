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
  function apply(value){
    const workspace=window.DowntimeSync.snapshot(value),D=window.Downtime,C=window.OperationCore;
    const parts=workspace.files.flatMap(f=>f.sheets.filter(s=>s.type!=='skip').map(s=>D.parseSheet(s.aoa,s.type,{file:f.name,sheet:s.name},workspace.settings)));
    const next=window.CompanyWorkbook?.parse(workspace.files.flatMap(f=>f.sheets))||C.fromLegacy(D.analyze(D.merge(parts),workspace.settings),D);
    const errors=C.validate(next);
    localStorage.setItem(RAW,JSON.stringify(workspace));
    if(next.daily.length&&!errors.length){
      next.source='공개 자료 자동 동기화';localStorage.setItem(ANALYSIS,JSON.stringify(next));announce('공유 자료를 분석 화면에 반영했습니다.');
    }else if(!workspace.files.length){localStorage.removeItem(ANALYSIS);announce('공유 자료가 비어 있어 참고 운영자료를 표시합니다.');}
    else announce('공유 자료를 불러왔습니다. 분석할 설비 기록이 없거나 확인할 값이 있습니다. 자료 관리에서 확인하세요.');
  }
  window.OperationSync={get:read,apply,set(value){const workspace=window.DowntimeSync.snapshot(value);localStorage.setItem(RAW,JSON.stringify(workspace));window.CloudSync?.changed();}};
})();
