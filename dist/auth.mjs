export const AUTH_KEY='xinyoushu-local-accounts-v2';
export const LEGACY_AUTH_KEY='xinyoushu-local-account-v1';
export const LEGACY_OWNER_KEY='xinyoushu-profile-migration-owner-v1';
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
function validAccount(a){return Boolean(a&&a.version===1&&validUsername(a.username)&&typeof a.salt==='string'&&typeof a.verifier==='string'&&Number.isInteger(a.iterations)&&a.iterations>=100000&&typeof a.createdAt==='string'&&Number.isInteger(a.failedAttempts)&&typeof a.lockedUntil==='number');}
function parseDirectory(storage){
  const raw=storage.getItem(AUTH_KEY);
  if(raw){
    let directory;try{directory=JSON.parse(raw);}catch{throw Error('本机账号记录损坏，请先保留现有浏览器数据再处理');}
    if(!directory||directory.version!==2||!directory.accounts||typeof directory.accounts!=='object')throw Error('本机账号记录格式无效');
    for(const account of Object.values(directory.accounts))if(!validAccount(account))throw Error('本机账号记录格式无效');
    return directory;
  }
  const legacyRaw=storage.getItem(LEGACY_AUTH_KEY);
  if(!legacyRaw)return {version:2,lastUsername:'',accounts:{}};
  let legacy;try{legacy=JSON.parse(legacyRaw);}catch{throw Error('旧版本机账号记录损坏，请先保留现有浏览器数据再处理');}
  if(!validAccount(legacy))throw Error('旧版本机账号记录格式无效');
  const directory={version:2,lastUsername:legacy.username,accounts:{[legacy.username]:legacy}};
  if(!storage.getItem(LEGACY_OWNER_KEY))storage.setItem(LEGACY_OWNER_KEY,legacy.username);
  storage.setItem(AUTH_KEY,JSON.stringify(directory));return directory;
}
function saveDirectory(storage,directory){storage.setItem(AUTH_KEY,JSON.stringify(directory));}
export function accountInfo(storage,session){const directory=parseDirectory(storage),username=session?.getItem(SESSION_KEY)||directory.lastUsername,account=directory.accounts[username];return account?{username:account.username,createdAt:account.createdAt}:null;}
export function hasAccount(storage,username){return Boolean(parseDirectory(storage).accounts[username]);}
export function hasActiveSession(storage,session){const directory=parseDirectory(storage),username=session.getItem(SESSION_KEY);return Boolean(username&&directory.accounts[username]);}
export function logout(session){session.removeItem(SESSION_KEY);}

export async function registerAccount(storage,session,{username,password,confirmPassword},{activate=true}={}){
  const directory=parseDirectory(storage);
  username=String(username??'').trim();
  if(!validUsername(username))throw Error('用户名需为2至20位中文、字母、数字、下划线或短横线');
  if(!validPassword(password))throw Error('密码需为8至128个字符');
  if(password!==confirmPassword)throw Error('两次输入的密码不一致');
  if(directory.accounts[username])throw Error('当前浏览器已存在同名账号，请直接登录');
  const salt=randomBytes(16),hash=await verifier(password,salt);
  const account={version:1,username,salt:bytesToBase64(salt),verifier:bytesToBase64(hash),iterations:PASSWORD_ITERATIONS,createdAt:new Date().toISOString(),failedAttempts:0,lockedUntil:0};
  directory.accounts[username]=account;if(activate)directory.lastUsername=username;saveDirectory(storage,directory);if(activate)session.setItem(SESSION_KEY,username);return {username};
}

export async function loginAccount(storage,session,{username,password},now=Date.now()){
  const directory=parseDirectory(storage);
  username=String(username??'').trim();
  const account=directory.accounts[username];if(!account)throw Error('未找到该本机账号，请先创建账号');
  if(account.lockedUntil>now)throw Error(`连续输入错误，请在${Math.ceil((account.lockedUntil-now)/1000)}秒后重试`);
  const provided=validPassword(password)?await verifier(password,base64ToBytes(account.salt),account.iterations):new Uint8Array(32);
  const ok=username===account.username&&equalBytes(provided,base64ToBytes(account.verifier));
  if(!ok){
    account.failedAttempts+=1;
    if(account.failedAttempts>=5){account.failedAttempts=0;account.lockedUntil=now+30000;}
    saveDirectory(storage,directory);throw Error('用户名或密码错误');
  }
  account.failedAttempts=0;account.lockedUntil=0;directory.lastUsername=account.username;saveDirectory(storage,directory);session.setItem(SESSION_KEY,account.username);return {username:account.username};
}

export async function changePassword(storage,{username,currentPassword,newPassword,confirmPassword}){
  const directory=parseDirectory(storage),account=directory.accounts[username];if(!account)throw Error('当前浏览器尚未注册该本机账号');
  if(!validPassword(newPassword))throw Error('新密码需为8至128个字符');
  if(newPassword!==confirmPassword)throw Error('两次输入的新密码不一致');
  const current=validPassword(currentPassword)?await verifier(currentPassword,base64ToBytes(account.salt),account.iterations):new Uint8Array(32);
  if(!equalBytes(current,base64ToBytes(account.verifier)))throw Error('当前密码不正确');
  const salt=randomBytes(16),hash=await verifier(newPassword,salt);
  account.salt=bytesToBase64(salt);account.verifier=bytesToBase64(hash);account.iterations=PASSWORD_ITERATIONS;account.passwordChangedAt=new Date().toISOString();account.failedAttempts=0;account.lockedUntil=0;saveDirectory(storage,directory);return {username:account.username};
}
