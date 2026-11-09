'use strict';
const fs=require('node:fs');const path=require('node:path');
function stamp(html,sha,date=new Date()) {
 if(!/^[a-f0-9]{40}$/i.test(sha))throw new Error('A full Git commit SHA is required');
 const time=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
 const label='버전: '+sha.slice(0,7)+' · 배포: '+time+' (한국시간)';
 if(!html.includes('data-site-version'))throw new Error('Missing visible release marker');
 html=html.replace(/(<[^>]+data-site-version[^>]*>)[^<]*(<\/[^>]+>)/g,(_,a,b)=>a+label+b);
 // Update every local asset URL together so old scan logic cannot survive a release.
 return html.replace(/\b(src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]*)?)"/g,(all,attr,url)=>{
  if(/^(?:[a-z]+:|\/\/)/i.test(url))return all;
  return attr+'="'+url.split('?')[0]+'?v='+sha+'"';
 });
}
function build(root,sha){for(const file of fs.readdirSync(root)){if(!file.endsWith('.html'))continue;const target=path.join(root,file);const html=fs.readFileSync(target,'utf8');if(html.includes('data-site-version'))fs.writeFileSync(target,stamp(html,sha));}}
if(require.main===module)build(path.resolve(__dirname,'../public'),process.env.GITHUB_SHA);
module.exports={stamp,build};
