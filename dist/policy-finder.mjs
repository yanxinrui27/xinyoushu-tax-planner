export const POLICY_AS_OF='2026-10-22';
export const POLICY_VERSION='2026.10-p0';
const yn=['yes','no','unknown'];
const housingChoices=['undecided','rent','loan'];

export function blankFinder(){
  return {
    step:1,completed:false,reviewedAt:null,policyVersion:POLICY_VERSION,
    answers:{
      baby:'unknown',babyCount:1,babyStart:1,babyEnd:12,babyShare:100,
      child:'unknown',childCount:1,childStart:1,childEnd:12,childShare:100,
      elder:'unknown',sole:'unknown',elderStart:1,elderEnd:12,elderShare:150000,
      rent:'unknown',cityHousing:'unknown',rentStart:1,rentEnd:12,rentTier:150000,
      loan:'unknown',loanStart:1,loanEnd:12,loanShare:100,loanUsedMonths:0,housingChoice:'undecided',
      degree:'unknown',degreeStart:1,degreeEnd:12,degreeUsedMonths:0,
      certificate:'unknown',medical:'unknown',medicalSelfPay:0,medicalPerson:'本人'
    }
  };
}

export function normalizeFinder(value={}){
  const base=blankFinder(),answers=value?.answers&&typeof value.answers==='object'?value.answers:{};
  return {...base,...value,answers:{...base.answers,...answers},policyVersion:value?.policyVersion??POLICY_VERSION};
}

