import assert from 'node:assert/strict';
import {blank,month} from './dist/engine.mjs';
import {KEY,readState,writeState} from './dist/storage.mjs';

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function storage(seed={},failAt=Infinity){
  const values=new Map(Object.entries(seed));let writes=0;
  return {
    getItem:k=>values.has(k)?values.get(k):null,
    setItem(k,v){writes++;if(writes===failAt){const error=Error('full');error.name='QuotaExceededError';throw error;}values.set(k,v);},
    removeItem:k=>values.delete(k),
    dump:()=>Object.fromEntries(values)
  };
}

test('successful save updates year and last-used records',()=>{
  const s=blank();const mem=storage();writeState(mem,s);
  assert.deepEqual(JSON.parse(mem.dump()[`${KEY}-2026`]),s);
  assert.deepEqual(JSON.parse(mem.dump()[KEY]),s);
});

test('failure on last-used write rolls back the year record',()=>{
  const old=blank();old.months[0]=month({status:'forecast',salary:100000});
  const prior=JSON.stringify(old),mem=storage({[`${KEY}-2026`]:prior,[KEY]:prior},2);
  const next=structuredClone(old);next.months[0].salary=200000;
  assert.throws(()=>writeState(mem,next),/本机保存失败/);
  assert.equal(mem.dump()[`${KEY}-2026`],prior);
  assert.equal(mem.dump()[KEY],prior);
});

test('failure on first write does not change either record',()=>{
  const old=blank(),prior=JSON.stringify(old),mem=storage({[`${KEY}-2026`]:prior,[KEY]:prior},1);
  assert.throws(()=>writeState(mem,blank()),/本机保存失败/);
  assert.equal(mem.dump()[`${KEY}-2026`],prior);
  assert.equal(mem.dump()[KEY],prior);
});

test('v1 read keeps a byte-for-byte migration snapshot once',()=>{
  const old={version:1,year:2026,selected:0,demo:false,scope:false,bonus:0,bonusMonth:12,bonusEligible:false,pensionPlan:0,extraDeduct:0,deductConfirmed:false,goal:'cash',months:Array.from({length:12},()=>({...month({status:'forecast'}),special:0}))};
  const raw=JSON.stringify(old),snapshot=`${KEY}-before-v2-2026`,mem=storage({[KEY]:raw});
  const migrated=readState(mem);assert.equal(migrated.version,3);assert.equal(mem.dump()[snapshot],raw);
  mem.setItem(KEY,raw);readState(mem);assert.equal(mem.dump()[snapshot],raw);
});

test('v2 read keeps a byte-for-byte snapshot before v3 classification',()=>{
  const old=blank();old.version=2;delete old.quick.lawfulDeductions;
  old.months=old.months.map(m=>{const copy={...m};for(const k of ['socialBase','fundBase','fundEnabled','pensionRate','medicalRate','unemploymentRate','maternityRate','injuryRate','fundRate','lawfulDeductions'])delete copy[k];return copy;});
  const raw=JSON.stringify(old),snapshot=`${KEY}-before-v3-2026`,mem=storage({[KEY]:raw});
  const migrated=readState(mem);assert.equal(migrated.version,3);assert.equal(mem.dump()[snapshot],raw);
});

test('year lookup rejects a mismatched record',()=>{
  const mem=storage({[`${KEY}-2027`]:JSON.stringify(blank(2026))});
  assert.throws(()=>readState(mem,2027),/年度记录/);
});

console.log(`${passed} storage tests passed`);
