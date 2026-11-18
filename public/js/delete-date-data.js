(function(){
 'use strict';
 document.addEventListener('click',event=>{
  if(event.target.closest('#reset-cloud-data')){
   document.getElementById('reset-cloud-dialog')?.remove();const box=document.createElement('dialog');box.id='reset-cloud-dialog';box.setAttribute('aria-labelledby','reset-cloud-title');
   box.innerHTML='<form><h2 id="reset-cloud-title">클라우드 자료 전체 초기화</h2><p>모든 날짜의 가동·비가동 자료, 수리·조치 이력과 설비 목록·설정이 삭제됩니다. 다른 PC에도 반영되며 되돌릴 수 없습니다.</p><p id="reset-cloud-preview" role="status">최신 클라우드 자료를 확인하는 중…</p><label>계속하려면 <strong>전체 초기화</strong>를 입력하세요.<input name="confirmation" autocomplete="off" required></label><div class="actions" style="margin-top:18px"><button class="danger" type="submit" disabled>전체 초기화 실행</button><button id="reset-cloud-cancel" type="button">취소</button></div></form>';
   document.body.appendChild(box);box.showModal();const form=box.querySelector('form'),input=form.elements.namedItem('confirmation'),button=form.querySelector('[type=submit]'),status=box.querySelector('#reset-cloud-preview');let preview=null;
   box.querySelector('#reset-cloud-cancel').onclick=()=>box.close();input.oninput=()=>{button.disabled=!preview||input.value.trim()!=='전체 초기화';};
   window.CloudSync.previewWorkspaceReset().then(value=>{preview=value;status.textContent='설비 '+value.equipmentCount+'대 · 가동표 '+value.dailyCount+'행 · 수리·조치 이력 '+value.historyCount+'건 전체가 초기화 대상입니다.';input.oninput();}).catch(e=>{status.textContent=e.message;});
   form.onsubmit=async e=>{e.preventDefault();if(!preview||input.value.trim()!=='전체 초기화')return;button.disabled=true;input.disabled=true;
    try{await window.CloudSync.confirmWorkspaceReset(preview);box.close();}
    catch(error){status.textContent=error.message;preview=null;input.disabled=false;}
   };return;
  }
  if(!event.target.closest('#delete-date-data'))return;
  document.getElementById('delete-date-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='delete-date-dialog';dialog.setAttribute('aria-labelledby','delete-date-title');
  dialog.innerHTML='<form><h2 id="delete-date-title">날짜 데이터 삭제</h2><p class="muted">가동표는 선택한 날짜, 수리·조치 이력은 발생일 기준으로 삭제합니다. 여러 날에 걸친 이력도 발생일이 같으면 함께 삭제됩니다. 다른 날짜의 가동표는 유지합니다.</p><div class="manual-fields"><label>삭제할 날짜<input name="date" type="date" required></label><label>공정<select name="process"><option value="all">전체</option><option value="mach">NC 가공</option><option value="weld">용접 로봇</option></select></label><label class="wide">설비명(비우면 해당 공정 전체)<input name="equipment" list="delete-equipment" maxlength="120"><datalist id="delete-equipment"></datalist></label></div><p id="delete-preview" role="status"></p><div class="actions"><button type="submit" id="delete-inspect">삭제 대상 확인</button><button type="button" id="delete-confirm" class="danger" hidden>확인한 자료 삭제</button><button type="button" id="delete-cancel">취소</button></div></form>';
  document.body.appendChild(dialog);const form=dialog.querySelector('form'),field=n=>form.elements.namedItem(n),status=dialog.querySelector('#delete-preview'),confirm=dialog.querySelector('#delete-confirm');let preview=null;
  field('date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  try{const data=window.OperationSync.decode(window.OperationSync.get());dialog.querySelector('#delete-equipment').innerHTML=data.equipment.map(e=>'<option value="'+window.Downtime.esc(e.name)+'">').join('');}catch{}
  form.onchange=()=>{preview=null;confirm.hidden=true;status.textContent='조건이 변경되었습니다. 삭제 대상을 다시 확인하세요.';};
  dialog.querySelector('#delete-cancel').onclick=()=>dialog.close();
  form.onsubmit=async event=>{event.preventDefault();confirm.hidden=true;preview=null;const button=dialog.querySelector('#delete-inspect');button.disabled=true;status.textContent='최신 클라우드 자료에서 삭제 대상을 확인하고 있습니다…';
   const selected={date:field('date').value,process:field('process').value,equipment:field('equipment').value.trim()};
   try{const result=await window.CloudSync.previewDateDeletion(selected.date,selected.process,selected.equipment);
    if(selected.date!==field('date').value||selected.process!==field('process').value||selected.equipment!==field('equipment').value.trim()){status.textContent='조건이 변경되었습니다. 다시 조회하세요.';return;}
    if(!result.dailyCount&&!result.historyCount){status.textContent='해당 조건에 삭제할 자료가 없습니다.';return;}
    preview=result;status.textContent=selected.date+' · '+(selected.equipment||'선택 공정 전체')+' · 가동표 '+result.dailyCount+'행, 수리·조치 이력 '+result.historyCount+'건이 삭제 대상입니다. 클라우드에서 삭제하면 다른 PC에도 반영되며 되돌릴 수 없습니다.';confirm.hidden=false;
   }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
  };
  confirm.onclick=async()=>{if(!preview)return;confirm.disabled=true;dialog.querySelector('#delete-inspect').disabled=true;
   try{await window.CloudSync.confirmDateDeletion(preview);dialog.close();}catch(e){status.textContent=e.message;preview=null;confirm.hidden=true;}finally{confirm.disabled=false;dialog.querySelector('#delete-inspect').disabled=false;}
  };dialog.showModal();
 });
})();
