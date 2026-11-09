'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {timingSafeEqual}=require('node:crypto');
const {buildRequest,convert,ScanError,upstreamError}=require('./extraction.cjs');
function createServer(env=process.env,upstream=fetch) {
 const token=env.SCAN_ACCESS_TOKEN || '';
 if(token.length<32) throw new Error('SCAN_ACCESS_TOKEN must contain at least 32 characters');
 if(!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
 const origins=new Set((env.ALLOWED_ORIGINS||'http://localhost:8787').split(',').map(s=>s.trim()));
 const usage={minute:0,day:0,count:0,daily:0,active:0};
 const root=path.resolve(__dirname,'../public');
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const send=(status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(origin && !origins.has(origin)) return send(403,{error:'허용되지 않은 사이트입니다.'});
  if(origin) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  if(req.url==='/api/scan') {
   if(req.method==='OPTIONS') {res.writeHead(204,headers); return res.end();}
   if(req.method!=='POST') return send(405,{error:'POST 요청만 지원합니다.'});
   const supplied=Buffer.from(req.headers.authorization || ''),expected=Buffer.from('Bearer '+token);
   if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return send(401,{error:'중계 서버 접근 암호가 올바르지 않습니다.'});
   const now=Date.now(), minute=Math.floor(now/60000),day=Math.floor(now/86400000);
   if(usage.minute!==minute) {usage.minute=minute;usage.count=0;}
   if(usage.day!==day) {usage.day=day;usage.daily=0;}
   if(usage.count>=5 || usage.daily>=50 || usage.active>=1) return send(429,{error:'중계 서버 한도(분당 5회·하루 50회·동시 1회)에 도달했습니다.'});
   usage.count++;usage.daily++;usage.active++;
   try {
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw new ScanError('JSON 요청만 지원합니다.',415);
    const chunks=[];let size=0;
    for await(const chunk of req) {size+=chunk.length;if(size>14*1024*1024) throw new ScanError('파일당 최대 용량은 10MB입니다.',413);chunks.push(chunk);}
    let body;try {body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ScanError('잘못된 요청입니다.',400);}
    const request=buildRequest(body.file,body.form);
    let response;try {response=await upstream('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});}catch{throw new ScanError('OpenAI 연결 실패 또는 처리 시간 초과입니다. 다시 시도하세요.');}
    if(!response.ok) { await response.body?.cancel(); throw upstreamError(response.status); }
    let payload;try{payload=await response.json();}catch{throw new ScanError('OpenAI 응답을 읽을 수 없습니다. 다시 처리하세요.');}
    send(200,convert(payload));
   } catch(error) {send(error instanceof ScanError?error.status:500,{error:error instanceof ScanError?error.message:'중계 서버 처리에 실패했습니다.'});}
   finally {usage.active--;}
   return;
  }
  if(!['GET','HEAD'].includes(req.method)) return send(405,{error:'지원하지 않는 요청입니다.'});
  try {
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!target.startsWith(root+path.sep)) return send(404,{error:'파일을 찾을 수 없습니다.'});
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf'};
   const file=await fs.readFile(target); res.writeHead(200,{...headers,'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:file);
  }catch{send(404,{error:'파일을 찾을 수 없습니다.'});}
 });
 server.requestTimeout=200000;server.headersTimeout=15000;
 return server;
}
if(require.main===module) {const server=createServer();server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Scan relay started'));}
module.exports={createServer};