function safeInt(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
export function validateFinder(value){
  if(!value||typeof value!=='object'||!safeInt(value.step,1,5)||typeof value.completed!=='boolean')throw Error('扣除发现进度无效');
  if(value.reviewedAt!==null&&(typeof value.reviewedAt!=='string'||value.reviewedAt.length>40))throw Error('扣除发现核对时间无效');
  if(typeof value.policyVersion!=='string'||value.policyVersion.length>40)throw Error('扣除发现规则版本无效');
  const a=value.answers;if(!a||typeof a!=='object')throw Error('扣除发现回答缺失');
  for(const key of ['baby','child','elder','sole','rent','cityHousing','loan','degree','certificate','medical'])if(!yn.includes(a[key]))throw Error('扣除发现选项无效');
  for(const key of ['babyCount','childCount'])if(!safeInt(a[key],1,5))throw Error('子女人数须为1至5');
  for(const key of ['babyStart','babyEnd','childStart','childEnd','elderStart','elderEnd','rentStart','rentEnd','loanStart','loanEnd','degreeStart','degreeEnd'])if(!safeInt(a[key],1,12))throw Error('扣除发现月份无效');
  for(const [start,end] of [['babyStart','babyEnd'],['childStart','childEnd'],['elderStart','elderEnd'],['rentStart','rentEnd'],['loanStart','loanEnd'],['degreeStart','degreeEnd']])if(a[start]>a[end])throw Error('扣除发现起始月份不能晚于结束月份');
  if(![50,100].includes(a.babyShare)||![50,100].includes(a.childShare)||![50,100].includes(a.loanShare))throw Error('家庭分配比例无效');
  if(!safeInt(a.elderShare,0,150000)||![80000,110000,150000].includes(a.rentTier)||!safeInt(a.loanUsedMonths,0,240)||!safeInt(a.degreeUsedMonths,0,48)||!safeInt(a.medicalSelfPay,0,10000000000))throw Error('扣除发现额度无效');
  if(!housingChoices.includes(a.housingChoice)||typeof a.medicalPerson!=='string'||!a.medicalPerson.trim()||a.medicalPerson.length>40)throw Error('扣除发现补充信息无效');
  return value;
}

const sources={
  baby:'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213592/content.html',
  child:'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213592/content.html',
  elder:'https://fgk.chinatax.gov.cn/zcfgk/c100012/c5213592/content.html',
  rent:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html',
  loan:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html',
  education:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html',
  certificate:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html',
  medical:'https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c3963375/content.html'
};
const names={baby:'3岁以下婴幼儿照护',child:'子女教育',elder:'赡养老人',rent:'住房租金',loan:'住房贷款利息',education:'学历继续教育',certificate:'职业资格继续教育',medical:'大病医疗'};
const months=d=>(d.end-d.start+1);
function annualValue(d){
  if(d.type==='medical')return Math.min(8000000,Math.max(0,d.amount-1500000));
  return ['certificate'].includes(d.type)?d.amount:d.amount*months(d);
}
function item(policyId,status,reasons,missingChecks,draft=null,conflicts=[]){
  return {id:`${policyId}-${draft?.person??'general'}`,policyId,name:names[policyId],status,reasons,missingChecks,conflicts,estimatedDeductionCents:draft?annualValue(draft):0,estimatedTaxSavingCents:null,sourceUrl:sources[policyId],policyAsOf:POLICY_AS_OF,ruleVersion:POLICY_VERSION,ledgerDraft:draft,existingId:null};
}
function draft(type,person,amount,start=1,end=12,extra={}){
  return {type,person,amount,start,end,share:100,sole:false,rentTier:150000,usage:'proposed',timing:'annual',confirmed:false,...extra};
}
function statusFrom(answer){return answer==='unknown'?'needs_info':'not_matched';}
function overlap(a,b){return Math.max(a.start,b.start)<=Math.min(a.end,b.end);}
function applyLedgerConflicts(matches,ledger){
  for(const m of matches){
    const d=m.ledgerDraft;if(!d)continue;
    const same=ledger.find(x=>x.type===d.type&&x.person.trim()===d.person.trim()&&(x.type==='certificate'||x.type==='medical'||overlap(x,d)));
    const housing=ledger.find(x=>[x.type,d.type].sort().join('/')==='loan/rent');
    const existing=same??housing;
    if(existing){
      m.existingId=existing.id;
      m.status='conflict';
      m.conflicts.push(same?'台账已有相同对象或重叠月份的项目，请核对现有记录':'台账已有住房租金或住房贷款利息项目，两者不能同时享受');
    }
  }
  return matches;
}

export function findPolicyMatches(finder,ledger=[]){
  const f=normalizeFinder(finder);validateFinder(f);const a=f.answers,out=[];
  if(a.baby==='yes')for(let i=1;i<=a.babyCount;i++)out.push(item('baby','likely',[`有${a.babyCount}名3岁以下婴幼儿`,`计划由本人按${a.babyShare}%分配`],['核对出生年月、适用月份及另一方申报情况'],draft('baby',`婴幼儿${i}`,200000*a.babyShare/100,a.babyStart,a.babyEnd,{share:a.babyShare})));
  else out.push(item('baby',statusFrom(a.baby),a.baby==='no'?['当前回答为没有3岁以下婴幼儿']:[],a.baby==='unknown'?['请确认是否有3岁以下婴幼儿']:[]));

  if(a.child==='yes')for(let i=1;i<=a.childCount;i++)out.push(item('child','likely',[`有${a.childCount}名符合阶段条件的子女`,`计划由本人按${a.childShare}%分配`],['核对教育阶段、学籍、适用月份及另一方申报情况'],draft('child',`子女${i}`,200000*a.childShare/100,a.childStart,a.childEnd,{share:a.childShare})));
  else out.push(item('child',statusFrom(a.child),a.child==='no'?['当前回答为没有符合条件的子女教育支出']:[],a.child==='unknown'?['请确认子女是否处于符合条件的教育阶段']:[]));

  if(a.elder==='yes'){
    const needs=a.sole==='unknown'?['请确认是否为独生子女；非独生子女需核对分摊协议']:[];
    const amount=a.sole==='yes'?300000:a.elderShare;
    out.push(item('elder',needs.length?'needs_info':'likely',['赡养至少一位年满60周岁的符合条件被赡养人',a.sole==='yes'?'独生子女按每月3000元上限':a.sole==='no'?`非独生子女计划每月分摊${(amount/100).toFixed(0)}元`:'独生子女情况待确认'],needs,draft('elder','被赡养人',amount,a.elderStart,a.elderEnd,{sole:a.sole==='yes'})));
  }else out.push(item('elder',statusFrom(a.elder),a.elder==='no'?['当前回答为没有符合条件的被赡养人']:[],a.elder==='unknown'?['请确认父母或符合条件的祖父母、外祖父母是否年满60周岁']:[]));

  const housingConflict=a.rent==='yes'&&a.loan==='yes'&&a.housingChoice==='undecided';
  if(a.rent==='yes'){
    const eligible=a.cityHousing==='no',missing=a.cityHousing==='unknown'?['请确认本人及配偶在主要工作城市是否有自有住房']:[];
    const conflicts=housingConflict?['同时存在租房和首套房贷信息，请选择本年度拟享受的住房扣除项目']:a.housingChoice==='loan'?['你已选择住房贷款利息，住房租金不能同时享受']:[];
    const status=conflicts.length?'conflict':missing.length?'needs_info':eligible?'likely':'not_matched';
    out.push(item('rent',status,eligible?['在主要工作城市实际租房且本人及配偶无自有住房']:a.cityHousing==='yes'?['本人或配偶在主要工作城市有自有住房']:[],missing,status==='not_matched'?null:draft('rent','本人住房租金',a.rentTier,a.rentStart,a.rentEnd,{rentTier:a.rentTier}),conflicts));
  }else out.push(item('rent',statusFrom(a.rent),a.rent==='no'?['当前回答为没有符合条件的住房租金支出']:[],a.rent==='unknown'?['请确认主要工作城市住房及租赁情况']:[]));

  if(a.loan==='yes'){
    const expired=a.loanUsedMonths>=240,conflicts=housingConflict?['同时存在租房和首套房贷信息，请选择本年度拟享受的住房扣除项目']:a.housingChoice==='rent'?['你已选择住房租金，住房贷款利息不能同时享受']:[];
    const status=conflicts.length?'conflict':expired?'not_matched':'likely';
    out.push(item('loan',status,expired?['首套住房贷款利息扣除已达到240个月']:['正在偿还符合描述的中国境内首套住房贷款利息',`已享受${a.loanUsedMonths}个月`],['核对首套住房贷款利率资格、夫妻分配及历史享受期限'],expired?null:draft('loan','本人住房贷款',100000*a.loanShare/100,a.loanStart,a.loanEnd,{share:a.loanShare}),conflicts));
  }else out.push(item('loan',statusFrom(a.loan),a.loan==='no'?['当前回答为没有符合条件的首套住房贷款利息']:[],a.loan==='unknown'?['请确认本人或配偶是否正在偿还首套住房贷款利息']:[]));

  if(a.degree==='yes'){
    const remaining=Math.max(0,48-a.degreeUsedMonths),requested=a.degreeEnd-a.degreeStart+1,end=Math.min(a.degreeEnd,a.degreeStart+Math.max(0,remaining)-1);
    out.push(item('education',remaining?'likely':'not_matched',remaining?[`正在接受境内学历（学位）继续教育`,`同一学历剩余最多${remaining}个月`]:['同一学历继续教育已达到48个月'],['核对教育阶段、起止时间及是否由父母选择扣除'],remaining?draft('education','本人继续教育',40000,a.degreeStart,Math.max(a.degreeStart,end)):null,requested>remaining?['所选月份超过剩余期限，已按剩余期限预估']:[]));
  }else out.push(item('education',statusFrom(a.degree),a.degree==='no'?['当前回答为没有学历（学位）继续教育']:[],a.degree==='unknown'?['请确认是否正在接受境内学历（学位）继续教育']:[]));

  if(a.certificate==='yes')out.push(item('certificate','likely',['本年度取得符合描述的职业资格证书'],['核对证书是否属于技能人员或专业技术人员职业资格目录及取得年度'],draft('certificate','本人职业资格证书',360000,1,12)));
  else out.push(item('certificate',statusFrom(a.certificate),a.certificate==='no'?['当前回答为本年度未取得符合条件的职业资格证书']:[],a.certificate==='unknown'?['请确认本年度是否取得符合目录的职业资格证书']:[]));

  if(a.medical==='yes'){
    const missing=a.medicalSelfPay===0?['请输入医保报销后、医保目录范围内的个人自付金额']:[];
    const eligible=a.medicalSelfPay>1500000;
    out.push(item('medical',missing.length?'needs_info':eligible?'likely':'not_matched',eligible?[`医保目录范围内个人自付超过15000元`,`按年度汇算、最高扣除80000元`]:a.medicalSelfPay?['当前金额未超过15000元起扣线']:[],missing,eligible?draft('medical',a.medicalPerson,a.medicalSelfPay,1,12):null));
  }else out.push(item('medical',statusFrom(a.medical),a.medical==='no'?['当前回答为没有符合条件的大病医疗支出']:[],a.medical==='unknown'?['请确认本人、配偶或未成年子女是否有相关医疗支出']:[]));

  return {matches:applyLedgerConflicts(out,ledger),unansweredTopics:['baby','child','elder','rent','loan','degree','certificate','medical'].filter(k=>a[k]==='unknown'),policyAsOf:POLICY_AS_OF,ruleVersion:POLICY_VERSION};
}
