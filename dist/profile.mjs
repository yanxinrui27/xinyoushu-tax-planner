import {KEY} from './storage.mjs';

export const PUBLIC_DEMO_USERNAME='yanxinrui';
export const PUBLIC_DEMO_PASSWORD='12345678';
export const PUBLIC_DEMO_CASE='./demo/default-case.json';
export const PUBLIC_DEMO_SEED_VERSION='2026.10.22-v5.5';
export const PUBLIC_DEMO_SEED_KEY='xinyoushu-public-demo-seed-version';
export const PUBLIC_DEMO_PRIOR_KEY='xinyoushu-public-demo-before-v5.5';
export const PROFILE_PREFIX='xinyoushu-profile-v1:';
export const LEGACY_OWNER_KEY='xinyoushu-profile-migration-owner-v1';

function profileKey(username,key){return `${PROFILE_PREFIX}${encodeURIComponent(username)}:${key}`;}

export function profileStorage(storage,username){
  return {
    getItem:key=>storage.getItem(profileKey(username,key)),
    setItem:(key,value)=>storage.setItem(profileKey(username,key),value),
    removeItem:key=>storage.removeItem(profileKey(username,key))
  };
}

export function assignLegacyOwner(storage,username=PUBLIC_DEMO_USERNAME){
  if(storage.getItem(KEY)!==null&&!storage.getItem(LEGACY_OWNER_KEY))storage.setItem(LEGACY_OWNER_KEY,username);
}

export function migrateLegacyState(storage,profile,username){
  if(storage.getItem(LEGACY_OWNER_KEY)!==username||profile.getItem(KEY)!==null)return false;
  const keys=[KEY,`${KEY}-2026`,`${KEY}-2027`,`${KEY}-before-v2-2026`,`${KEY}-before-v2-2027`,`${KEY}-before-v3-2026`,`${KEY}-before-v3-2027`];
  let copied=false;
  for(const key of keys){const value=storage.getItem(key);if(value!==null){profile.setItem(key,value);copied=true;}}
  return copied;
}
