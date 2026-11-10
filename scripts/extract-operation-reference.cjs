'use strict';
// Only explicit operational fields from the supplied accessibility captures are exported.
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[2];
if (!source) throw new Error('Pass the reference directory');
const read = name => fs.readFileSync(path.join(source, name), 'utf8');
const n = s => Number(s.replace(/,/g, ''));
const equipment = [];
let processId = 'mach';
for (const line of read('02-equipment.txt').split('\n')) {
  if (line.trim() === '- strong: 용접 로봇') processId = 'weld';
  const m = line.match(/- button "(.+?) (?:비가동 ([\d.]+)h )?\d+ 계획 ([\d,.]+)h · 가동 ([\d,.]+)h \(주간 ([\d,.]+)h \/ 야간 ([\d,.]+)h\)"/);
  const empty = line.match(/- button "(.+?) 0 조회기간 자료 없음"/);
  if (m) equipment.push({name:m[1],process:processId,plan:n(m[3]),down:m[2]?n(m[2]):0,run:n(m[4]),day:n(m[5]),night:n(m[6])});
  else if (empty) equipment.push({name:empty[1],process:processId,plan:null,down:null,run:null,day:null,night:null});
}
const rows = [];
let current;
for (const line of read('03-history.txt').split('\n')) {
  if (/^          - row "/.test(line)) { current = {cells:[],tooltip:''}; rows.push(current); }
  if (!current) continue;
  const c = line.match(/^            - cell(?: "(.*)")?:?\s*$/);
  if(c) current.cells.push(c[1] || '');
  const tip=line.match(/generic "원본 ([\d.]+)h ÷ (\d+)대/);
  if(tip) current.tooltip=tip.slice(1).join('|');
}
const history=[];
let pending=null;
for(const row of rows) {
  const c=row.cells;if(c.length!==10 || !/^2026-/.test(c[1]))continue;
  const [total,count] = row.tooltip ? row.tooltip.split('|').map(Number) : [n(c[8].replace('h','')),1];
  // Capture rows are contiguous within each original multi-equipment record.
  if(!pending || pending.left===0 || pending.key!==[c[0],c[1],c[2],c[4],c[5],c[6],c[7],total,count].join('|')) {
    const record={id:'reference-'+(history.length+1),process:c[0]==='NC 가공'?'mach':'weld',start:c[1],end:c[2],equipment:[],codes:c[4].match(/\b[A-H]\b/g)||[],part:c[5],cause:c[6],action:c[7],down:total,repair:n(c[9].replace('h',''))};
    history.push(record);pending={record,left:count,key:[c[0],c[1],c[2],c[4],c[5],c[6],c[7],total,count].join('|')};
  }
  pending.record.equipment.push(c[3]);pending.left--;
}
if(equipment.length!==31 || history.length!==17 || history.reduce((s,r)=>s+r.equipment.length,0)!==33) throw new Error('Unexpected capture structure: '+equipment.length+' / '+history.length);
const daily=[['2026-11-02',290.3,18],['2026-11-03',262.8,6],['2026-11-04',250.3,13.5],['2026-11-05',285.3,8]].map(([date,plan,down])=>({date,plan,down,run:plan-down,process:'all'}));
// Plans are read from the chart's visual left-to-right labels; accessibility order differs.
const weeks=[['2026-09-28',1312,28.3],['2026-10-05',808.4,1],['2026-10-12',658.6,80.3],['2026-10-19',1524.8,30.7],['2026-10-26',1599.6,245.6],['2026-11-02',1088.7,45.5]].map(([start,plan,down])=>({start,end:new Date(Date.parse(start)+6*86400000).toISOString().slice(0,10),plan,down,run:plan-down}));
const data={version:1,source:'제공된 운영 화면 캡처 · 2026-11-10',coverage:'캡처에서 확인된 값만 수록했습니다. 설비 집계는 11월 기준이며 주야간은 원본 표시값(계획 구분)입니다. 화면의 반올림 값을 합산하므로 원본 상단 수치와 소수점 차이가 있습니다. 미제공 기간은 확인 가능한 자료만 집계합니다. 일별 원시 설비 자료는 미제공입니다.',equipmentPeriod:{start:'2026-11-01',end:'2026-11-30'},equipment,daily,weeks,history};
fs.mkdirSync(path.join(__dirname,'../public/data'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../public/data/operation-reference.json'),JSON.stringify(data,null,2)+'\n');
console.log('Exported '+equipment.length+' equipment, '+history.length+' records, 33 rows');
