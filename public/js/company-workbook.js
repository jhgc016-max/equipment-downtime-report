(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CompanyWorkbook=factory();})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const text=v=>String(v??'').trim(),compact=v=>text(v).replace(/\s/g,'');
 function date(v){if(typeof v==='number'&&(v<40000||v>80000))return null;if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);const m=text(v).match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);return m?(+m[1]<100?'20'+m[1]:m[1])+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):null;}
 function parse(sheets){
  if(!sheets.some(s=>/NC.*가공/.test(s.name))||!sheets.some(s=>/용접/.test(s.name)))return null;
  const data={version:1,imported:true,source:'설비 비가동 이력 엑셀',equipment:[],daily:[],history:[],weeks:[],legends:{mach:{},weld:{}},warnings:[]};
  for(const sheet of sheets.filter(s=>/NC.*가공|용접/.test(s.name))){
   const p=/NC/.test(sheet.name)?'mach':'weld',a=sheet.aoa;
   const legend=a.flat().find(v=>/범례\)/.test(text(v)));if(legend)for(const m of text(legend).matchAll(/([A-H])\s*:\s*([^,\r\n]+)/g))data.legends[p][m[1]]=m[2].trim();
   for(let r=0;r<a.length;r++){
    const row=a[r]||[];if(!text(row[1])||!/\d{4}-/.test(date(row[2])||'')||/종합/.test(text(row[1])))continue;
    const name=text(row[1]);const fields={};for(let k=r+1;k<Math.min(r+10,a.length);k++){const label=compact(a[k]?.[1]);if(/^(계획시간|총보유시간)$/.test(label))fields.plan=k;else if(/^주간/.test(label))fields.day=k;else if(/^야간/.test(label))fields.night=k;else if(label==='가동시간')fields.run=k;else if(/비가동시간$/.test(label))fields.down=k;}
    if(fields.plan==null||fields.down==null)continue;
    data.equipment.push({name,process:p});
    for(let c=2;c<row.length;c++){const d=date(row[c]);if(!d)continue;const value=k=>{const v=a[fields[k]]?.[c];return v==null||v===''?0:Number(v)/60;};const plan=value('plan'),down=value('down'),run=value('run');if(!plan&&!down&&!run)continue;if(down>plan||run<0)data.warnings.push(name+' '+d+': plan '+plan+'h / down '+down+'h / run '+run+'h');data.daily.push({date:d,equipment:name,process:p,plan,down,run,day:value('day'),night:value('night')});}
   }
  }
  const canonical=(name,p)=>{const exact=data.equipment.find(e=>e.process===p&&compact(e.name)===compact(name));if(exact)return exact.name;const base=compact(name).replace(/\(.*$/,'');const found=data.equipment.filter(e=>e.process===p&&compact(e.name).replace(/\(.*$/,'')===base);return found.length===1?found[0].name:name;};
  for(const sheet of sheets.filter(s=>/수리.*내역/.test(s.name))){const p=/로봇/.test(sheet.name)?'weld':'mach';for(let i=0;i<sheet.aoa.length;i++){const r=sheet.aoa[i];if(typeof r[1]!=='number'||!date(r[2]))continue;const equipment=text(r[4]).split(/[\r\n,]+/).map(v=>canonical(v.trim(),p)).filter(Boolean);for(const name of equipment)if(!data.equipment.some(e=>e.name===name))data.equipment.push({name,process:p});data.history.push({id:p+'-'+r[1],start:date(r[2]),end:date(r[3])||date(r[2]),process:p,equipment:[...new Set(equipment)],codes:text(r[6]).match(/[A-H]/g)||[],part:text(r[5]),cause:text(r[11]),action:text(r[12]),down:r[8]===''||r[8]==null?null:Number(r[8])/60,repair:r[9]===''||r[9]==null?null:Number(r[9])/60,status:text(r[15]),note:text(r[16]),range:text(r[7]),sourceSheet:sheet.name,sourceRow:i+1});}}
  data.sourceAnomalies=true;data.coverage=data.warnings.join(" | ");return data;
 }
 return {parse};
});
