import {blank,demo,month,migrate,validate,calculate,quickKeys,cashKeys,total,VERSION,lawfulKeys,lawfulDeductions,lawfulTotal,contributionAmounts} from './engine.mjs';
import {deduction,TYPES} from './deductions.mjs';
import {findPolicyMatches,POLICY_VERSION} from './policy-finder.mjs';
import {KEY,readState,writeState} from './storage.mjs';
import {page,names,labels} from './ui.mjs?v=5.5';
import {accountInfo,hasAccount,hasActiveSession,registerAccount,loginAccount,changePassword,logout} from './auth.mjs';
import {authPage} from './auth-ui.mjs?v=5.5';
import {PUBLIC_DEMO_USERNAME,PUBLIC_DEMO_PASSWORD,PUBLIC_DEMO_CASE,PUBLIC_DEMO_SEED_VERSION,PUBLIC_DEMO_SEED_KEY,PUBLIC_DEMO_PRIOR_KEY,profileStorage,assignLegacyOwner,migrateLegacyState} from './profile.mjs';

let state=demo(),tab='overview',dirty=false,editDed=null,loadError='',flowStep=1,account=null,dataStore=null;
const app=document.querySelector('#app');
function toast(message){
  const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4200);
}
function render(){app.innerHTML=page(state,tab,editDed,flowStep,account?.username);bind();}
function renderAuth(mode,message=''){app.innerHTML=authPage(mode,message,mode==='login'?PUBLIC_DEMO_USERNAME:'');bindAuth(mode);}
async function seedPublicDemo(){
  if(account?.username!==PUBLIC_DEMO_USERNAME||dataStore.getItem(PUBLIC_DEMO_SEED_KEY)===PUBLIC_DEMO_SEED_VERSION)return;
  const response=await fetch(PUBLIC_DEMO_CASE);
  if(!response.ok)throw Error('本机案例数据加载失败');
  const backup=await response.json(),seeded=migrate(backup.data);
  const prior=dataStore.getItem(KEY);
  if(prior&&!dataStore.getItem(PUBLIC_DEMO_PRIOR_KEY))dataStore.setItem(PUBLIC_DEMO_PRIOR_KEY,prior);
  seeded.demo=false;seeded.mode='monthly';writeState(dataStore,seeded);
  dataStore.setItem(PUBLIC_DEMO_SEED_KEY,PUBLIC_DEMO_SEED_VERSION);
}
async function unlockApp(){
  loadError='';
  try{
    dataStore=profileStorage(localStorage,account.username);migrateLegacyState(localStorage,dataStore,account.username);
    await seedPublicDemo();state=readState(dataStore)??blank(2026);
  }catch(error){loadError=`本机记录未加载：${error.message}。原始数据未覆盖，可到设置页导出备份。`;}
  render();if(loadError)setTimeout(()=>toast(loadError),100);
}
function bindAuth(mode){
  const form=document.querySelector(mode==='register'?'#registerForm':'#loginForm');if(!form)return;
  document.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>renderAuth(button.dataset.authMode));
  if(mode==='login'){
    const username=form.querySelector('#authUsername'),password=form.querySelector('#authPassword');
    const syncDefault=()=>{password.value=username.value===PUBLIC_DEMO_USERNAME?PUBLIC_DEMO_PASSWORD:'';};
    syncDefault();username.oninput=syncDefault;
  }
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form),button=form.querySelector('button[type="submit"]'),old=button.textContent;
    button.disabled=true;button.textContent=mode==='register'?'正在创建…':'正在登录…';
    try{
      if(mode==='register')await registerAccount(localStorage,sessionStorage,{username:fd.get('username'),password:fd.get('authPassword'),confirmPassword:fd.get('authConfirmPassword')});
      else await loginAccount(localStorage,sessionStorage,{username:fd.get('username'),password:fd.get('authPassword')});
      account=accountInfo(localStorage,sessionStorage);await unlockApp();
    }catch(error){renderAuth(mode,error.message);}
    finally{if(button.isConnected){button.disabled=false;button.textContent=old;}}
  };
}
async function boot(){
  try{
    if(!hasAccount(localStorage,PUBLIC_DEMO_USERNAME))await registerAccount(localStorage,sessionStorage,{username:PUBLIC_DEMO_USERNAME,password:PUBLIC_DEMO_PASSWORD,confirmPassword:PUBLIC_DEMO_PASSWORD},{activate:false});
    assignLegacyOwner(localStorage,PUBLIC_DEMO_USERNAME);
    account=accountInfo(localStorage,sessionStorage);
    if(!hasActiveSession(localStorage,sessionStorage)){renderAuth('login');return;}
    await unlockApp();
  }catch(error){renderAuth('login',error.message);}
}
function leave(){if(dirty&&!confirm('当前有未保存输入，放弃修改并继续？'))return false;dirty=false;return true;}
function commit(next,message){
  validate(next);if(loadError)throw Error('原始记录加载失败，先导出原始记录或导入有效备份，再修改数据。');
  writeState(dataStore,next);state=next;dirty=false;if(message)toast(message);
}
function attempt(fn){try{fn();}catch(error){toast(error.message);}}
function cents(value){
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(value)))throw Error('金额需为非负数，最多保留两位小数');
  return Math.round(Number(value)*100);
}
function optionalCents(value){return value===''?null:cents(value);}
function basisPoints(value){
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(value))||Number(value)>100)throw Error('缴费比例须为0%至100%，最多两位小数');
  return Math.round(Number(value)*100);
}
function readLawful(fd,prefix){
  const values=lawfulDeductions();
  for(const key of lawfulKeys)values[key]=fd.has(`${prefix}law_enabled_${key}`)?cents(fd.get(`${prefix}law_${key}`)??'0'):0;
  return values;
}
function go(next){
  if(!leave())return;
  if(next==='monthly')state.mode='monthly';
  if(next==='quick')state.mode='quick';
  tab=next;editDed=null;flowStep=1;render();window.scrollTo(0,0);
}
function submitForm(id,handler){
  const form=document.querySelector('#'+id);if(!form)return;
  form.oninput=()=>dirty=true;
  form.onsubmit=e=>{e.preventDefault();attempt(()=>handler(new FormData(form),form));};
}
function bind(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>go(b.dataset.tab));
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
    if(!leave())return;state.mode=b.dataset.mode;tab=state.mode==='quick'?'quick':'monthly';editDed=null;flowStep=1;render();
  });
  document.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{if(!leave())return;state.selected=Number(b.dataset.month);state.mode='monthly';tab='monthly';flowStep=1;render();window.scrollTo(0,0);});
  document.querySelectorAll('[data-flow-step]').forEach(b=>b.onclick=()=>{
    if(b.disabled||!leave())return;flowStep=Number(b.dataset.flowStep);render();window.scrollTo(0,0);
  });
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>attempt(()=>action(b.dataset.action)));
  document.querySelector('#year').onchange=e=>attempt(()=>{
    if(!leave()){e.target.value=state.year;return;}
    const y=Number(e.target.value);state=readState(dataStore,y)??blank(y);tab='overview';editDed=null;flowStep=1;render();
  });
  submitForm('monthForm',fd=>{
    const next=structuredClone(state),m=month();
    for(const k of ['salary','bonus','overtime','allowance','reduction','fundExtra','pensionPay','after','reimburse'])m[k]=cents(fd.get(k));
    m.socialBase=optionalCents(fd.get('socialBase'));m.fundBase=optionalCents(fd.get('fundBase'));m.fundEnabled=fd.has('fundEnabled');
    for(const k of ['pensionRate','medicalRate','unemploymentRate','maternityRate','injuryRate','fundRate'])m[k]=basisPoints(fd.get(k));
    Object.assign(m,contributionAmounts(m));m.lawfulDeductions=readLawful(fd,'');m.otherDeduct=lawfulTotal(m.lawfulDeductions);
    m.status=fd.get('status');m.actualTax=fd.get('actualTax')===''?null:cents(fd.get('actualTax'));
    const gross=m.salary+m.bonus+m.overtime+m.allowance-m.reduction,cash=total(cashKeys.map(k=>m[k]));
    if(!confirm(`确认提交${next.selected+1}月数据并计算？\n\n应税工资收入：¥ ${(gross/100).toFixed(2)}\n个人社保及公积金：¥ ${(cash/100).toFixed(2)}\n其他依法扣除：¥ ${(m.otherDeduct/100).toFixed(2)}`))return;
    next.months[next.selected]=m;commit(next,'已保存；相关月份与年度方案已重算');flowStep=2;render();window.scrollTo(0,0);
  });
  submitForm('quickForm',fd=>{
    const next=structuredClone(state);
    const source=fd.get('quickSource');next.quick.source=source;next.quick.throughMonth=source==='monthly'?Number(fd.get('throughMonth')):next.quick.throughMonth;
    if(source==='manual'){
      for(const k of quickKeys.filter(k=>k!=='otherDeduct'))next.quick[k]=cents(fd.get('q_'+k));
      next.quick.lawfulDeductions=readLawful(fd,'q_');next.quick.otherDeduct=lawfulTotal(next.quick.lawfulDeductions);
    }
    next.quick.confirmed=fd.has('quickConfirmed');next.mode='quick';
    const missing=source==='monthly'?next.months.slice(0,next.quick.throughMonth).flatMap((m,i)=>m.status==='missing'?[i+1]:[]):[];
    if(next.quick.confirmed&&missing.length)throw Error(`请先补齐截止月份内的${missing.join('、')}月，或调整汇总截止月份`);
    const detail=source==='monthly'?`取数方式：月度汇总\n汇总范围：1—${next.quick.throughMonth}月\n已填写月份：${next.quick.throughMonth-missing.length}个月`:`取数方式：自行填写\n全年工资：¥ ${(next.quick.salary/100).toFixed(2)}\n个人社保及公积金：¥ ${(next.quick.cash/100).toFixed(2)}\n其他依法扣除：¥ ${(next.quick.otherDeduct/100).toFixed(2)}`;
    if(!confirm(`确认提交${next.year}年度精算数据？\n\n${detail}\n\n不会覆盖或生成月度记录。`))return;
    commit(next,next.quick.confirmed?'年度输入已确认，未改动月度记录':'已保存草稿，确认完整输入后才能查看正式结果');flowStep=next.quick.confirmed?2:1;render();window.scrollTo(0,0);
  });
  submitForm('planForm',fd=>{
    const next=structuredClone(state);next.bonus=cents(fd.get('annualBonus'));next.pensionPlan=cents(fd.get('pensionPlan'));
    next.bonusMonth=Number(fd.get('bonusMonth'));next.goal=fd.get('goal');next.bonusEligible=fd.has('bonusEligible');
    next.currentBonusMode=next.bonusEligible?fd.get('currentBonusMode'):'combined';
    commit(next,'比较条件已保存，全部可用组合已重新计算');tab='planningResults';render();window.scrollTo(0,0);
  });
  const scope=document.querySelector('#scope');
  if(scope)scope.onchange=()=>attempt(()=>{const next=structuredClone(state);next.scope=scope.checked;commit(next,'适用范围已保存');render();});
  bindPasswordChange();
  bindLawfulChoices();bindContributionPreview();bindQuickSource();bindDeductions();bindImport();
  bindFinder();
}
function bindPasswordChange(){
  const form=document.querySelector('#changePasswordForm');if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form),button=form.querySelector('button[type="submit"]'),old=button.textContent;
    button.disabled=true;button.textContent='正在更新…';
    try{
      await changePassword(localStorage,{username:account.username,currentPassword:fd.get('currentPassword'),newPassword:fd.get('newPassword'),confirmPassword:fd.get('confirmPassword')});
      form.reset();toast('密码已更新');
    }catch(error){toast(error.message);}
    finally{button.disabled=false;button.textContent=old;}
  };
}
function bindLawfulChoices(){
  document.querySelectorAll('[data-law-toggle]').forEach(box=>box.onchange=()=>{
    const input=document.querySelector(`#${box.dataset.lawToggle}`);if(!input)return;
    input.disabled=!box.checked;if(box.checked)input.focus();else input.value='0.00';dirty=true;
  });
}
function bindContributionPreview(){
  const form=document.querySelector('#monthForm');if(!form)return;
  const ids=['salary','socialBase','fundBase','pensionRate','medicalRate','unemploymentRate','maternityRate','injuryRate','fundRate','fundEnabled'];
  const update=()=>{
    try{
      const fd=new FormData(form),m=month({salary:cents(fd.get('salary')),socialBase:optionalCents(fd.get('socialBase')),fundBase:optionalCents(fd.get('fundBase')),fundEnabled:fd.has('fundEnabled')});
      for(const k of ['pensionRate','medicalRate','unemploymentRate','maternityRate','injuryRate','fundRate'])m[k]=basisPoints(fd.get(k));
      const out=contributionAmounts(m);
      for(const [k,v] of Object.entries(out)){const el=document.querySelector(`[data-contribution-output="${k}"]`);if(el)el.textContent=`¥ ${(v/100).toFixed(2)}`;}
    }catch{}
  };
  for(const id of ids){const el=document.querySelector('#'+id);if(el)el.addEventListener('input',update);}
  update();
}
function bindQuickSource(){
  document.querySelectorAll('[data-quick-source]').forEach(box=>box.onchange=()=>{
    if(box.value===state.quick.source)return;
    const next=structuredClone(state);next.quick.source=box.value;next.quick.confirmed=false;state=next;dirty=true;flowStep=1;render();
  });
  const through=document.querySelector('#throughMonth');
  if(through)through.onchange=()=>{
    const next=structuredClone(state);next.quick.throughMonth=Number(through.value);next.quick.confirmed=false;state=next;dirty=true;flowStep=1;render();
  };
}
function readDed(fd){
  const d={...editDed,type:fd.get('d_type'),person:fd.get('d_person').trim(),amount:cents(fd.get('d_amount')),usage:fd.get('d_usage'),timing:fd.get('d_timing'),confirmed:fd.has('d_confirmed')};
  if(fd.has('d_start'))d.start=Number(fd.get('d_start'));
  if(fd.has('d_end'))d.end=Number(fd.get('d_end'));
  if(fd.has('d_share'))d.share=Number(fd.get('d_share'));
  if(fd.has('d_rentTier'))d.rentTier=Number(fd.get('d_rentTier'));
  if(fd.has('d_sole'))d.sole=fd.get('d_sole')==='yes';
  return d;
}
function bindDeductions(){
  document.querySelectorAll('[data-edit-ded]').forEach(b=>b.onclick=()=>{
    if(!leave())return;editDed=structuredClone(state.deductions.find(d=>d.id===b.dataset.editDed));render();document.querySelector('#dedForm').scrollIntoView({block:'start',behavior:'smooth'});
  });
  document.querySelectorAll('[data-delete-ded]').forEach(b=>b.onclick=()=>attempt(()=>{
    if(!leave()||!confirm('删除此扣除项目并重新计算？可用事先导出的备份恢复。'))return;
    const next=structuredClone(state);next.deductions=next.deductions.filter(d=>d.id!==b.dataset.deleteDed);commit(next,'扣除项目已移除');editDed=null;render();
  }));
  submitForm('dedForm',fd=>{
    const d=readDed(fd),next=structuredClone(state),index=next.deductions.findIndex(x=>x.id===d.id);
    if(index===-1)next.deductions.push(d);else next.deductions[index]=d;
    commit(next,'项目已保存，额度及重复校验通过');editDed=null;render();
  });
  const form=document.querySelector('#dedForm');if(!form)return;
  for(const id of ['d_type','d_usage','d_timing'])document.querySelector('#'+id).onchange=()=>attempt(()=>{
    const next=readDed(new FormData(form));
    if(TYPES[next.type].annual||next.usage==='proposed')next.timing='annual';
    if(id==='d_type')next.confirmed=false;
    editDed=next;dirty=true;const y=window.scrollY;render();window.scrollTo(0,y);
  });
}
const briefNumberMap={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
function briefNumber(value){
  const text=String(value??'').trim();
  if(/^\d+$/.test(text))return Number(text);
  if(text==='十')return 10;
  if(text.includes('十')){
    const [left,right]=text.split('十');
    return (left?briefNumberMap[left]??1:1)*10+(right?briefNumberMap[right]??0:0);
  }
  return briefNumberMap[text];
}
function briefSlice(text,keywords,radius=90){
  const indexes=keywords.map(key=>text.indexOf(key)).filter(index=>index>=0);
  if(!indexes.length)return '';
  const index=Math.min(...indexes);
  return text.slice(Math.max(0,index-radius),Math.min(text.length,index+radius));
}
function briefClause(text,keywords){
  const clauses=text.split(/[；。!?！？]/).map(value=>value.trim()).filter(Boolean);
  return clauses.find(clause=>keywords.some(keyword=>clause.includes(keyword)))||briefSlice(text,keywords,75);
}
function briefHasNo(text,keywords){
  const group=keywords.join('|');
  return new RegExp(`(?:没有|无|不涉及|未有|并无).{0,8}(?:${group})|(?:${group}).{0,8}(?:没有|无|不涉及|未有|并无)`).test(text);
}
function briefCount(text,keywords){
  const group=keywords.join('|'),token='(\\d+|[一二两三四五])';
  const before=text.match(new RegExp(`${token}\\s*(?:名|个)?[^，。；]{0,12}(?:${group})`));
  if(before)return briefNumber(before[1]);
  const after=text.match(new RegExp(`(?:${group})[^，。；]{0,12}?${token}\\s*(?:名|个)`));
  return after?briefNumber(after[1]):undefined;
}
function briefMonths(text,keywords=[]){
  const source=keywords.length?briefSlice(text,keywords,75):text;
  if(!source)return null;
  if(/全年|整年|一年十二个月/.test(source))return [1,12];
  let match=source.match(/(1[0-2]|[1-9])\s*月\s*(?:到|至|—|-|~|～)\s*(1[0-2]|[1-9])\s*月/);
  if(match)return [Number(match[1]),Number(match[2])];
  match=source.match(/(1[0-2]|[1-9])\s*月(?:开始|起)/);
  if(match)return [Number(match[1]),12];
  match=source.match(/(?:截至|到)(1[0-2]|[1-9])\s*月/);
  return match?[1,Number(match[1])]:null;
}
function briefShare(text){
  if(/各\s*(?:按|扣)?\s*50%|各一半|双方.*一半|本人.*50%|我.*50%/.test(text))return 50;
  if(/100%|全部由我|全额由我|本人全部|我全部/.test(text))return 100;
  return undefined;
}
function briefAmount(text,anchors){
  const source=briefSlice(text,anchors,70)||text;
  const match=source.match(/(\d+(?:\.\d+)?)\s*(万|元)/);
  if(!match)return undefined;
  return Math.round(Number(match[1])*(match[2]==='万'?10000:1)*100)/100;
}
function extractFinderBrief(step,raw){
  const text=String(raw??'').replace(/[，、]/g,'，').replace(/[；]/g,'；').trim(),out={};
  if(step===1){
    const babyKeys=['婴幼儿','宝宝','3岁以下','三岁以下','2岁','1岁'],babyText=briefClause(text,babyKeys);
    const childKeys=['子女教育','学前教育','幼儿园','小学','初中','高中','大学','就学','学历教育'],childText=briefClause(text,childKeys);
    if(babyText){out.baby=briefHasNo(babyText,babyKeys)?'no':'yes';const count=briefCount(babyText,babyKeys);if(count)out.babyCount=Math.min(5,count);const share=briefShare(babyText);if(share)out.babyShare=share;const months=briefMonths(babyText);if(months)[out.babyStart,out.babyEnd]=months;}
    if(childText){out.child=briefHasNo(childText,childKeys)?'no':'yes';const count=briefCount(childText,['孩子','子女',...childKeys]);if(count)out.childCount=Math.min(5,count);const share=briefShare(childText);if(share)out.childShare=share;const months=briefMonths(childText);if(months)[out.childStart,out.childEnd]=months;}
  }else if(step===2){
    const elderKeys=['赡养','老人','父母','被赡养人'],elderText=briefSlice(text,elderKeys,100);
    if(elderText)out.elder=briefHasNo(elderText,elderKeys)?'no':(/60|六十|满六十|年满/.test(elderText)?'yes':'unknown');
    if(/非独生|不是独生/.test(text))out.sole='no';else if(/独生子女|我是独生/.test(text))out.sole='yes';
    const share=briefAmount(text,['分摊','每月']);if(share!==undefined)out.elderShare=share;
    const months=briefMonths(text,elderKeys);if(months)[out.elderStart,out.elderEnd]=months;
  }else if(step===3){
    const rentKeys=['租房','租住','房租','住房租金'],rentText=briefSlice(text,rentKeys,100);
    if(rentText)out.rent=/(?:不|没有|未)\s*(?:在[^，；。]{0,10})?(?:租房|租住)|无租房/.test(rentText)?'no':'yes';
    if(/当地无房|夫妻.*无房|没有自有住房|无自有住房|名下无房/.test(text))out.cityHousing='no';
    else if(/当地有房|有自有住房|名下有房/.test(text))out.cityHousing='yes';
    if(/1500\s*元|1500元档|一千五/.test(text))out.rentTier=150000;else if(/1100\s*元|1100元档|一千一/.test(text))out.rentTier=110000;else if(/800\s*元|800元档|八百/.test(text))out.rentTier=80000;
    const rentMonths=briefMonths(text,rentKeys);if(rentMonths)[out.rentStart,out.rentEnd]=rentMonths;
    const loanKeys=['首套房贷','首套住房贷款','房贷','住房贷款'],loanText=briefSlice(text,loanKeys,100);
    if(loanText){out.loan=/(?:没有|无|未偿还|不涉及).{0,8}(?:首套|房贷|住房贷款)/.test(loanText)?'no':'yes';const share=briefShare(loanText);if(share)out.loanShare=share;const used=loanText.match(/(?:已享受|已经享受|历史享受)\s*(\d+)\s*个?月/);if(used)out.loanUsedMonths=Math.min(240,Number(used[1]));const months=briefMonths(text,loanKeys);if(months)[out.loanStart,out.loanEnd]=months;}
    if(/(?:选择|优先|拟选|计划选).{0,8}(?:租金|租房)/.test(text))out.housingChoice='rent';
    else if(/(?:选择|优先|拟选|计划选).{0,8}(?:房贷|贷款)/.test(text))out.housingChoice='loan';
  }else if(step===4){
    const degreeKeys=['学历继续教育','学位继续教育','在职研究生','读研','继续教育'],degreeText=briefSlice(text,degreeKeys,90);
    if(degreeText){out.degree=briefHasNo(degreeText,degreeKeys)?'no':'yes';const used=degreeText.match(/(?:已享受|已经享受|历史享受)\s*(\d+)\s*个?月/);if(used)out.degreeUsedMonths=Math.min(48,Number(used[1]));const months=briefMonths(text,degreeKeys);if(months)[out.degreeStart,out.degreeEnd]=months;}
    const certificateKeys=['职业资格','资格证书','职业证书','考证'],certificateText=briefSlice(text,certificateKeys,75);
    if(certificateText)out.certificate=briefHasNo(certificateText,certificateKeys)?'no':'yes';
    const medicalKeys=['大病医疗','医疗自付','个人自付','医药费','医疗费'],medicalText=briefSlice(text,medicalKeys,90);
    if(medicalText){out.medical=briefHasNo(medicalText,medicalKeys)?'no':'yes';const amount=briefAmount(medicalText,['自付','医疗','医药']);if(amount!==undefined)out.medicalSelfPay=amount;if(/配偶/.test(medicalText))out.medicalPerson='配偶';else if(/未成年子女|孩子|子女/.test(medicalText))out.medicalPerson='未成年子女A';else if(/本人|我/.test(medicalText))out.medicalPerson='本人';}
  }
  return out;
}
function fillFinderBrief(step,text){
  const values=extractFinderBrief(step,text),filled=[];
  document.querySelectorAll('.field.ai-filled').forEach(field=>field.classList.remove('ai-filled'));
  for(const [id,value] of Object.entries(values)){
    const input=document.querySelector(`#${id}`);if(!input||value===undefined||value===null)continue;
    input.value=String(value);input.closest('.field')?.classList.add('ai-filled');filled.push(input.labels?.[0]?.textContent?.trim()||id);
  }
  if(!filled.length)throw Error('暂未识别到可预填信息，请补充年龄、人数、月份、金额或选择方式后再试');
  const status=document.querySelector('#finderBriefStatus');
  status.classList.add('success');status.textContent=`已识别并预填 ${filled.length} 项：${filled.join('、')}。请继续核对下方高亮字段。`;
  dirty=true;
}
function bindFinder(){
  document.querySelectorAll('[data-finder-step]').forEach(b=>b.onclick=()=>attempt(()=>{
    if(!leave())return;const step=Number(b.dataset.finderStep);if(step<1||step>5||step>state.finder.step)throw Error('请先完成当前步骤');
    const next=structuredClone(state);next.finder.step=step;commit(next);render();window.scrollTo(0,0);
  }));
  submitForm('finderForm',fd=>{
    const next=structuredClone(state),a=next.finder.answers,step=next.finder.step;
    if(step===1){
      for(const k of ['baby','child'])a[k]=fd.get(k);
      for(const k of ['babyCount','babyStart','babyEnd','babyShare','childCount','childStart','childEnd','childShare'])a[k]=Number(fd.get(k));
    }else if(step===2){
      for(const k of ['elder','sole'])a[k]=fd.get(k);
      for(const k of ['elderStart','elderEnd'])a[k]=Number(fd.get(k));a.elderShare=cents(fd.get('elderShare'));
    }else if(step===3){
      for(const k of ['rent','cityHousing','loan','housingChoice'])a[k]=fd.get(k);
      for(const k of ['rentStart','rentEnd','rentTier','loanStart','loanEnd','loanShare','loanUsedMonths'])a[k]=Number(fd.get(k));
    }else if(step===4){
      for(const k of ['degree','certificate','medical'])a[k]=fd.get(k);
      for(const k of ['degreeStart','degreeEnd','degreeUsedMonths'])a[k]=Number(fd.get(k));
      a.medicalSelfPay=cents(fd.get('medicalSelfPay'));a.medicalPerson=fd.get('medicalPerson').trim();
      next.finder.completed=true;next.finder.reviewedAt=new Date().toISOString();next.finder.policyVersion=POLICY_VERSION;
    }
    next.finder.step=Math.min(5,step+1);commit(next,step===4?'已完成初步发现，请逐项核对':'回答已保存');render();window.scrollTo(0,0);
  });
  const briefConfirm=document.querySelector('#finderBriefConfirm');
  if(briefConfirm)briefConfirm.onchange=()=>{
    if(!briefConfirm.checked)return;
    const input=document.querySelector('#finderBrief');
    try{
      if((input?.value.trim().length??0)<4)throw Error('请先填写一段简要情况，再勾选确认自动填充');
      fillFinderBrief(state.finder.step,input.value.trim());toast('智能识别已完成，请核对高亮字段');
    }catch(error){briefConfirm.checked=false;toast(error.message);}
  };
  document.querySelectorAll('[data-finder-apply]').forEach(b=>b.onclick=()=>attempt(()=>{
    if(!leave())return;const result=findPolicyMatches(state.finder,state.deductions),match=result.matches[Number(b.dataset.finderApply)];
    if(!match||match.status!=='likely'||!match.ledgerDraft)throw Error('该项目需要先补充信息或处理冲突');
    editDed=deduction({...match.ledgerDraft});tab='deductions';render();document.querySelector('#dedForm').scrollIntoView({block:'start',behavior:'smooth'});toast('已预填为备选新增扣除；请核对资格后保存');
  }));
  document.querySelectorAll('[data-finder-existing]').forEach(b=>b.onclick=()=>attempt(()=>{
    if(!leave())return;const existing=state.deductions.find(d=>d.id===b.dataset.finderExisting);if(!existing)throw Error('未找到对应台账记录');
    editDed=structuredClone(existing);tab='deductions';render();document.querySelector('#dedForm').scrollIntoView({block:'start',behavior:'smooth'});
  }));
}
function bindImport(){
  const input=document.querySelector('#importFile');if(!input)return;
  input.onchange=async()=>{
    try{
      const file=input.files[0];if(!file)return;
      if(file.size>2000000)throw Error('备份文件超过2MB');
      const raw=await file.text(),pack=JSON.parse(raw),data=pack.data??pack;
      const compatibleRules=['2026.10.21-v4'];
      if(pack.rules&&pack.rules!==VERSION&&data.version===3&&!compatibleRules.includes(pack.rules))throw Error('规则版本不匹配，请使用对应版本工具核对后导入');
      const next=migrate(data);
      if(!confirm(`导入${next.year}年度记录，将替换该年度精算、月度及专项扣除申报台账。其他年度保留。继续？`))return;
      if(data.version===1||data.version===2){const key=`${KEY}-before-v${data.version+1}-${next.year}`;if(!dataStore.getItem(key))dataStore.setItem(key,JSON.stringify(data));}
      loadError='';commit(next,'备份已恢复；旧版扣除需分类确认');editDed=null;flowStep=1;render();
    }catch(error){toast('导入失败：'+error.message);}
  };
}
function download(name,content,type){
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvCell(value){const text=String(value??'');return '"'+text.replaceAll('"','""')+'"';}
function exportCSV(){
  const r=calculate(state),lines=[];
  if(state.mode==='quick'){
    lines.push(['年度','模式','数据完整','税前收入含奖金','个人社保公积金','最终个税','可支配现金'],[state.year,'年度精算',r.complete?'是':'否',r.gross/100,r.cash/100,r.finalTax===null?'待补齐':r.finalTax/100,r.disposable===null?'待补齐':r.disposable/100]);
  }else{
    const keys=[...cashKeys,'after','pensionPay'],cum=Object.fromEntries(keys.map(k=>[k,0]));let prefix=true;
    lines.push(['月份','状态','工资及奖金','社保公积金','普通工资个税','奖金单独计税','累计普通工资税','预计到手',...keys.flatMap(k=>[names[k],names[k]+'累计'])]);
    r.rows.forEach((v,i)=>{
      const m=state.months[i],present=m.status!=='missing';prefix=prefix&&present;
      const amount=x=>x===null?'待补齐':x/100;
      lines.push([i+1,labels[m.status],present?(v.gross+v.bp)/100:'未填写',present?v.cash/100:'未填写',amount(v.tax),v.valid?v.bonusTax/100:'待补齐',amount(v.cumulativeTax),amount(v.take),...keys.flatMap(k=>{if(present)cum[k]+=m[k];return [present?m[k]/100:'未填写',prefix?cum[k]/100:'待补齐'];})]);
    });
  }
  download(`薪有数-${state.year}-${state.mode==='quick'?'年度精算':'月度明细'}.csv`,'\ufeff'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('当前模式明细已导出');
}
function action(name){
  if(name==='logout'){
    if(!leave())return;logout(sessionStorage);state=demo();account=null;tab='overview';editDed=null;flowStep=1;renderAuth('login','已退出当前本机账号');return;
  }
  if(name==='backup'){
    const raw=loadError?dataStore.getItem(KEY):null;
    download(`薪有数-${state.year}-备份.json`,raw??JSON.stringify({format:'xinyoushu',rules:VERSION,exportedAt:new Date().toISOString(),data:state},null,2),'application/json');return;
  }
  if(name==='oldBackup'){
    const raw=dataStore.getItem(`${KEY}-before-v3-${state.year}`)??dataStore.getItem(`${KEY}-before-v2-${state.year}`);
    if(!raw){toast('本机没有此年度的升级前快照；当前记录仍可导出');return;}
    download(`薪有数-${state.year}-升级前快照.json`,raw,'application/json');return;
  }
  if(name==='csv'){exportCSV();return;}
  if(name==='import'){document.querySelector('#importFile').click();return;}
  if(name==='start'){
    if(!leave()||!confirm('清空当前年度记录并建立空白数据？其他年度保留。建议先导出备份。'))return;
    const next=blank(state.year);next.mode='quick';loadError='';commit(next,'空白年度已建立，未填写不再按0计算');tab='quick';editDed=null;flowStep=1;render();return;
  }
  if(name==='copy'){
    if(dirty){toast('请先保存本月，再复制');return;}
    const m=state.months[state.selected];if(m.status==='missing'){toast('本月尚未保存，不能复制');return;}
    if(!confirm('使用本月已保存的收入、缴费及调整，覆盖后续预测和未填月份？不覆盖已发生月份，实际税额不复制。'))return;
    const next=structuredClone(state);
    for(let i=next.selected+1;i<12;i++)if(next.months[i].status!=='actual')next.months[i]={...m,status:'forecast',actualTax:null};
    commit(next,'后续预测已更新；扣除仍由独立台账按月份计算');render();return;
  }
  if(name==='markMissing'){
    if(!leave()||!confirm('将本月标为未填写？金额会保留，但不纳入完整年度计算。'))return;
    const next=structuredClone(state);next.months[next.selected].status='missing';commit(next,'本月已标为未填写');render();return;
  }
  if(name==='addDed'){if(!leave())return;editDed=deduction();tab='deductions';render();document.querySelector('#dedForm').scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(name==='cancelDed'){if(!leave())return;editDed=null;render();}
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
boot();
