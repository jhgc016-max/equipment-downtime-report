'use strict';
const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {randomBytes,timingSafeEqual}=require('node:crypto');
const API=require('./extraction.cjs');
const {encryption,openBrowser}=require('./windows-security.cjs');
const root=path.resolve(__dirname,'../public');
function completedScanResponse(result){
 const response=result?.response;
 if(!response || response.status!=='completed')throw new API.ScanError('AI 응답이 불완전합니다. 이 파일만 다시 처리하세요.');
 const output=Array.isArray(response.output)?response.output:[];
 const content=output.filter(o=>o.type==='message').flatMap(o=>o.content||[]);
 if(content.some(c=>c.type==='refusal') || content.some(c=>c.type==='output_text' && typeof c.text==='string' && c.text.trim()))return response;
 // Completion metadata can omit message content already delivered as deltas.
 // Use only text from that same completed request; strict schema checks follow.
 if(typeof result.text==='string' && result.text.trim())return {...response,output:[...output,{type:'message',content:[{type:'output_text',text:result.text}]}]};
 throw new API.ScanError('완료 응답에 추출 텍스트가 없습니다. 이 파일만 다시 처리하세요.');
}
function safeSession(s){return {status:s.status,sharing:s.sharing===true,identity:s.identity?{name:s.identity.name,email:s.identity.email}:undefined};}
function errorMessage(e){const code=typeof e?.code==='string'&&/^[a-z0-9_]{1,80}$/.test(e.code)?e.code:'connection_error';const messages={subscription_sharing_unsupported_capability:'현재 ChatGPT 구독 연결이 PDF·이미지 또는 구조화 응답 기능을 지원하지 않습니다.',subscription_sharing_user_not_eligible:'이 계정 또는 워크스페이스는 구독 연결 사용 대상이 아닙니다.',subscription_sharing_usage_limit_exceeded:'ChatGPT 구독 연결 사용 한도에 도달했습니다. 사용량 설정을 확인하세요.',subscription_sharing_usage_unavailable:'ChatGPT 사용량 확인이 일시적으로 불가능합니다. 잠시 후 다시 시도하세요.',model_not_found:'선택한 모델을 이 ChatGPT 계정에서 사용할 수 없습니다.',sharing_not_enabled:'ChatGPT 로그인은 되었지만 구독 사용 권한이 없습니다. 로그인 화면에서 사용 권한을 승인하세요.',sign_in_required:'ChatGPT에 로그인하세요.',reauth_required:'ChatGPT에 다시 로그인하세요.',cancelled:'작업을 취소했습니다.',insufficient_quota:'ChatGPT 구독 사용 한도에 도달했습니다. 계정의 사용량을 확인하세요.',model_unavailable:'선택한 모델을 현재 계정에서 사용할 수 없습니다.',invalid_request:'이 계정 또는 모델이 PDF·이미지 요청을 지원하지 않거나 요청이 거절되었습니다.',storage_encryption_unavailable:'Windows 보안 저장소를 사용할 수 없습니다.'};return (messages[code]||'ChatGPT 연결 또는 처리에 실패했습니다. 로그인·구독 권한과 사용 한도를 확인하세요.')+' ('+code+')';}
function createLocalServer(client){
 const token=randomBytes(32).toString('hex'),launch=randomBytes(32).toString('hex');let bootUsed=false,active=false,minute=0,count=0;
 let origin;
 const server=http.createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin'};
  function send(status,data){if(res.destroyed)return;res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  if(req.headers.host!==new URL(origin).host || req.headers.origin && req.headers.origin!==origin || req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'로컬 앱에서만 접근할 수 있습니다.'});
  const url=new URL(req.url,origin);
  if(req.method==='GET'&&url.pathname==='/open/'+launch&&!bootUsed){bootUsed=true;res.writeHead(302,{...headers,'Set-Cookie':'scan_session='+token+'; HttpOnly; SameSite=Strict; Path=/','Location':'/scan.html'});return res.end();}
  const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('scan_session='))?.slice(13)||'';
  const a=Buffer.from(value),b=Buffer.from(token);
  if(a.length!==b.length||!timingSafeEqual(a,b))return send(401,{error:'시작 프로그램이 연 화면에서 사용하세요.'});
  if(url.pathname.startsWith('/api/chatgpt/')){
   if(req.method==='POST'&&req.headers.origin!==origin)return send(403,{error:'요청 출처가 올바르지 않습니다.'});
   const route=url.pathname;
   if(req.method==='GET'&&route==='/api/chatgpt/session'){try{return send(200,safeSession(await client.getSession()));}catch(e){return send(500,{error:errorMessage(e)});}}
   if(!['POST','GET'].includes(req.method))return send(405,{error:'지원하지 않는 요청입니다.'});
   if(req.method==='POST'&&route==='/api/chatgpt/cancel'){client.cancelSignIn();return send(200,{ok:true});}
   if(active)return send(409,{error:'현재 작업을 마친 뒤 다시 시도하세요.'});
   active=true;
   const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   try{
    if(req.method==='POST'&&route==='/api/chatgpt/sign-in'){await client.signIn({signal:controller.signal,reconsent:true});return send(200,safeSession(await client.getSession()));}
    if(req.method==='POST'&&route==='/api/chatgpt/sign-out'){await client.disconnect();return send(200,safeSession(await client.getSession()));}
    if(req.method==='GET'&&route==='/api/chatgpt/models'){const s=await client.getSession();if(!s.sharing)return send(403,{error:'구독 사용 권한을 승인한 뒤 모델을 불러오세요.'});return send(200,{models:await client.listModels({signal:controller.signal})});}
    if(req.method==='POST'&&route==='/api/chatgpt/scan'){
     const current=Math.floor(Date.now()/60000);if(current!==minute){minute=current;count=0;}if(++count>5)return send(429,{error:'분당 5회까지 처리합니다. 잠시 후 다시 시도하세요.'});
     if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'JSON 요청이 필요합니다.'});
     let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>14*1024*1024)return send(413,{error:'파일당 최대 10MB입니다.'});chunks.push(chunk);}
     let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'잘못된 요청입니다.'});}
     if(body.consent!==true)return send(403,{error:'문서 전송에 동의해 주세요.'});
     if(!(await client.getSession()).sharing)return send(403,{error:'ChatGPT 로그인 및 구독 사용 권한 승인이 필요합니다.'});
     const models=await client.listModels({signal:controller.signal});if(!models.some(m=>m.slug===body.model))return send(400,{error:'현재 계정에서 선택한 모델을 사용할 수 없습니다. 모델 목록을 새로 확인하세요.'});
     const request=API.buildRequest(body.file,body.form);
     const result=await client.streamResponse({model:body.model,input:'',instructions:request.instructions,request:{input:request.input,text:request.text},signal:controller.signal});
     return send(200,API.convert(completedScanResponse(result)));
    }
    return send(404,{error:'지원하지 않는 경로입니다.'});
   }catch(e){return send(e instanceof API.ScanError?e.status:502,{error:e instanceof API.ScanError?e.message:errorMessage(e)});}finally{active=false;}
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'지원하지 않는 요청입니다.'});
  try{const pathname=decodeURIComponent(url.pathname);const target=path.resolve(root,'.'+(pathname==='/'?'/scan.html':pathname));if(!target.startsWith(root+path.sep))return send(404,{error:'파일이 없습니다.'});const content=await fs.readFile(target);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{...headers,'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:content);}catch{send(404,{error:'파일이 없습니다.'});}
 });
 server.requestTimeout=650000;server.headersTimeout=15000;
 return {server,async start(){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;return origin+'/open/'+launch;}};
}
async function main(){
 if(process.platform!=='win32')throw new Error('이 실행기는 Windows를 지원합니다.');
 const {createChatGPT}=await import('@siwc/local');
 const client=createChatGPT({appName:'Equipment Downtime Report',appId:'equipment-downtime-report',redirectPort:0,sendHostId:true,storageDir:path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'EquipmentDowntimeReport','chatgpt'),credentialEncryption:encryption(),openBrowser});
 const local=createLocalServer(client);const url=await local.start();console.log('ChatGPT login app running. Keep this window open; Ctrl+C stops it.');await openBrowser(url);
}
if(require.main===module)main().catch(()=>{console.error('로컬 앱 시작 실패. Node.js 설치와 npm install / npm run build:login 실행 상태를 확인하세요.');process.exitCode=1;});
module.exports={createLocalServer,safeSession,errorMessage,completedScanResponse};
