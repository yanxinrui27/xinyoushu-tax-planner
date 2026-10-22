import assert from 'node:assert/strict';
import {AUTH_KEY,SESSION_KEY,accountInfo,hasActiveSession,registerAccount,loginAccount,changePassword,logout} from './dist/auth.mjs';
import {authPage} from './dist/auth-ui.mjs';
import {blank} from './dist/engine.mjs';
import {page} from './dist/ui.mjs';

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
  assert.equal(accountInfo(storage).username,'Sienna_27');
  assert.equal(hasActiveSession(storage,session),true);
  assert.equal(storage.getItem(AUTH_KEY).includes(firstPassword),false);
  const saved=JSON.parse(storage.getItem(AUTH_KEY));
  assert.equal(saved.iterations,210000);
  assert.ok(saved.salt.length>10&&saved.verifier.length>20);
});

await test('prevents a second account from replacing the registered account',async()=>{
  await assert.rejects(()=>registerAccount(storage,session,{username:'other',password:firstPassword,confirmPassword:firstPassword}),/已经注册/);
  assert.equal(accountInfo(storage).username,'Sienna_27');
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
  const saved=JSON.parse(storage.getItem(AUTH_KEY));saved.failedAttempts=4;storage.setItem(AUTH_KEY,JSON.stringify(saved));
  const now=100000;
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:'Wrong-pass-2026'},now),/用户名或密码错误/);
  await assert.rejects(()=>loginAccount(storage,session,{username:'Sienna_27',password:firstPassword},now+1),/30秒后重试/);
  await loginAccount(storage,session,{username:'Sienna_27',password:firstPassword},now+30001);
  assert.equal(hasActiveSession(storage,session),true);
});

await test('changes the password only after verifying the current password',async()=>{
  await assert.rejects(()=>changePassword(storage,{currentPassword:'Wrong-pass-2026',newPassword:secondPassword,confirmPassword:secondPassword}),/当前密码不正确/);
  await changePassword(storage,{currentPassword:firstPassword,newPassword:secondPassword,confirmPassword:secondPassword});
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
  const registration=authPage('register'),login=authPage('login','测试提示','Sienna_27');
  assert.match(registration,/创建你的访问账号/);
  assert.match(registration,/不支持跨设备同步/);
  assert.match(registration,/工资数据本身未加密/);
  assert.match(login,/id="loginForm"/);
  assert.match(login,/测试提示/);
  assert.match(login,/value="Sienna_27"/);
});

await test('signed-in workspace shows account, logout, and password controls',()=>{
  const html=page(blank(2026),'settings',null,1,'Sienna_27');
  assert.match(html,/Sienna_27/);
  assert.match(html,/data-action="logout"/);
  assert.match(html,/id="changePasswordForm"/);
  assert.match(html,/不是云端账号/);
});

console.log(`\n${passed} auth tests passed`);
