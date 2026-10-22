export const AUTH_KEY='xinyoushu-local-account-v1';
export const SESSION_KEY='xinyoushu-local-session-v1';
export const PASSWORD_ITERATIONS=210000;
const encoder=new TextEncoder();

function bytesToBase64(bytes){
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value),out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
}
function randomBytes(size){const out=new Uint8Array(size);crypto.getRandomValues(out);return out;}
async function verifier(password,salt,iterations=PASSWORD_ITERATIONS){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,256);
  return new Uint8Array(bits);
}
function equalBytes(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
function validUsername(value){return typeof value==='string'&&/^[\p{L}\p{N}_-]{2,20}$/u.test(value);}
function validPassword(value){return typeof value==='string'&&value.length>=8&&value.length<=128;}
function parseAccount(storage){
  const raw=storage.getItem(AUTH_KEY);if(!raw)return null;
  let a;try{a=JSON.parse(raw);}catch{throw Error('本机账号记录损坏，请先保留现有浏览器数据再处理');}
  if(!a||a.version!==1||!validUsername(a.username)||typeof a.salt!=='string'||typeof a.verifier!=='string'||!Number.isInteger(a.iterations)||a.iterations<100000||typeof a.createdAt!=='string'||!Number.isInteger(a.failedAttempts)||typeof a.lockedUntil!=='number')throw Error('本机账号记录格式无效');
  return a;
}
function save(storage,account){storage.setItem(AUTH_KEY,JSON.stringify(account));}
export function accountInfo(storage){const a=parseAccount(storage);return a?{username:a.username,createdAt:a.createdAt}:null;}
export function hasActiveSession(storage,session){const a=parseAccount(storage);return Boolean(a&&session.getItem(SESSION_KEY)===a.username);}
export function logout(session){session.removeItem(SESSION_KEY);}

export async function registerAccount(storage,session,{username,password,confirmPassword}){
  if(parseAccount(storage))throw Error('当前浏览器已经注册过本机账号');
  username=String(username??'').trim();
  if(!validUsername(username))throw Error('用户名需为2至20位中文、字母、数字、下划线或短横线');
  if(!validPassword(password))throw Error('密码需为8至128个字符');
  if(password!==confirmPassword)throw Error('两次输入的密码不一致');
  const salt=randomBytes(16),hash=await verifier(password,salt);
  const account={version:1,username,salt:bytesToBase64(salt),verifier:bytesToBase64(hash),iterations:PASSWORD_ITERATIONS,createdAt:new Date().toISOString(),failedAttempts:0,lockedUntil:0};
  save(storage,account);session.setItem(SESSION_KEY,username);return {username};
}

export async function loginAccount(storage,session,{username,password},now=Date.now()){
  const account=parseAccount(storage);if(!account)throw Error('当前浏览器尚未注册本机账号');
  username=String(username??'').trim();
  if(account.lockedUntil>now)throw Error(`连续输入错误，请在${Math.ceil((account.lockedUntil-now)/1000)}秒后重试`);
  const provided=validPassword(password)?await verifier(password,base64ToBytes(account.salt),account.iterations):new Uint8Array(32);
  const ok=username===account.username&&equalBytes(provided,base64ToBytes(account.verifier));
  if(!ok){
    account.failedAttempts+=1;
    if(account.failedAttempts>=5){account.failedAttempts=0;account.lockedUntil=now+30000;}
    save(storage,account);throw Error('用户名或密码错误');
  }
  account.failedAttempts=0;account.lockedUntil=0;save(storage,account);session.setItem(SESSION_KEY,account.username);return {username:account.username};
}

export async function changePassword(storage,{currentPassword,newPassword,confirmPassword}){
  const account=parseAccount(storage);if(!account)throw Error('当前浏览器尚未注册本机账号');
  if(!validPassword(newPassword))throw Error('新密码需为8至128个字符');
  if(newPassword!==confirmPassword)throw Error('两次输入的新密码不一致');
  const current=validPassword(currentPassword)?await verifier(currentPassword,base64ToBytes(account.salt),account.iterations):new Uint8Array(32);
  if(!equalBytes(current,base64ToBytes(account.verifier)))throw Error('当前密码不正确');
  const salt=randomBytes(16),hash=await verifier(newPassword,salt);
  account.salt=bytesToBase64(salt);account.verifier=bytesToBase64(hash);account.iterations=PASSWORD_ITERATIONS;account.passwordChangedAt=new Date().toISOString();account.failedAttempts=0;account.lockedUntil=0;save(storage,account);return {username:account.username};
}
