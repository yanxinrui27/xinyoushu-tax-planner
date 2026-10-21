import {blank,demo,month,migrate,validate,calculate,quickKeys,cashKeys,total,VERSION,lawfulKeys,lawfulDeductions,lawfulTotal,contributionAmounts} from './engine.mjs';
import {deduction,TYPES} from './deductions.mjs';
import {KEY,initialState,readState,writeState} from './storage.mjs';
import {page,names,labels} from './ui.mjs';

let state=demo(),tab='overview',dirty=false,editDed=null,loadError='',flowStep=1;
try{state=initialState(localStorage);}catch(error){loadError=`本机记录未加载：${error.message}。原始数据未覆盖，可到设置页导出备份。`;}
const app=document.querySelector('#app');
function toast(message){
  const el=document.querySelector('#toast');el.textContent=message;el.style.display='block';
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4200);
}
function render(){app.innerHTML=page(state,tab,editDed,flowStep);bind();}
function leave(){if(dirty&&!confirm('当前有未保存输入，放弃修改并继续？'))return false;dirty=false;return true;}
function commit(next,message){
  validate(next);if(loadError)throw Error('原始记录加载失败，先导出原始记录或导入有效备份，再修改数据。');
  writeState(localStorage,next);state=next;dirty=false;if(message)toast(message);
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
    const y=Number(e.target.value);state=readState(localStorage,y)??blank(y);tab='overview';editDed=null;flowStep=1;render();
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
    for(const k of quickKeys.filter(k=>k!=='otherDeduct'))next.quick[k]=cents(fd.get('q_'+k));
    next.quick.lawfulDeductions=readLawful(fd,'q_');next.quick.otherDeduct=lawfulTotal(next.quick.lawfulDeductions);
    next.quick.confirmed=fd.has('quickConfirmed');next.mode='quick';
    if(!confirm(`确认提交${next.year}年度快算数据？\n\n全年工资：¥ ${(next.quick.salary/100).toFixed(2)}\n个人社保及公积金：¥ ${(next.quick.cash/100).toFixed(2)}\n其他依法扣除：¥ ${(next.quick.otherDeduct/100).toFixed(2)}\n\n月度记录不会被修改。`))return;
    commit(next,next.quick.confirmed?'年度输入已确认，未改动月度记录':'已保存草稿，确认完整输入后才能查看正式结果');flowStep=next.quick.confirmed?2:1;render();window.scrollTo(0,0);
  });
  submitForm('planForm',fd=>{
    const next=structuredClone(state);next.bonus=cents(fd.get('annualBonus'));next.pensionPlan=cents(fd.get('pensionPlan'));
    next.bonusMonth=Number(fd.get('bonusMonth'));next.goal=fd.get('goal');next.bonusEligible=fd.has('bonusEligible');
    next.currentBonusMode=next.bonusEligible?fd.get('currentBonusMode'):'combined';
    commit(next,'奖金、预算及所有可用组合已更新');render();
  });
  const scope=document.querySelector('#scope');
  if(scope)scope.onchange=()=>attempt(()=>{const next=structuredClone(state);next.scope=scope.checked;commit(next,'适用范围已保存');render();});
  bindLawfulChoices();bindContributionPreview();bindDeductions();bindImport();
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
function bindImport(){
  const input=document.querySelector('#importFile');if(!input)return;
  input.onchange=async()=>{
    try{
      const file=input.files[0];if(!file)return;
      if(file.size>2000000)throw Error('备份文件超过2MB');
      const raw=await file.text(),pack=JSON.parse(raw),data=pack.data??pack;
      if(pack.rules&&pack.rules!==VERSION&&data.version===3)throw Error('规则版本不匹配，请使用对应版本工具核对后导入');
      const next=migrate(data);
      if(!confirm(`导入${next.year}年度记录，将替换该年度快算、月度及扣除台账。其他年度保留。继续？`))return;
      if(data.version===1||data.version===2){const key=`${KEY}-before-v${data.version+1}-${next.year}`;if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));}
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
    lines.push(['年度','模式','数据完整','税前收入含奖金','个人社保公积金','最终个税','可支配现金'],[state.year,'年度快算',r.complete?'是':'否',r.gross/100,r.cash/100,r.finalTax===null?'待补齐':r.finalTax/100,r.disposable===null?'待补齐':r.disposable/100]);
  }else{
    const keys=[...cashKeys,'after','pensionPay'],cum=Object.fromEntries(keys.map(k=>[k,0]));let prefix=true;
    lines.push(['月份','状态','工资及奖金','社保公积金','普通工资个税','奖金单独计税','累计普通工资税','预计到手',...keys.flatMap(k=>[names[k],names[k]+'累计'])]);
    r.rows.forEach((v,i)=>{
      const m=state.months[i],present=m.status!=='missing';prefix=prefix&&present;
      const amount=x=>x===null?'待补齐':x/100;
      lines.push([i+1,labels[m.status],present?(v.gross+v.bp)/100:'未填写',present?v.cash/100:'未填写',amount(v.tax),v.valid?v.bonusTax/100:'待补齐',amount(v.cumulativeTax),amount(v.take),...keys.flatMap(k=>{if(present)cum[k]+=m[k];return [present?m[k]/100:'未填写',prefix?cum[k]/100:'待补齐'];})]);
    });
  }
  download(`薪有数-${state.year}-${state.mode==='quick'?'年度快算':'月度明细'}.csv`,'\ufeff'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');toast('当前模式明细已导出');
}
function action(name){
  if(name==='backup'){
    const raw=loadError?localStorage.getItem(KEY):null;
    download(`薪有数-${state.year}-备份.json`,raw??JSON.stringify({format:'xinyoushu',rules:VERSION,exportedAt:new Date().toISOString(),data:state},null,2),'application/json');return;
  }
  if(name==='oldBackup'){
    const raw=localStorage.getItem(`${KEY}-before-v3-${state.year}`)??localStorage.getItem(`${KEY}-before-v2-${state.year}`);
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
render();if(loadError)setTimeout(()=>toast(loadError),100);
