'use strict';
const {spawn}=require('node:child_process');
function transform(data,decrypt=false){return new Promise((resolve,reject)=>{
 const action=decrypt?'Unprotect':'Protect';
 const script="$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::"+action+"($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))";
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',size=0,done=false;
 const timeout=setTimeout(()=>{child.kill();finish(new Error('Windows secure storage timed out'));},15000);
 function finish(err){if(done)return;done=true;clearTimeout(timeout);if(err)reject(err);else resolve(Buffer.from(out,'base64'));}
 child.on('error',()=>finish(new Error('Windows secure storage unavailable')));
 child.stdout.on('data',b=>{size+=b.length;if(size>4*1024*1024){child.kill();finish(new Error('Secure storage response too large'));}else out+=b;});child.stderr.resume();
 child.on('close',code=>finish(code===0?null:new Error('Windows secure storage unavailable')));child.stdin.on('error',()=>{});child.stdin.end(Buffer.from(data).toString('base64'));
});}
function encryption(){return {id:'windows-dpapi-v1',isAvailable:async()=>{if(process.platform!=='win32')return false;try{await transform(Buffer.from('equipment-downtime-storage-check'));return true;}catch{return false;}},encrypt:async value=>transform(Buffer.from(value,'utf8')),decrypt:async value=>(await transform(value,true)).toString('utf8')};}
function openBrowser(value){const url=new URL(value);if(url.origin!=='https://auth.openai.com' && !(url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new Error('Unexpected browser destination');return new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','Start-Process -FilePath $env:SCAN_OPEN_URL -WindowStyle Normal'],{windowsHide:true,env:{...process.env,SCAN_OPEN_URL:url.href},stdio:'ignore'});p.on('error',()=>reject(new Error('Could not open browser')));p.on('exit',c=>c===0?resolve():reject(new Error('Could not open browser')));});}
module.exports={encryption,openBrowser};
