'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const {test}=require('node:test');const {stamp,build,versionFromCount,releaseVersion}=require('../scripts/stamp-release.cjs');
async function verify(){const sha='abcdef0123456789abcdef0123456789abcdef01';let count=0;
 const html='<div data-site-version>개발 중</div><h1>Title</h1><script src="js/scanread.js?v=old"></script><link href="css/app.css" rel="stylesheet"><script src="https://cdn.example/lib.js?v=external"></script>';
 const out=stamp(html,sha,new Date('2026-11-09T00:00:00Z'));assert.ok(out.includes('버전: 1.0'));assert.ok(out.includes('2026-11-09 09:00'));assert.ok(out.includes('js/scanread.js?v='+sha));assert.ok(out.includes('css/app.css?v='+sha));assert.ok(out.includes('https://cdn.example/lib.js?v=external'));assert.ok(!out.includes('v=old'));assert.equal(stamp(out,sha,new Date('2026-11-09T00:00:00Z')),out);count++;
 assert.throws(()=>stamp(html,'invalid'));assert.throws(()=>stamp('<h1>Missing marker</h1>',sha));count++;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'release-check-'));
 try{for(const name of ['index.html','scan.html','guide.html','plan.html']){const h=fs.readFileSync(path.join(__dirname,'../public',name),'utf8');assert.ok(h.indexOf('data-site-version')<h.indexOf('<h1'));fs.writeFileSync(path.join(dir,name),h);}build(dir,sha);for(const name of fs.readdirSync(dir)){const h=fs.readFileSync(path.join(dir,name),'utf8');assert.ok(h.includes('버전: 1.0'));assert.ok(!h.includes('개발 중 (미배포)'));}count++;}finally{for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
 assert.equal(versionFromCount(1),'1.0');assert.equal(versionFromCount(2),'1.1');assert.equal(versionFromCount(11),'1.10');assert.equal(releaseVersion(require('../release.json').baseCommit),'1.0');assert.ok(stamp(html,sha,new Date(),'1.2').includes('버전: 1.2'));assert.throws(()=>stamp(html,sha,new Date(),'invalid'));count++;
 return count;
}
if(require.main===module)test('visible release and consistent asset versions',verify);module.exports={verify};
