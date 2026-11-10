(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OperationCore=factory();})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const names={mach:'NC 가공',weld:'용접 로봇'};
  const codes={mach:{A:'제관품 無',B:'장비고장',C:'지그교체',D:'계획정지',E:'공정결원',F:'청소',G:'기타'},weld:{A:'제관품 대기',B:'제관품 無',C:'장비고장',D:'티칭수정',E:'계획정지',F:'공정결원',G:'청소',H:'기타'}};
  const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  function monday(d){const day=new Date(d+'T00:00:00Z').getUTCDay();return addDays(d,-((day+6)%7));}
  function monthEnd(m){return new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).toISOString().slice(0,10);}
  function range(month,unit){const end=monthEnd(month);if(unit==='month'){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-11);return {start:d.toISOString().slice(0,10),end};}if(unit==='week'){const anchor=monday(addDays(month+'-01',7));return {start:addDays(anchor,-35),end:addDays(anchor,6)};}return {start:month+'-01',end};}
  const overlaps=(r,a,b)=>r.start<=b&&(r.end||r.start)>=a;
  function sum(rows){if(!rows.length)return {hasData:false,plan:null,down:null,run:null,day:null,night:null,rate:null};const value=k=>rows.every(r=>r[k]!=null)?rows.reduce((s,r)=>s+r[k],0):null;const plan=value('plan'),run=value('run');return {hasData:true,plan,run,down:value('down'),day:value('day'),night:value('night'),rate:plan>0&&run!=null?run/plan*100:null};}
  function equipment(data,a,b){
    if(data.imported){return data.equipment.map(e=>({...e,...sum(data.daily.filter(r=>r.equipment===e.name&&r.date>=a&&r.date<=b))}));}
    const full=a<=data.equipmentPeriod.start&&b>=data.equipmentPeriod.end;
    return data.equipment.map(e=>({...e,...(full&&e.plan!=null?{hasData:true,rate:e.plan>0?e.run/e.plan*100:null}:sum([]))}));
  }
  function aggregate(data,a,b,process='all'){
    if(data.imported)return sum(data.daily.filter(r=>r.date>=a&&r.date<=b&&(process==='all'||r.process===process)));
    if(a<=data.equipmentPeriod.start&&b>=data.equipmentPeriod.end&&a>=data.equipmentPeriod.start)return sum(data.equipment.filter(e=>e.plan!=null&&(process==='all'||e.process===process)));
    if(process!=='all')return sum([]);
    const weeks=data.weeks.filter(w=>w.start>=a&&w.end<=b);
    if(weeks.length&&weeks[0].start===a&&weeks.at(-1).end===b)return sum(weeks);
    return sum(data.daily.filter(r=>r.date>=a&&r.date<=b));
  }
  function buckets(data,a,b,unit){const out=[];let cursor=unit==='week'?monday(a):unit==='month'?a.slice(0,7)+'-01':a;while(cursor<=b){const end=unit==='week'?addDays(cursor,6):unit==='month'?monthEnd(cursor.slice(0,7)):cursor;out.push({start:cursor,end,...aggregate(data,cursor,end)});cursor=addDays(end,1);}return out;}
  function history(data,a,b,filter={}){
    const records=data.history.filter(r=>overlaps(r,a,b));
    const rows=records.flatMap(r=>r.equipment.map(e=>({...r,equipmentName:e,allocated:r.down==null?null:r.down/r.equipment.length,repairAllocated:r.repair==null?null:r.repair/r.equipment.length}))).filter(r=>(!filter.process||filter.process==='all'||r.process===filter.process)&&(!filter.equipment||r.equipmentName===filter.equipment)&&(!filter.code||r.codes.includes(filter.code)));
    return {rows,count:new Set(rows.map(r=>r.id)).size,total:rows.reduce((s,r)=>s+(r.allocated||0),0)};
  }
  function categories(data,a,b,process){
    const allocations=[];
    if(data.imported){
      data.daily.filter(d=>d.process===process&&d.date>=a&&d.date<=b&&d.down>0).forEach(d=>{
        const matches=data.history.filter(r=>r.process===process&&r.equipment.includes(d.equipment)&&overlaps(r,d.date,d.date));
        const cc=[...new Set(matches.flatMap(r=>r.codes))];const cs=cc.length?cc:['?'];
        cs.forEach(code=>allocations.push({code,equipment:d.equipment,hours:d.down/cs.length}));
      });
    }else{
      history(data,a,b,{process}).rows.forEach(r=>{const cs=r.codes.length?r.codes:['?'];cs.forEach(code=>allocations.push({code,equipment:r.equipmentName,hours:(r.allocated||0)/cs.length}));});
    }
    const result=[];for(const x of allocations){let item=result.find(c=>c.code===x.code);if(!item){item={code:x.code,label:codes[process][x.code]||'분류 확인 필요',hours:0,equipment:{}};result.push(item);}item.hours+=x.hours;item.equipment[x.equipment]=(item.equipment[x.equipment]||0)+x.hours;}
    return result.sort((a,b)=>b.hours-a.hours);
  }
  function validate(data){
    const errors=[],seen=new Set();const registry=new Map(data.equipment.map(e=>[e.name,e.process]));
    const date=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
    data.daily.forEach((r,i)=>{const at=(i+2)+'행';if(!date(r.date))errors.push(at+': 날짜가 올바르지 않습니다.');if(!registry.has(r.equipment))errors.push(at+': 등록되지 않은 설비 '+r.equipment);if(registry.get(r.equipment)!==r.process)errors.push(at+': 설비 공정이 일치하지 않습니다.');for(const k of ['plan','down','run'])if(!Number.isFinite(r[k])||r[k]<0)errors.push(at+': '+k+' 시간은 0 이상의 숫자여야 합니다.');for(const k of ['day','night'])if(r[k]!=null&&(!Number.isFinite(r[k])||r[k]<0))errors.push(at+': 주야간 시간은 0 이상의 숫자여야 합니다.');if(r.down>r.plan)errors.push(at+': 비가동이 계획보다 큽니다.');if(r.run+r.down>r.plan+0.000001)errors.push(at+': 가동 + 비가동이 계획보다 큽니다.');const key=r.date+'|'+r.equipment;if(seen.has(key))errors.push(at+': 날짜·설비가 중복됩니다.');seen.add(key);});
    return errors;
  }
  function fromLegacy(res,D){
    const days=res.kinds.equip?.days||[];const equipment=[...new Set(days.map(d=>d.subject))].map(name=>({name,process:days.find(d=>d.subject===name).group}));
    const daily=days.map(d=>({date:d.date,equipment:d.subject,process:d.group,plan:d.plan/60,down:d.down/60,run:d.run/60,day:null,night:null}));
    const history=(res.repairs?.list||[]).map((r,i)=>{const equip=r.equip.split(/[,;\n、]+/).map(s=>s.trim()).filter(Boolean);const process=equipment.find(e=>e.name===equip[0])?.process||D.autoGroup(equip[0]);const text=r.cause+' '+r.note;return {id:'import-'+i,start:r.startDate,end:r.endDate||r.startDate,process,equipment:equip,codes:Object.keys(codes[process]).filter(c=>text.includes(codes[process][c])),part:r.part,cause:r.cause,action:r.action,down:r.downHr,repair:r.repairHr};});
    return {version:1,imported:true,source:'등록한 엑셀 자료',equipment,daily,history,weeks:[]};
  }
  return {names,codes,addDays,monday,monthEnd,range,overlaps,sum,equipment,aggregate,buckets,history,categories,validate,fromLegacy};
});
