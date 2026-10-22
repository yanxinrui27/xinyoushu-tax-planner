import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUTH_KEY,SESSION_KEY,accountInfo,hasActiveSession,registerAccount,loginAccount,changePassword,logout} from './dist/auth.mjs';
import {authPage} from './dist/auth-ui.mjs';
import {blank,migrate,validate} from './dist/engine.mjs';
import {page} from './dist/ui.mjs';
import {PUBLIC_DEMO_USERNAME,PUBLIC_DEMO_PASSWORD,profileStorage} from './dist/profile.mjs';
import {readState,writeState} from './dist/storage.mjs';

class MemoryStorage{
  #values=new Map();
  getItem(key){return this.#values.has(key)?this.#values.get(key):null;}
  setItem(key,value){this.#values.set(key,String(value));}
  removeItem(key){this.#values.delete(key);}
}

let passed=0;
async function test(name,fn){
  try{await fn();passed+=1;console.log('✓',name);}
  catch(error){console.error('✗',name);throw error;}
}

const storage=new MemoryStorage(),session=new MemoryStorage();
const firstPassword='First-pass-2026',secondPassword='Second-pass-2026';

await test('registers a local account without storing the plaintext password',async()=>{
  await registerAccount(storage,session,{username:'Sienna_27',password:firstPassword,confirmPassword:firstPassword});
  assert.equal(accountInfo(storage,session).username,'Sienna_27');
  assert.equal(hasActiveSession(storage,session),true);
  assert.equal(storage.getItem(AUTH_KEY).includes(firstPassword),false);
  const saved=JSON.parse(storage.getItem(AUTH_KEY));
  assert.equal(saved.accounts.Sienna_27.iterations,210000);
  assert.ok(saved.accounts.Sienna_27.salt.length>10&&saved.accounts.Sienna_27.verifier.length>20);
});

await test('supports multiple independent local accounts',async()=>{
  await registerAccount(storage,session,{username:'other',password:firstPassword,confirmPassword:firstPassword});
  assert.equal(accountInfo(storage,session).username,'other');
  await assert.rejects(()=>registerAccount(storage,session,{username:'other',password:firstPassword,confirmPassword:firstPassword}),/同名账号/);
  logout(session);await loginAccount(storage,session,{username:'Sienna_27',password:firstPassword});
  assert.equal(accountInfo(storage,session).username,'Sienna_27');
});

await test('requires the correct username and password',async()=>{
  logout(session);
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:'Wrong-pass-2026'}),/用户名或密码错误/);
  assert.equal(hasActiveSession(storage,session),false);
  await loginAccount(storage,session,{username:'Sienna_27',password:firstPassword});
  assert.equal(hasActiveSession(storage,session),true);
});

await test('temporarily locks repeated failed attempts',async()=>{
  logout(session);
  const saved=JSON.parse(storage.getItem(AUTH_KEY));saved.accounts.Sienna_27.failedAttempts=4;storage.setItem(AUTH_KEY,JSON.stringify(saved));
  const now=100000;
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:'Wrong-pass-2026'},now),/用户名或密码错误/);
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:firstPassword},now+1),/30秒后重试/);
  await loginAccount(storage,session,{username:'Sienna_27',password:firstPassword},now+30001);
  assert.equal(hasActiveSession(storage,session),true);
});

await test('changes the password only after verifying the current password',async()=>{
  await assert.rejects(()=>changePassword(storage,{username:'Sienna_27',currentPassword:'Wrong-pass-2026',newPassword:secondPassword,confirmPassword:secondPassword}),/当前密码不正确/);
  await changePassword(storage,{username:'Sienna_27',currentPassword:firstPassword,newPassword:secondPassword,confirmPassword:secondPassword});
  logout(session);
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:firstPassword}),/用户名或密码错误/);
  await loginAccount(storage,session,{username:'Sienna_27',password:secondPassword});
  assert.equal(hasActiveSession(storage,session),true);
  assert.equal(storage.getItem(AUTH_KEY).includes(secondPassword),false);
});

await test('logout removes only the session marker',()=>{
  logout(session);
  assert.equal(session.getItem(SESSION_KEY),null);
  assert.equal(accountInfo(storage).username,'Sienna_27');
});

await test('auth screens explain the local-only security boundary',()=>{
  const registration=authPage('register'),login=authPage('login','测试提示','Sienna_27'),demoLogin=authPage('login');
  assert.match(registration,/创建你的访问账号/);
  assert.match(registration,/不支持跨设备同步/);
  assert.match(registration,/空白数据/);
  assert.match(login,/id="loginForm"/);
  assert.match(login,/测试提示/);
  assert.match(login,/value="Sienna_27"/);
  assert.match(demoLogin,new RegExp(`value="${PUBLIC_DEMO_USERNAME}"`));
  assert.match(demoLogin,new RegExp(`value="${PUBLIC_DEMO_PASSWORD}"`));
  assert.match(demoLogin,/创建自己的空白账号/);
});

await test('keeps each account data in its own profile namespace',()=>{
  const own=profileStorage(storage,'Sienna_27'),other=profileStorage(storage,'other'),sample=blank(2026);
  sample.scope=true;writeState(own,sample);
  assert.equal(readState(own).scope,true);
  assert.equal(readState(other),null);
});

await test('ships a complete fictional case for the public demo account',()=>{
  const backup=JSON.parse(readFileSync(new URL('./dist/demo/default-case.json',import.meta.url),'utf8'));
  const sample=migrate(backup.data);validate(sample);
  assert.equal(sample.scope,true);
  assert(sample.months.some(month=>month.status!=='missing'));
  assert(sample.deductions.length>0);
});

await test('signed-in workspace shows account, logout, and password controls',()=>{
  const html=page(blank(2026),'settings',null,1,'Sienna_27');
  assert.match(html,/Sienna_27/);
  assert.match(html,/data-action="logout"/);
  assert.match(html,/id="changePasswordForm"/);
  assert.match(html,/本机访问锁/);
});

console.log(`\n${passed} auth tests passed`);
