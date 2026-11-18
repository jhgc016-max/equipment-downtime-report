const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../public/js/operation-core.js');
test('date deletion preserves other dates and equipment and does not mutate source data',()=>{
 const data={equipment:[],daily:[{date:'2026-11-18',equipment:'A',process:'mach'},{date:'2026-11-18',equipment:'B',process:'mach'},{date:'2026-11-19',equipment:'A',process:'mach'}],history:[{id:'shared',process:'mach',start:'2026-11-18',end:'2026-11-18',equipment:['A','B'],down:4,repair:2},{id:'other',process:'mach',start:'2026-11-19',equipment:['A'],down:1}]};
 const result=C.deleteDate(data,'2026-11-18','mach','A');assert.equal(result.dailyCount,1);assert.equal(result.historyCount,1);assert.equal(data.daily.length,3);assert.equal(result.data.daily.length,2);assert.deepEqual(result.data.history[0].equipment,['B']);assert.equal(result.data.history[0].down,2);assert.equal(result.data.history[1].id,'other');
 const all=C.deleteDate(data,'2026-11-18');assert.equal(all.dailyCount,2);assert.equal(all.data.history.length,1);assert.throws(()=>C.deleteDate(data,'2026-02-30'));
});
