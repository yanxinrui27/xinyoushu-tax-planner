import assert from 'node:assert/strict';
import {blank,migrate,validate} from './dist/engine.mjs';
import {deduction} from './dist/deductions.mjs';
import {blankFinder,findPolicyMatches,normalizeFinder,validateFinder} from './dist/policy-finder.mjs';
import {page} from './dist/ui.mjs';

let passed=0;
function test(name,fn){try{fn();console.log('PASS',name);passed++;}catch(error){console.error('FAIL',name);throw error;}}
function result(change={},ledger=[]){const f=blankFinder();Object.assign(f.answers,change);return findPolicyMatches(f,ledger).matches;}
function one(list,id){return list.find(x=>x.policyId===id);}

test('blank finder is valid and part of new annual state',()=>{
  const s=blank(2026);assert.equal(validateFinder(s.finder),s.finder);assert.equal(validate(s),s);
});

test('baby recommendation uses current 2000 monthly standard and share',()=>{
  const matches=result({baby:'yes',babyCount:1,babyStart:3,babyEnd:12,babyShare:100});
  const baby=one(matches,'baby');assert.equal(baby.status,'likely');assert.equal(baby.estimatedDeductionCents,2000000);assert.equal(baby.ledgerDraft.amount,200000);
});

test('each child becomes a separate auditable ledger draft',()=>{
  const children=result({child:'yes',childCount:2,childStart:1,childEnd:12,childShare:50}).filter(x=>x.policyId==='child');
  assert.equal(children.length,2);assert.deepEqual(children.map(x=>x.ledgerDraft.person),['子女1','子女2']);assert.equal(children[0].estimatedDeductionCents,1200000);
});

test('non-only child elder recommendation respects personal 1500 cap',()=>{
  const elder=one(result({elder:'yes',sole:'no',elderShare:150000}),'elder');assert.equal(elder.status,'likely');assert.equal(elder.estimatedDeductionCents,1800000);
  const invalid=blankFinder();invalid.answers.elderShare=150001;assert.throws(()=>validateFinder(invalid),/额度无效/);
});

test('rent and mortgage require an explicit mutually exclusive choice',()=>{
  let matches=result({rent:'yes',cityHousing:'no',loan:'yes'});assert.equal(one(matches,'rent').status,'conflict');assert.equal(one(matches,'loan').status,'conflict');
  matches=result({rent:'yes',cityHousing:'no',loan:'yes',housingChoice:'rent'});assert.equal(one(matches,'rent').status,'likely');assert.equal(one(matches,'loan').status,'conflict');
});

test('mortgage stops after 240 months',()=>{
  const loan=one(result({loan:'yes',loanUsedMonths:240}),'loan');assert.equal(loan.status,'not_matched');assert.equal(loan.ledgerDraft,null);assert.equal(loan.estimatedDeductionCents,0);
});

test('degree education is shortened to the remaining 48 month allowance',()=>{
  const education=one(result({degree:'yes',degreeUsedMonths:47,degreeStart:1,degreeEnd:12}),'education');
  assert.equal(education.status,'likely');assert.equal(education.ledgerDraft.start,1);assert.equal(education.ledgerDraft.end,1);assert.equal(education.estimatedDeductionCents,40000);
});

test('medical threshold is exclusive and annual deduction is capped',()=>{
  assert.equal(one(result({medical:'yes',medicalSelfPay:1500000}),'medical').status,'not_matched');
  assert.equal(one(result({medical:'yes',medicalSelfPay:1500001}),'medical').estimatedDeductionCents,1);
  assert.equal(one(result({medical:'yes',medicalSelfPay:20000000}),'medical').estimatedDeductionCents,8000000);
});

test('existing ledger record changes a recommendation into a conflict',()=>{
  const ledger=[deduction({id:'existing-rent',type:'rent',person:'本人住房租金',amount:150000,start:1,end:12,usage:'baseline',timing:'withholding',confirmed:true})];
  const rent=one(result({rent:'yes',cityHousing:'no'},ledger),'rent');assert.equal(rent.status,'conflict');assert.equal(rent.existingId,'existing-rent');
});

test('same-version old backup gains finder defaults without losing data',()=>{
  const old=blank(2026);delete old.finder;old.quick.source='manual';const restored=migrate(old);
  assert.deepEqual(restored.finder,normalizeFinder());assert.equal(restored.quick.source,'manual');
});

test('finder page exposes the guided flow and policy-safe wording',()=>{
  const html=page(blank(2026),'finder');assert.match(html,/让政策主动找到你/);assert.match(html,/子女与照护/);assert.match(html,/可能遗漏/);assert.match(html,/不填写姓名、证件号或病历/);
});

console.log(`${passed} policy finder tests passed`);
