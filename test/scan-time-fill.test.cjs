const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../public/js/scanread.js');
test('blank downtime uses adjacent source rows and last work uses header end',()=>{
const p=S.normalizePage({form:'weld',equipment:'메인 1호기',end:'17:00',work:[{no:1,start:'07:40',end:'09:13'},{no:3,start:'09:21',end:'10:49'},{no:5,start:'11:09',end:'13:10'},{no:6,start:'13:17',end:'15:20'},{no:8,start:'16:31',end:null}],downtime:[{no:2,code:'A'},{no:4,code:'A'},{no:7,code:'A'}]});
assert.deepEqual(p.downtime.map(r=>[r.start,r.end]),[['09:13','09:21'],['10:49','11:09'],['15:20','16:31']]);assert.equal(p.work.at(-1).end,'17:00');assert.equal(p.reviews.length,7);
const explicit=S.normalizePage({form:'mach',end:'17:00',work:[{no:1,start:'08:00',end:'10:00'},{no:3,start:'11:00',end:'16:00'}],downtime:[{no:2,code:'C',start:'10:10',end:'10:30',note:'지그교체 — 5톤 → 10톤'}]});assert.equal(explicit.downtime[0].start,'10:10');assert.equal(explicit.work.at(-1).end,'16:00');assert.equal(S.toFormRows([explicit])[1][10],'5톤 → 10톤');
});
