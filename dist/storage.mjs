import {demo,migrate,validate} from './engine.mjs';
export const KEY='xinyoushu-v1';
export function readState(storage,year){
  const key=year?`${KEY}-${year}`:KEY,raw=storage.getItem(key);
  if(!raw)return null;
  const parsed=JSON.parse(raw),state=migrate(parsed);
  if(parsed.version===1){
    // Keep a migration snapshot before any later write; never overwrite it.
    const snapshot=`${KEY}-before-v2-${parsed.year}`;
    if(!storage.getItem(snapshot))storage.setItem(snapshot,raw);
  }
  if(year&&state.year!==year)throw Error('年度记录与所选年度不符');
  return state;
}
export function writeState(storage,state){
  validate(state);
  const yearKey=`${KEY}-${state.year}`,prior=storage.getItem(yearKey);
  try{storage.setItem(yearKey,JSON.stringify(state));storage.setItem(KEY,JSON.stringify(state));}
  catch(error){
    // Do not claim success or retain half of a failed two-key save.
    try{if(prior===null)storage.removeItem(yearKey);else storage.setItem(yearKey,prior);}catch{}
    throw Error('本机保存失败，请先导出备份。'+(error.name==='QuotaExceededError'?'浏览器存储空间不足。':''));
  }
}
export function initialState(storage){return readState(storage)??demo();}
