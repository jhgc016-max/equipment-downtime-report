const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../public/js/operation-core.js');
test('NC and robot fault repair hours equal downtime including shared equipment allocations',()=>{
 const legends={mach:{B:'장비고장',C:'지그교체'},weld:{A:'제관품 無',B:'장비고장'}};
 for(const process of ['mach','weld']){
  const r={id:process,process,start:'2026-11-18',end:'2026-11-18',equipment:['A','B'],codes:['B'],down:11,repair:null};
  const rows=C.history({history:[r],legends},r.start,r.end).rows;
  assert.equal(rows[0].allocated,5.5);assert.equal(rows[0].repairAllocated,5.5);
  assert.equal(C.repairHours({...r,repair:2},legends),11);
 }
 assert.equal(C.repairHours({process:'mach',codes:['C'],down:1,repair:.5},legends),.5);
 assert.equal(C.repairHours({process:'weld',codes:['A'],down:1,repair:null},legends),null);
});
