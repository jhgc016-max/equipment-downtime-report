const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../public/js/scanread.js');
test('input and sync rows contain only downtime while work remains available for time inference',()=>{
const p=S.normalizePage({form:'weld',date:'2026-11-17',end:'17:00',work:[{no:1,start:'08:00',end:'09:13',model:'08SR'},{no:3,start:'09:21'}],downtime:[{no:2,code:'A'}]});const rows=S.toFormRows([p]);assert.equal(rows.length,2);assert.equal(rows[1][5],'비가동');assert.equal(rows[1][7],'09:13');assert.equal(rows[1][8],'09:21');assert.equal(p.work.length,2);
assert.equal(S.toFormRows([S.normalizePage({form:'mach',work:[{no:1,start:'08:00',end:'17:00'}]})]).length,1);
});
