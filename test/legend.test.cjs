'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');
const S=require('../public/js/scanread.js');const D=require('../public/js/downtime.js');
async function verify(){
 const settings=D.normSettings({});const maps={mach:{},weld:{}};
 settings.codes.forEach(c=>maps.mach[c.label]=c.code);settings.weldCodes.forEach(c=>maps.weld[c.label]=c.code);
 const page=S.blankPage('mach');Object.assign(page,{equipment:'150NC',worker:'test',date:'2026-11-20',start:'08:00',end:'17:00',downtime:[{no:1,code:'C',rawCode:'C',start:'10:00',end:'11:00',note:''}]});
 const rows=S.toFormRows([page],maps);assert.equal(rows[1][6],'C');assert.equal(rows[1][10],'지그교체');assert.equal(rows[1][9],60);
 const parsed=D.parseSheet(rows,'form',{name:'test'},settings);assert.equal(parsed.records[0].code,'mach:C');
 page.downtime[0].code='B';const edited=S.toFormRows([page],maps);assert.equal(edited[1][6],'B');assert.equal(edited[1][10],'장비고장');
 page.form='weld';page.downtime[0].code='C';const welded=S.toFormRows([page],maps);assert.equal(welded[1][6],'C');assert.equal(welded[1][10],'장비고장');
 page.form='mach';const custom=S.toFormRows([page],{mach:{'장비고장':'C','지그교체':'B'}});assert.equal(custom[1][6],'C');assert.equal(custom[1][10],'장비고장');
 assert.equal(S.FORMS.mach.codes.find(c=>c[0]==='C')[1],'지그교체');assert.equal(S.FORMS.weld.codes.find(c=>c[0]==='C')[1],'장비고장');
 const prompt=S.prompt('').system;assert.ok(prompt.includes('가공 비가동 범례'));assert.ok(prompt.includes('용접 비가동 범례'));assert.ok(prompt.includes('다른 글자로 변경하지'));
 return 6;
}
if(require.main===module)test('reviewed legend codes survive aggregation conversion',verify);module.exports={verify};
