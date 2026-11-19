const {test}=require('node:test'),assert=require('node:assert/strict'),Report=require('../public/js/weekly-report.js');
test('weekly report follows the six-section comparison format without an AI write button',()=>{
 const data={imported:true,source:'test',equipment:[{name:'NC',process:'mach'},{name:'Robot',process:'weld'}],daily:[{date:'2026-11-09',equipment:'NC',process:'mach',plan:10,run:10,down:0},{date:'2026-11-09',equipment:'Robot',process:'weld',plan:10,run:9,down:1},{date:'2026-11-16',equipment:'NC',process:'mach',plan:10,run:9,down:1},{date:'2026-11-16',equipment:'Robot',process:'weld',plan:10,run:8,down:2}],history:[{id:'fault',process:'weld',start:'2026-11-16',end:'2026-11-16',equipment:['Robot'],codes:['B'],down:2,repair:2,action:'repair'}],legends:{mach:{A:'제관품 無',B:'장비고장'},weld:{A:'제관품 無',B:'장비고장'}}};
 const html=Report.render(data,'2026-11-18',true);
 assert.ok(!html.includes('AI 분석 작성'));assert.ok(html.includes('2026-11-16 ~ 2026-11-22'));assert.ok(html.includes('2026-11-09 ~ 2026-11-15'));
 for(const section of ['1. 가동률 변화','2. 일별 가동률','3. 공정별 전주','4. 범례 구성','5. 제관품 공급','6. 다음 주'])assert.ok(html.includes(section));
 assert.ok(html.includes('85.0%'));assert.ok(html.includes('-10.0%p'));assert.ok(html.includes('report-donut'));assert.ok(html.includes('금주·전주 일별'));
 assert.ok(html.includes('0.0h · 0.0%'),'robot B fault is not counted as material shortage');assert.ok(!/NaN|Infinity/.test(html));
});
test('empty reporting week renders missing values and does not invent rates',()=>{
 const html=Report.render({imported:true,equipment:[],daily:[],history:[]},'2026-11-18',false);
 assert.ok(html.includes('비교 자료 확인 필요'));assert.ok(html.includes('0대 / 0일'));assert.ok(!/NaN|Infinity/.test(html));
});
