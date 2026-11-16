const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../public/js/scanread.js'),API=require('../desktop/extraction.cjs');
test('partially readable handwriting remains in normalized downtime notes',()=>{
 const note='5톤 [판독불가] → 10톤 [판독불가]';
 const p=S.normalizePage({form:'mach',equipment:'150NC',date:'2026-11-16',downtime:[{no:1,code:'C',start:'10:00',end:'10:30',note}],unreadable:['downtime[0].note 일부 판독 불가']});
 assert.equal(p.downtime[0].note,note);assert.ok(p.unreadable.length);
 const request=API.buildRequest({mime:'application/pdf',base64:Buffer.from('%PDF-test').toString('base64')},'mach');
 assert.ok(request.instructions.includes('전체를 null로 버리지'));assert.ok(request.instructions.includes('[판독불가]'));
});
