'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
function versionFromCount(count,major=1){if(!Number.isInteger(count)||count<0||!Number.isInteger(major)||major<1)throw new Error('Invalid release counter');return major+'.'+Math.max(0,count-1);}
function releaseVersion(sha){const config=require('../release.json');const cwd=path.resolve(__dirname,'..');execFileSync('git',['merge-base','--is-ancestor',config.baseCommit,sha],{cwd});const count=Number(execFileSync('git',['rev-list','--first-parent','--count',config.baseCommit+'..'+sha],{cwd,encoding:'utf8'}).trim());return versionFromCount(count,config.major);}
function stamp(html,sha,date=new Date(),version='1.0') {
 if(!/^[a-f0-9]{40}$/i.test(sha))throw new Error('A full Git commit SHA is required');
 const time=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 if(!/^\d+\.\d+$/.test(version))throw new Error('Invalid display version');
 const label='버전: '+version+' · 배포: '+time+' (한국시간)';
 if(!html.includes('data-site-version'))throw new Error('Missing visible release marker');
 html=html.replace(/(<[^>]+data-site-version[^>]*>)[^<]*(<\/[^>]+>)/g,(_,a,b)=>a+label+b);
 // Update every local asset URL together so old scan logic cannot survive a release.
 return html.replace(/\b(src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]*)?)"/g,(all,attr,url)=>{
  if(/^(?:[a-z]+:|\/\/)/i.test(url))return all;
  return attr+'="'+url.split('?')[0]+'?v='+sha+'"';
 });
}
function build(root,sha,version='1.0'){for(const file of fs.readdirSync(root)){if(!file.endsWith('.html'))continue;const target=path.join(root,file);const html=fs.readFileSync(target,'utf8');if(html.includes('data-site-version'))fs.writeFileSync(target,stamp(html,sha,new Date(),version));}}
if(require.main===module)build(path.resolve(__dirname,'../public'),process.env.GITHUB_SHA,releaseVersion(process.env.GITHUB_SHA));
module.exports={stamp,build,versionFromCount,releaseVersion};
