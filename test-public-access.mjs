import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blank} from './dist/engine.mjs';
import {page} from './dist/ui.mjs';

let passed=0;
function test(name,fn){
  try{fn();passed+=1;console.log('PASS',name);}
  catch(error){console.error('FAIL',name);throw error;}
}

test('public page opens directly on the workspace',()=>{
  const html=page(blank(2026),'overview');
  assert.match(html,/科学筹划，薪中有数/);
  assert.doesNotMatch(html,/注册|登录|密码|退出当前账号/);
});

test('application entry has no account or GPT sign-in gate',()=>{
  const source=readFileSync(new URL('./dist/app.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/auth\.mjs|auth-ui\.mjs|registerAccount|loginAccount|hasActiveSession/);
  assert.match(source,/state=initialState\(localStorage\)/);
  assert.match(source,/render\(\);if\(loadError\)/);
});

console.log(`${passed} public access tests passed`);
