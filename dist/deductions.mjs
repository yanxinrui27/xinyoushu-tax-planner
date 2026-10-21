export const TYPES = {
  child: {name:'子女教育',cap:200000,person:true,help:'每名子女每月2000元，个人按50%或100%分配；确认学籍、符合条件月份和另一方分配。'},
  baby: {name:'3岁以下婴幼儿照护',cap:200000,person:true,help:'每名婴幼儿每月2000元，个人按50%或100%分配；核对年龄、出生月份及另一方分配。'},
  rent: {name:'住房租金',cap:150000,help:'按城市类别每月1500/1100/800元；需在主要工作城市无自有住房，夫妻同城仅一方享受。'},
  loan: {name:'住房贷款利息',cap:100000,help:'符合条件首套住房贷款利息每月1000元，最长240个月；核对夫妻分配和已享受期限。'},
  elder: {name:'赡养老人',cap:300000,help:'独生子女每月3000元；非独生子女分摊、每人每月最高1500元；核对被赡养人年满60周岁等条件。'},
  education: {name:'学历继续教育',cap:40000,help:'境内符合条件的学历（学位）继续教育每月400元，同一学历最长48个月。'},
  certificate: {name:'职业资格继续教育',cap:360000,annual:true,help:'符合规定目录的职业资格证书，在取得证书当年扣除3600元。本工具仅在汇算环节模拟。'},
  medical: {name:'大病医疗',cap:8000000,annual:true,person:true,help:'填本对象年度医保目录范围内个人自付额（扣除报销后）；超过15000元的部分，年度最高扣除80000元。仅年度汇算，核对家庭分配。'},
  legacy: {name:'旧版合计（待分类）',cap:10000000000,help:'原始数值已保留。请编辑为具体项目并确认，不能直接将旧合计作为已核验扣除。'}
};
export function deduction(seed={}) {
  return {id:globalThis.crypto?.randomUUID?.()??String(Date.now()+Math.random()),type:'education',person:'本人',amount:0,start:1,end:12,share:100,sole:false,rentTier:150000,usage:'baseline',timing:'withholding',confirmed:false,...seed};
}
export function deductionValue(d) {
  if(!d.confirmed||d.type==='legacy')return 0;
  if(d.type==='medical')return Math.min(8000000,Math.max(0,d.amount-1500000));
  return TYPES[d.type].annual?d.amount:d.amount*(d.end-d.start+1);
}
export function validateDeductions(ds) {
  if(!Array.isArray(ds)||ds.length>100)throw Error('扣除项目数量或格式无效');
  const ids=new Set();
  for(const d of ds){
    const meta=TYPES[d.type];
    if(!meta||typeof d.id!=='string'||ids.has(d.id)||d.id.length>100)throw Error('扣除项目编号或类型无效');ids.add(d.id);
    if(typeof d.person!=='string'||d.person.length>40||!d.person.trim())throw Error('请输入不超过40字的对象标记，无需身份证号');
    if(!Number.isSafeInteger(d.amount)||d.amount<0||d.amount>10000000000)throw Error('扣除金额无效');
    if(!Number.isInteger(d.start)||!Number.isInteger(d.end)||d.start<1||d.end>12||d.start>d.end)throw Error('扣除起止月份无效');
    if(!['baseline','proposed'].includes(d.usage)||!['annual','withholding'].includes(d.timing)||typeof d.confirmed!=='boolean'||typeof d.sole!=='boolean'||![50,100].includes(d.share)||![80000,110000,150000].includes(d.rentTier))throw Error('扣除设置无效');
    if(d.type==='legacy'){if(d.confirmed)throw Error('旧版扣除需先分类再确认');continue;}
    if((meta.annual||d.usage==='proposed')&&d.timing!=='annual')throw Error('此项目仅支持年度汇算模拟');
    let cap=meta.cap;
    if(['child','baby','loan'].includes(d.type))cap=cap*d.share/100;
    if(d.type==='elder'&&!d.sole)cap=150000;
    if(d.type==='rent')cap=d.rentTier;
    if(d.type!=='medical'&&d.amount>cap)throw Error(`${meta.name}超过所选条件下个人可用限额`);
  }
  const regular=ds.filter(d=>d.type!=='legacy'&&d.amount>0);
  if(regular.some(d=>d.type==='rent')&&regular.some(d=>d.type==='loan'))throw Error('同一年度住房租金与住房贷款利息不能同时享受（包括基准与备选）');
  for(let i=0;i<regular.length;i++)for(let j=i+1;j<regular.length;j++){
    const a=regular[i],b=regular[j],same=a.person.trim()===b.person.trim();
    const overlap=Math.max(a.start,b.start)<=Math.min(a.end,b.end);
    const single=['rent','loan','elder','education','certificate'].includes(a.type);
    if(a.type===b.type&&(single||same)&&(overlap||TYPES[a.type].annual))throw Error(`${TYPES[a.type].name}存在重复项目或重叠月份`);
    if(same&&overlap&&[a.type,b.type].every(t=>['child','baby'].includes(t)))throw Error('同一子女同月不能重复享受教育与婴幼儿照护扣除');
  }
  return ds;
}
export function deductionTotals(ds) {
  validateDeductions(ds);
  const out={baseline:0,proposed:0,monthly:Array(12).fill(0),pendingBaseline:0,pendingProposed:0};
  for(const d of ds){
    if(!d.confirmed){out[d.usage==='baseline'?'pendingBaseline':'pendingProposed']++;continue;}
    const value=deductionValue(d);out[d.usage]+=value;
    if(d.usage==='baseline'&&d.timing==='withholding')for(let i=d.start-1;i<d.end;i++)out.monthly[i]+=d.amount;
  }
  return out;
}
export function deductionTotalsThrough(ds,endMonth) {
  if(!Number.isInteger(endMonth)||endMonth<1||endMonth>12)throw Error('汇总截止月份无效');
  const out=deductionTotals(ds),totals={baseline:0,proposed:0};
  for(const d of ds){
    if(!d.confirmed||d.type==='legacy')continue;
    const value=TYPES[d.type].annual?deductionValue(d):d.amount*Math.max(0,Math.min(d.end,endMonth)-d.start+1);
    totals[d.usage]+=value;
  }
  return {...out,...totals};
}
