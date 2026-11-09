/* Account-scoped, durable workspace outbox with compare-and-swap writes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DowntimeSync=factory();})(typeof self!=='undefined'?self:this,function(){
'use strict';
const MAX=4*1024*1024;
const settingKeys=['start','dayEnd','nightEnd','breakMin','rests','basis','target','separateRest','codes','weldCodes','equipGroups'];
function snapshot(value){
 if(!value || !Array.isArray(value.files) || !value.settings || typeof value.settings!=='object' || Array.isArray(value.settings))throw new Error('동기화 데이터 형식이 올바르지 않습니다.');
 const files=value.files.map(f=>{if(typeof f.id!=='string'||typeof f.name!=='string'||!Array.isArray(f.sheets))throw new Error('파일 정보가 올바르지 않습니다.');return {id:f.id,name:f.name,sheets:f.sheets.map(s=>{if(typeof s.name!=='string'||typeof s.type!=='string'||!Array.isArray(s.aoa))throw new Error('시트 정보가 올바르지 않습니다.');return {name:s.name,type:s.type,aoa:s.aoa.map(row=>{if(!Array.isArray(row))throw new Error('행 정보가 올바르지 않습니다.');return row.map(cell=>{if(cell==null)return null;if(!['string','number','boolean'].includes(typeof cell)||typeof cell==='number'&&!Number.isFinite(cell))throw new Error('셀 값이 올바르지 않습니다.');return cell;});})};})};});
 const settings={};for(const k of settingKeys)if(Object.hasOwn(value.settings,k))settings[k]=JSON.parse(JSON.stringify(value.settings[k]));
 const result={version:1,files,settings};if(new TextEncoder().encode(JSON.stringify(result)).length>MAX)throw new Error('동기화 데이터가 4MB를 넘습니다. 파일을 나누거나 이전 자료를 내려받아 보관하세요.');return result;
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
class Store{
 constructor({storage,remote,apply,status}){Object.assign(this,{storage,remote,apply,status});this.user=null;this.revision=0;this.dirty=false;this.payload=null;this.conflict=null;this.busy=false;this.epoch=0;this.changeId=0;}
 key(){return 'equipment.sync.v1:'+this.user;}
 persist(){this.storage.setItem(this.key(),JSON.stringify({revision:this.revision,dirty:this.dirty,needsChoice:!!this.conflict,payload:this.payload}));}
 state(kind,message){this.status?.({kind,message,dirty:this.dirty,revision:this.revision,conflict:!!this.conflict});}
 current(){return this.payload?structuredClone(this.payload):null;}
 async connect(user,local){
  const epoch=++this.epoch;this.user=user;this.busy=false;this.conflict=null;this.changeId=0;
  let saved;try{saved=JSON.parse(this.storage.getItem(this.key())||'null');}catch{saved=null;}
  this.payload=saved?snapshot(saved.payload):snapshot(local);this.revision=saved?.revision||0;this.dirty=!!saved?.dirty;
  const localValue=snapshot(local);const localExtras=!!saved&&(localValue.files.some(f=>!this.payload.files.some(old=>old.id===f.id&&same(old,f))) || Object.keys(localValue.settings).length>0&&!same(localValue.settings,this.payload.settings));
  if(localExtras){const merged=new Map(this.payload.files.map(f=>[f.id,f]));localValue.files.forEach(f=>merged.set(f.id,f));this.payload=snapshot({files:[...merged.values()],settings:Object.keys(localValue.settings).length?localValue.settings:this.payload.settings});this.dirty=true;}
  try{const cloud=await this.remote.read(user);if(epoch!==this.epoch)return;
   if(saved?.needsChoice||localExtras){this.conflict=cloud||{revision:0,payload:{version:1,files:[],settings:{}}};this.persist();this.state('conflict','미해결 자료 선택이 있습니다. 사용할 자료를 선택하세요.');return;}
   if(this.dirty){if((cloud?.revision||0)!==this.revision){this.conflict=cloud||{revision:0,payload:{version:1,files:[],settings:{}}};this.persist();this.state('conflict','다른 PC의 변경과 이 PC의 미저장 자료가 충돌합니다. 사용할 자료를 선택하세요.');return;}this.apply(this.current());await this.flush();return;}
   if(!saved&&(local.files.length||Object.keys(local.settings).length)){this.conflict=cloud||{revision:0,payload:{version:1,files:[],settings:{}}};this.dirty=true;this.persist();this.state('conflict','처음 연결한 계정입니다. 이 PC 자료를 올릴지 클라우드 자료를 사용할지 선택하세요.');return;}
   if(cloud){this.revision=cloud.revision;this.payload=snapshot(cloud.payload);this.persist();this.apply(this.current());this.state('synced','동기화 완료');}
   else{this.dirty=true;this.persist();this.apply(this.current());await this.flush();}
  }catch{if(epoch===this.epoch){if(!saved)this.dirty=true;this.persist();this.state('offline','연결 실패. 이 PC에 보관하며 연결 후 다시 동기화합니다.');}}
 }
 change(value){if(!this.user)return;const next=snapshot(value);if(same(next,this.payload))return;this.payload=next;this.dirty=true;this.changeId++;this.persist();this.state(this.conflict?'conflict':'pending',this.conflict?'충돌 해결 전까지 이 PC의 변경을 보관합니다.':'이 PC에 저장됨 · 동기화 대기');}
 async flush(){
  if(!this.user||this.busy||!this.dirty||this.conflict)return;
  const user=this.user,epoch=this.epoch,id=this.changeId,payload=this.current();this.busy=true;this.state('saving','동기화 중…');
  try{const result=await this.remote.write(this.revision,payload);if(epoch!==this.epoch||user!==this.user)return;
   if(!result.ok){this.conflict=result;this.persist();this.state('conflict','다른 PC에서 먼저 변경했습니다. 두 자료를 확인하고 선택하세요.');return;}
   this.revision=result.revision;if(id===this.changeId)this.dirty=false;this.persist();this.state(this.dirty?'pending':'synced',this.dirty?'새 변경 동기화 대기':'동기화 완료');
  }catch{if(epoch===this.epoch)this.state('offline','동기화 실패. 변경은 이 PC에 보관되어 있습니다.');}
  finally{if(epoch===this.epoch)this.busy=false;}
 }
 async poll(){if(!this.user||this.busy||this.conflict)return;if(this.dirty)return this.flush();const epoch=this.epoch,id=this.changeId;this.busy=true;try{const cloud=await this.remote.read(this.user,this.revision);if(epoch!==this.epoch)return;if(cloud&&cloud.revision!==this.revision){if(this.dirty||id!==this.changeId){this.conflict=cloud;this.persist();this.state('conflict','다른 PC 변경과 충돌합니다. 사용할 자료를 선택하세요.');return;}this.revision=cloud.revision;this.payload=snapshot(cloud.payload);this.persist();this.apply(this.current());this.state('synced','다른 PC의 변경을 불러왔습니다.');}}catch{if(epoch===this.epoch)this.state('offline','연결을 확인하세요. 이 PC의 자료는 유지됩니다.');}finally{if(epoch===this.epoch)this.busy=false;}}
 async resolve(choice){if(!this.conflict||this.busy)return;const conflict=this.conflict;if(choice==='cloud'){if(!conflict.payload)throw new Error('클라우드 자료가 없습니다.');this.payload=snapshot(conflict.payload);this.revision=conflict.revision;this.dirty=false;this.conflict=null;this.persist();this.apply(this.current());this.state('synced','클라우드 자료를 사용합니다.');}else if(choice==='local'){this.revision=conflict.revision;this.conflict=null;this.dirty=true;this.persist();await this.flush();}else throw new Error('자료를 선택하세요.');}
 disconnect(){this.epoch++;this.user=null;this.busy=false;this.payload=null;this.conflict=null;this.dirty=false;this.state('signedout','동기화 로그아웃됨 · 화면의 자료는 이 PC에 남습니다.');}
}
return {Store,snapshot,same};
});
