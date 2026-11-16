const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../public/js/operation-core.js');
test('reimport updates the same equipment date and preserves other dates and equipment',()=>{
const before={equipment:[{name:'A'},{name:'B'}],daily:[{date:'2026-11-02',equipment:'A',down:1},{date:'2026-11-02',equipment:'B',down:2},{date:'2026-11-03',equipment:'A',down:3}],history:[{id:'mach-1',process:'mach',start:'2026-11-02',action:'old'}]};
const next={equipment:[{name:'A'}],daily:[{date:'2026-11-02',equipment:'A',down:4}],history:[{id:'mach-1',process:'mach',start:'2026-11-02',action:'new'}]};
const merged=C.mergeData(before,next);assert.equal(merged.daily.length,3);assert.equal(merged.daily.find(r=>r.date==='2026-11-02'&&r.equipment==='A').down,4);assert.equal(merged.daily.find(r=>r.equipment==='B').down,2);assert.equal(merged.history.length,1);assert.equal(merged.history[0].action,'new');assert.deepEqual(C.mergeData(merged,next),merged);
});
