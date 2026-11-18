(function(){
 'use strict';
 const esc=window.Downtime.esc;
 window.ManualHistory={open(data){
  let dialog=document.getElementById('manual-history-dialog');if(dialog)dialog.remove();
  dialog=document.createElement('dialog');dialog.id='manual-history-dialog';dialog.setAttribute('aria-labelledby','manual-history-title');
  dialog.innerHTML='<form id="manual-history-form"><div class="row"><h2 id="manual-history-title">수리·조치 이력 직접 입력</h2><button type="button" id="manual-close" aria-label="닫기">✕</button></div><p class="muted">입력한 이력은 클라우드에 저장됩니다. 가동표의 가동·비가동 합계는 변경하지 않습니다.</p><div class="manual-fields"><label>공정<select name="process"><option value="mach">NC 가공</option><option value="weld">용접 로봇</option></select></label><label>설비명<input name="equipment" list="manual-equipment" required maxlength="120" placeholder="설비 선택 또는 직접 입력"><datalist id="manual-equipment"></datalist></label><label>발생일<input name="start" type="date" required></label><label>종료일<input name="end" type="date" required></label><label>비가동 범례<select name="code"></select></label><label>고장부위<input name="part" maxlength="300"></label><label>비가동시간(h)<input name="down" type="number" min="0" step="0.01" value="0" required></label><label>수리시간(h)<input name="repair" type="number" min="0" step="0.01" value="0" required></label><label class="wide">현상·원인<textarea name="cause" rows="3" maxlength="3000"></textarea></label><label class="wide">조치내용<textarea name="action" rows="3" maxlength="3000" required></textarea></label></div><p id="manual-error" class="orange" role="alert"></p><div class="actions"><button type="submit" class="primary" id="manual-save">클라우드에 저장</button><button type="button" id="manual-cancel">취소</button></div></form>';
  document.body.appendChild(dialog);const form=dialog.querySelector('form'),field=n=>form.elements.namedItem(n);let pendingId=window.crypto.randomUUID();
  const update=()=>{const process=field('process').value;dialog.querySelector('#manual-equipment').innerHTML=data.equipment.filter(e=>e.process===process).map(e=>'<option value="'+esc(e.name)+'">').join('');field('code').innerHTML='<option value="">미분류</option>'+Object.entries(data.legends?.[process]||window.OperationCore.codes[process]).map(([c,n])=>'<option value="'+c+'">'+esc(c+' · '+n)+'</option>').join('');};
  field('process').onchange=()=>{field('equipment').value='';update();};update();
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());field('start').value=today;field('end').value=today;
  dialog.querySelector('#manual-close').onclick=dialog.querySelector('#manual-cancel').onclick=()=>dialog.close();
  form.onsubmit=async event=>{event.preventDefault();const error=dialog.querySelector('#manual-error'),button=dialog.querySelector('#manual-save');error.textContent='';
   const value=n=>field(n).value.trim(),name=value('equipment'),process=value('process');
   if(!name||!value('action')){error.textContent='설비명과 조치내용을 입력하세요.';return;}
   if(value('end')<value('start')){error.textContent='종료일은 발생일보다 빠를 수 없습니다.';return;}
   if(data.equipment.some(e=>e.name===name&&e.process!==process)){error.textContent='해당 설비는 다른 공정에 등록되어 있습니다.';return;}
   const down=Number(value('down')),repair=Number(value('repair'));if(!Number.isFinite(down)||!Number.isFinite(repair)||down<0||repair<0){error.textContent='시간은 0 이상의 숫자로 입력하세요.';return;}
   const record={id:'manual-'+pendingId,process,start:value('start'),end:value('end'),equipment:[name],codes:value('code')?[value('code')]:[],part:value('part'),cause:value('cause'),action:value('action'),down,repair};
   button.disabled=true;dialog.querySelector('#manual-close').disabled=true;dialog.querySelector('#manual-cancel').disabled=true;
   try{await window.OperationSync.saveData({version:1,imported:true,equipment:[{name,process}],daily:[],history:[record],weeks:[]});dialog.close();window.dispatchEvent(new CustomEvent('manual-history-saved',{detail:{start:record.start,end:record.end,process}}));}
   catch(e){error.textContent=e.message;}
   finally{button.disabled=false;dialog.querySelector('#manual-close').disabled=false;dialog.querySelector('#manual-cancel').disabled=false;}
  };dialog.showModal();
 }};
})();
