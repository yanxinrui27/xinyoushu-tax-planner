import {deduction,validateDeductions,deductionTotals,deductionTotalsThrough} from './deductions.mjs';
import {blankFinder,normalizeFinder,validateFinder} from './policy-finder.mjs';
export const VERSION='2026.10.22-v5.5';
export const bands=[[3600000,3,0],[14400000,10,252000],[30000000,20,1692000],[42000000,25,3192000],[66000000,30,5292000],[96000000,35,8592000],[Infinity,45,18192000]];
export const cashKeys=['pension','medical','unemployment','socialOther','fund','fundExtra'];
export const numKeys=['salary','bonus','overtime','allowance','reduction',...cashKeys,'otherDeduct','after','reimburse','pensionPay'];
export const quickKeys=['salary','cash','otherDeduct','pensionPay','after','reimburse'];
export const lawfulKeys=['annuity','health','taxDeferredPension','other'];
export const contributionDefaults={pensionRate:800,medicalRate:200,unemploymentRate:50,maternityRate:0,injuryRate:0,fundRate:1200};
export const total=a=>a.reduce((s,x)=>s+x,0);
export const lawfulDeductions=(seed={})=>Object.fromEntries(lawfulKeys.map(k=>[k,seed[k]??0]));
export const lawfulTotal=value=>total(lawfulKeys.map(k=>value?.[k]??0));
export function contributionAmounts(m){
  const socialBase=m.socialBase??m.salary,fundBase=m.fundBase??m.salary,byRate=rate=>Math.round(socialBase*rate/10000);
  return {pension:byRate(m.pensionRate),medical:byRate(m.medicalRate),unemployment:byRate(m.unemploymentRate),socialOther:byRate(m.maternityRate)+byRate(m.injuryRate),fund:m.fundEnabled?Math.round(fundBase*m.fundRate/10000):0};
}
export function tax(raw){const base=Math.max(0,raw),[,rate,quick]=bands.find(b=>base<=b[0]);return {base,rate,quick,amount:Math.max(0,Math.round(base*rate/100)-quick)};}
export function bonusTax(amount){const [,rate,quick]=bands.find(b=>amount<=b[0]);return Math.max(0,Math.round(amount*rate/100)-quick/12);}
export function month(seed={}){
  const lawful=lawfulDeductions(seed.lawfulDeductions);
  return {...Object.fromEntries(numKeys.map(k=>[k,0])),socialBase:null,fundBase:null,fundEnabled:true,...contributionDefaults,lawfulDeductions:lawful,status:'missing',actualTax:null,...seed,lawfulDeductions:lawful};
}
export function defaultThroughMonth(year,now=new Date()){
  return year<now.getFullYear()?12:year>now.getFullYear()?1:now.getMonth()+1;
}
export function blank(year=2026){return {version:3,year,selected:0,demo:false,scope:false,mode:'monthly',currentBonusMode:'combined',bonus:0,bonusMonth:12,bonusEligible:false,pensionPlan:0,goal:'cash',deductions:[],finder:blankFinder(),migrationNotice:false,quick:{...Object.fromEntries(quickKeys.map(k=>[k,0])),lawfulDeductions:lawfulDeductions(),source:'monthly',throughMonth:defaultThroughMonth(year),confirmed:false},months:Array.from({length:12},()=>month())};}
export function demo(){
  const s=blank();
  const make=()=>{const m=month({status:'forecast',salary:2500000,socialBase:2000000,fundBase:2000000});Object.assign(m,contributionAmounts(m));return m;};
  return {...s,selected:9,demo:true,scope:true,bonus:6000000,pensionPlan:1200000,months:Array.from({length:12},make),deductions:[deduction({id:'demo-rent',type:'rent',amount:150000,confirmed:true})]};
}
function amount(x){return Number.isSafeInteger(x)&&x>=0&&x<=10000000000;}
export function validate(s){
  if(!s||s.version!==3||![2026,2027].includes(s.year)||!Array.isArray(s.months)||s.months.length!==12)throw Error('备份格式或年度不受支持');
  if(!Number.isInteger(s.selected)||s.selected<0||s.selected>11||!['cash','tax'].includes(s.goal)||!['monthly','quick'].includes(s.mode)||!['combined','separate'].includes(s.currentBonusMode))throw Error('测算设置无效');
  for(const k of ['demo','scope','bonusEligible','migrationNotice'])if(typeof s[k]!=='boolean')throw Error('确认状态无效');
  for(const m of s.months){
    if(!m)throw Error('月份数据缺失');
    for(const k of numKeys)if(!amount(m[k]))throw Error('金额须为非负有效数，单项不超过一亿元');
    for(const k of Object.keys(contributionDefaults))if(!Number.isSafeInteger(m[k])||m[k]<0||m[k]>10000)throw Error('缴费比例须为0%至100%，最多两位小数');
    if((m.socialBase!==null&&!amount(m.socialBase))||(m.fundBase!==null&&!amount(m.fundBase))||typeof m.fundEnabled!=='boolean')throw Error('社保或公积金缴费设置无效');
    validateLawful(m.lawfulDeductions,20000);if(m.otherDeduct!==lawfulTotal(m.lawfulDeductions))throw Error('其他依法扣除分类合计不一致');
    if(m.reduction>m.salary+m.bonus+m.overtime+m.allowance)throw Error('税前工资扣减超过收入');
    if(!['missing','forecast','actual'].includes(m.status)||(m.actualTax!==null&&!amount(m.actualTax)))throw Error('月份状态或实际个税无效');
  }
  for(const k of ['bonus','pensionPlan'])if(!amount(s[k]))throw Error('方案金额无效');
  if(s.pensionPlan>1200000)throw Error('新增养老金预算不得超过12000元');
  if(!Number.isInteger(s.bonusMonth)||s.bonusMonth<1||s.bonusMonth>12)throw Error('奖金月份无效');
  if(!s.quick||typeof s.quick.confirmed!=='boolean'||!['monthly','manual'].includes(s.quick.source)||!Number.isInteger(s.quick.throughMonth)||s.quick.throughMonth<1||s.quick.throughMonth>12)throw Error('年度精算格式无效');
  for(const k of quickKeys)if(!amount(s.quick[k]))throw Error('年度精算金额无效');
  validateLawful(s.quick.lawfulDeductions,240000);if(s.quick.otherDeduct!==lawfulTotal(s.quick.lawfulDeductions))throw Error('年度依法扣除分类合计不一致');
  if(s.currentBonusMode==='separate'&&!s.bonusEligible)throw Error('基准单独计税需要先确认奖金资格');
  validateDeductions(s.deductions);validateFinder(s.finder);return s;
}
function validateLawful(value,healthCap){
  if(!value||typeof value!=='object')throw Error('其他依法扣除分类缺失');
  for(const k of lawfulKeys)if(!amount(value[k]))throw Error('其他依法扣除金额无效');
  if(value.health>healthCap)throw Error(`符合规定的商业健康保险最多扣除${healthCap/100}元`);
}
export function migrate(raw){
  if(raw?.version===3){
    const s=structuredClone(raw);
    if(s.quick){s.quick.source??=s.quick.confirmed?'manual':'monthly';s.quick.throughMonth??=defaultThroughMonth(s.year);}
    s.finder=normalizeFinder(s.finder);
    return validate(s);
  }
  if(raw?.version===2){
    const s=structuredClone(raw);s.version=3;s.migrationNotice=true;
    s.months=s.months.map(old=>month({...old,lawfulDeductions:lawfulDeductions({other:old.otherDeduct})}));s.finder=blankFinder();
    s.quick={...Object.fromEntries(quickKeys.map(k=>[k,0])),...s.quick,source:s.quick?.confirmed?'manual':'monthly',throughMonth:defaultThroughMonth(s.year),lawfulDeductions:lawfulDeductions({other:s.quick?.otherDeduct??0})};
    return validate(s);
  }
  if(raw?.version!==1||!Array.isArray(raw.months)||raw.months.length!==12)throw Error('备份版本不受支持');
  const s=blank(raw.year);
  for(const k of ['selected','demo','bonus','bonusMonth','bonusEligible','pensionPlan','goal'])s[k]=raw[k];
  s.migrationNotice=true;s.scope=false;
  s.months=raw.months.map(m=>{
    const n=month();for(const k of numKeys)n[k]=m[k];n.actualTax=m.actualTax;n.lawfulDeductions=lawfulDeductions({other:n.otherDeduct});
    n.status=m.status==='actual'?'actual':numKeys.some(k=>m[k]>0)||m.special>0?'forecast':'missing';return n;
  });
  // Preserve old aggregates but require classification instead of inventing eligibility.
  for(let i=0;i<12;i++){
    const v=raw.months[i].special;if(!amount(v))throw Error('旧版扣除数据无效');if(!v)continue;
    const prev=s.deductions.at(-1);
    if(prev&&prev.amount===v&&prev.end===i)prev.end=i+1;
    else s.deductions.push(deduction({id:`legacy-${i}`,type:'legacy',amount:v,start:i+1,end:i+1}));
  }
  if(raw.extraDeduct){if(!amount(raw.extraDeduct))throw Error('旧版新增扣除无效');s.deductions.push(deduction({id:'legacy-proposed',type:'legacy',amount:raw.extraDeduct,usage:'proposed',timing:'annual'}));}
  return validate(s);
}
export function coverage(s){
  const d=deductionTotals(s.deductions),quickMonthly=s.mode==='quick'&&s.quick.source==='monthly';
  const limit=s.mode==='monthly'?12:quickMonthly?s.quick.throughMonth:0;
  const missing=limit?s.months.slice(0,limit).flatMap((m,i)=>m.status==='missing'?[i+1]:[]):[];
  const inputComplete=s.mode==='quick'?s.quick.confirmed&&(!quickMonthly||missing.length===0):missing.length===0;
  const complete=inputComplete&&d.pendingBaseline===0;
  return {complete,missing,pendingBaseline:d.pendingBaseline,pendingProposed:d.pendingProposed,recommendable:complete&&s.scope&&!s.demo};
}
function annualResult(s,inputs,opts,d,rows){
  const {gross,cash,other,pensionActual,after,reimburse,paid}=inputs,bonusAmount=inputs.bonusAmount??s.bonus;
  const mode=opts.mode??s.currentBonusMode,extra=opts.extra??0,pension=opts.pension??0;
  if(mode==='separate'&&!s.bonusEligible)throw Error('请确认全年一次性奖金适用条件');
  if(!['combined','separate'].includes(mode)||!amount(extra)||!amount(pension)||extra>d.proposed||pension>s.pensionPlan)throw Error('方案超出已确认扣除或缴费预算');
  const addedPension=Math.min(pension,Math.max(0,1200000-pensionActual));
  const annualIncomeBase=gross-bonusAmount-6000000-cash-d.baseline-other-Math.min(1200000,pensionActual+addedPension)-extra;
  const annual=tax(annualIncomeBase+(mode==='combined'?bonusAmount:0));
  const bt=mode==='separate'?bonusTax(bonusAmount):0,finalTax=annual.amount+bt;
  const info=coverage(s);
  return {...info,rows,gross,cash,special:d.baseline,extra,other,pensionActual,addedPension,annualIncomeBase,bonusAmount,
    annual:info.complete?annual:null,finalTax:info.complete?finalTax:null,bonusTax:bt,
    paid:paid===null?null:paid+bt,settlement:info.complete&&paid!==null?annual.amount-paid:null,
    disposable:info.complete?gross-cash-finalTax-after+reimburse-pensionActual-addedPension:null};
}
export function quickCalculate(s,opts={}){
  validate(s);const q=s.quick,d=q.source==='monthly'?deductionTotalsThrough(s.deductions,q.throughMonth):deductionTotals(s.deductions);
  if(q.source==='manual')return annualResult(s,{gross:q.salary+s.bonus,cash:q.cash,other:q.otherDeduct,pensionActual:q.pensionPay,after:q.after,reimburse:q.reimburse,paid:null},opts,d,[]);
  const months=s.months.slice(0,q.throughMonth),known=months.filter(m=>m.status!=='missing');
  const gross=total(known.map(m=>m.salary+m.bonus+m.overtime+m.allowance-m.reduction));
  const bonusAmount=s.bonusMonth<=q.throughMonth?s.bonus:0;
  const monthly=calculate({...s,mode:'monthly'},opts),last=monthly.rows[q.throughMonth-1];
  const lawfulSummary=lawfulDeductions();
  for(const key of lawfulKeys)lawfulSummary[key]=total(known.map(m=>m.lawfulDeductions[key]));
  const sourceSummary={throughMonth:q.throughMonth,filled:known.length,missing:months.flatMap((m,i)=>m.status==='missing'?[i+1]:[]),lawfulDeductions:lawfulSummary};
  return {...annualResult(s,{gross:gross+bonusAmount,cash:total(known.flatMap(m=>cashKeys.map(k=>m[k]))),other:total(known.map(m=>m.otherDeduct)),pensionActual:total(known.map(m=>m.pensionPay)),after:total(known.map(m=>m.after)),reimburse:total(known.map(m=>m.reimburse)),paid:last?.valid?last.cumulativeTax:null,bonusAmount},opts,d,monthly.rows.slice(0,q.throughMonth)),sourceSummary};
}
export function calculate(s,opts={}){
  validate(s);if(s.mode==='quick')return quickCalculate(s,opts);
  const d=deductionTotals(s.deductions),mode=opts.mode??s.currentBonusMode;
  let inc=0,ded=0,paid=0,pp=0,valid=d.pendingBaseline===0;const rows=[];
  for(let i=0;i<12;i++){
    const m=s.months[i],gross=m.salary+m.bonus+m.overtime+m.allowance-m.reduction;
    const cash=total(cashKeys.map(k=>m[k])),bp=i+1===s.bonusMonth?s.bonus:0;
    if(m.status==='missing')valid=false;
    inc+=gross+(mode==='combined'?bp:0);ded+=cash+d.monthly[i]+m.otherDeduct;pp+=m.pensionPay;
    const detail=tax(inc-(i+1)*500000-ded-Math.min(pp,1200000));
    const estimated=valid?Math.max(0,detail.amount-paid):null;
    const withheld=valid?(m.status==='actual'&&m.actualTax!==null?m.actualTax:estimated):null;
    if(withheld!==null)paid+=withheld;
    const bt=mode==='separate'?bonusTax(bp):0;
    rows.push({gross,cash,bp,valid,tax:withheld,estimated,bonusTax:bt,take:valid?gross+bp-cash-withheld-bt-m.after+m.reimburse-m.pensionPay:null,cumulativeTax:valid?paid:null,detail:valid?detail:null,inc,ded,pensionDed:Math.min(pp,1200000)});
  }
  const known=s.months.filter(m=>m.status!=='missing');
  return annualResult(s,{gross:total(rows.filter((_,i)=>s.months[i].status!=='missing').map(r=>r.gross))+s.bonus,cash:total(known.flatMap(m=>cashKeys.map(k=>m[k]))),other:total(known.map(m=>m.otherDeduct)),pensionActual:total(known.map(m=>m.pensionPay)),after:total(known.map(m=>m.after)),reimburse:total(known.map(m=>m.reimburse)),paid:valid?paid:null},opts,d,rows);
}
export function plans(s){
  validate(s);if(!coverage(s).complete||!s.scope)return [];
  const d=s.mode==='quick'&&s.quick.source==='monthly'?deductionTotalsThrough(s.deductions,s.quick.throughMonth):deductionTotals(s.deductions),base=calculate(s);
  const modes=s.bonusEligible&&s.bonus>0?['combined','separate']:[s.currentBonusMode];
  const extras=d.proposed>0?[0,d.proposed]:[0];
  const pension=Math.min(s.pensionPlan,Math.max(0,1200000-base.pensionActual));
  const pensions=pension>0?[0,pension]:[0],out=[];
  for(const mode of modes)for(const extra of extras)for(const p of pensions){
    const isBase=mode===s.currentBonusMode&&extra===0&&p===0;
    const changes=Number(mode!==s.currentBonusMode)+Number(extra>0)+Number(p>0);
    out.push({id:isBase?'base':`${mode}-${extra>0?1:0}-${p>0?1:0}`,name:[mode==='combined'?'奖金并入':'奖金单独计税',extra?'补充扣除':'',p?'新增养老金':''].filter(Boolean).join('＋'),mode,extra,pension:p,changes,...calculate(s,{mode,extra,pension:p})});
  }
  return out.map(p=>({...p,saving:base.finalTax-p.finalTax,cashChange:p.disposable-base.disposable}));
}
export function rankPlans(list,goal){return [...list].sort((a,b)=>(goal==='tax'?a.finalTax-b.finalTax:b.disposable-a.disposable)||a.changes-b.changes||a.addedPension-b.addedPension||a.id.localeCompare(b.id));}
export function bonusCurve(amount,rawBase=0){
  const thresholds=bands.slice(0,-1).map(b=>b[0]);
  const nearest=thresholds.reduce((a,b)=>Math.abs(b-amount)<Math.abs(a-amount)?b:a);
  const span=Math.max(500000,Math.round(amount*.2)),min=Math.max(0,Math.min(amount,nearest)-span),max=Math.min(10000000000,Math.max(amount,nearest)+span);
  const samples=new Set([min,max,amount,Math.min(max,amount+100)]);
  for(let i=0;i<=50;i++)samples.add(Math.round(min+(max-min)*i/50));
  for(const t of thresholds)if(t>=min&&t<=max)for(const x of [t-1,t,t+1,t+100])if(x>=min&&x<=max)samples.add(x);
  const points=[...samples].sort((a,b)=>a-b).map(x=>({amount:x,tax:bonusTax(x),net:x-bonusTax(x),combined:x-(tax(rawBase+x).amount-tax(rawBase).amount)}));
  return {min,max,nearest,points,at:{amount,tax:bonusTax(amount),net:amount-bonusTax(amount)},plusOne:{amount:amount+100,tax:bonusTax(amount+100),net:amount+100-bonusTax(amount+100)}};
}
