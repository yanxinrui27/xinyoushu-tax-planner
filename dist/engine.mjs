export const VERSION='2026.10.21-v1';
export const bands=[[3600000,3,0],[14400000,10,252000],[30000000,20,1692000],[42000000,25,3192000],[66000000,30,5292000],[96000000,35,8592000],[Infinity,45,18192000]];
export const cashKeys=['pension','medical','unemployment','socialOther','fund','fundExtra'];
export const numKeys=['salary','bonus','overtime','allowance','reduction',...cashKeys,'special','otherDeduct','after','reimburse','pensionPay'];
export const cents=x=>Math.round(Number(x)*100);
export const total=(a)=>a.reduce((s,x)=>s+x,0);
export function tax(base){base=Math.max(0,base);const [limit,rate,quick]=bands.find(b=>base<=b[0]);return {base,rate,quick,amount:Math.max(0,Math.round(base*rate/100)-quick)};}
export function bonusTax(amount){const b=bands.find(b=>amount<=b[0]);return Math.max(0,Math.round(amount*b[1]/100)-b[2]/12);}
export function month(seed={}){return Object.assign(Object.fromEntries(numKeys.map(k=>[k,0])),{status:'forecast',actualTax:null},seed);}
export function demo(){return {version:1,year:2026,selected:9,demo:true,scope:false,bonus:6000000,bonusMonth:12,bonusEligible:false,pensionPlan:1200000,extraDeduct:0,deductConfirmed:false,goal:'cash',months:Array.from({length:12},()=>month({salary:2500000,pension:160000,medical:40000,unemployment:10000,fund:240000,special:150000}))};}
export function validate(s){if(!s||s.version!==1||![2026,2027].includes(s.year)||!Array.isArray(s.months)||s.months.length!==12)throw Error('备份格式或年度不受支持');if(!Number.isInteger(s.selected)||s.selected<0||s.selected>11||!['cash','tax'].includes(s.goal))throw Error('备份设置无效');for(const k of ['demo','scope','bonusEligible','deductConfirmed'])if(typeof s[k]!=='boolean')throw Error('备份确认状态无效');for(const m of s.months){if(!m)throw Error('月份数据缺失');for(const k of numKeys){if(!Number.isSafeInteger(m[k])||m[k]<0||m[k]>10000000000)throw Error('金额必须为有效非负数，单项不超过一亿元');}if(m.reduction>m.salary+m.bonus+m.overtime+m.allowance)throw Error('工资扣减不能超过当月收入');if(!['actual','forecast'].includes(m.status))throw Error('月份状态无效');if(m.actualTax!==null&&(!Number.isSafeInteger(m.actualTax)||m.actualTax<0||m.actualTax>10000000000))throw Error('实际扣税无效');}for(const k of ['bonus','pensionPlan','extraDeduct'])if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>10000000000)throw Error('方案金额无效');if(s.pensionPlan>1200000)throw Error('新增养老金预算不得超过12000元');if(!Number.isInteger(s.bonusMonth)||s.bonusMonth<1||s.bonusMonth>12)throw Error('奖金月份无效');return s;}
export function calculate(s,{mode='combined',extra=0,pension=0}={}){
 validate(s);if(mode==='separate'&&!s.bonusEligible)throw Error('请先确认奖金适用条件');
 let inc=0,ded=0,paid=0,pp=0,net=0;const rows=[];
 for(let i=0;i<12;i++){
 const m=s.months[i],gross=m.salary+m.bonus+m.overtime+m.allowance-m.reduction,cash=total(cashKeys.map(k=>m[k])),bp=i+1===s.bonusMonth?s.bonus:0;
 pp+=m.pensionPay;const pensionDed=Math.min(pp,1200000);inc+=gross+(mode==='combined'?bp:0);ded+=cash+m.special+m.otherDeduct;
 const detail=tax(inc-(i+1)*500000-ded-pensionDed),estimated=Math.max(0,detail.amount-paid),withheld=m.status==='actual'&&m.actualTax!==null?m.actualTax:estimated;
 paid+=withheld;const bt=mode==='separate'?bonusTax(bp):0;const take=gross+bp-cash-withheld-bt-m.after+m.reimburse-m.pensionPay;net+=take;
 rows.push({gross,cash,bp,tax:withheld,estimated,bonusTax:bt,take,cumulativeTax:paid,detail,inc,ded,pensionDed});
 }
 const gross=total(rows.map(r=>r.gross))+s.bonus,cash=total(rows.map(r=>r.cash)),special=total(s.months.map(m=>m.special)),other=total(s.months.map(m=>m.otherDeduct)),pensionActual=total(s.months.map(m=>m.pensionPay));
 const addedPension=Math.min(pension,Math.max(0,1200000-pensionActual));
 const annual=tax(gross-(mode==='separate'?s.bonus:0)-6000000-cash-special-other-extra-Math.min(1200000,pensionActual+addedPension));
 const bt=mode==='separate'?bonusTax(s.bonus):0,finalTax=annual.amount+bt;
 const disposable=gross-cash-finalTax-total(s.months.map(m=>m.after))+total(s.months.map(m=>m.reimburse))-pensionActual-addedPension;
 return {rows,gross,cash,special,other,annual,finalTax,bonusTax:bt,paid:paid+bt,settlement:annual.amount-paid,disposable,addedPension,pensionActual,net};
}
export function plans(s){const base=calculate(s);const opts=[{id:'base',name:'基准 · 奖金并入',mode:'combined',extra:0,pension:0}];if(s.bonusEligible)opts.push({id:'bonus',name:'奖金单独计税',mode:'separate',extra:0,pension:0});if(s.deductConfirmed&&s.extraDeduct)opts.push({id:'deduct',name:'补充已确认扣除',mode:'combined',extra:s.extraDeduct,pension:0});if(s.pensionPlan)opts.push({id:'pension',name:'新增个人养老金',mode:'combined',extra:0,pension:s.pensionPlan});if(opts.length>2)opts.push({id:'mix',name:'组合情景',mode:s.bonusEligible?'separate':'combined',extra:s.deductConfirmed?s.extraDeduct:0,pension:s.pensionPlan});return opts.map(o=>({...o,...calculate(s,o),saving:base.finalTax-calculate(s,o).finalTax}));}
