const API_BASE=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
async function req(path,options={}){const r=await fetch(`${API_BASE}${path}`,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});if(!r.ok){let d=`HTTP ${r.status}`;try{const b=await r.json();d=b.detail||d}catch{}throw new Error(d)}return r.json()}
export const getAIStatus=()=>req('/api/ai/status');
export const analyzeProfile=(message,currentProfile)=>req('/api/ai/profile',{method:'POST',body:JSON.stringify({message,current_profile:currentProfile})});
export const searchWithAI=({query,profileContext,history=[],topK=6,openOnly=true})=>req('/api/ai/search',{method:'POST',body:JSON.stringify({query,profile_context:profileContext,history,top_k:topK,open_only:openOnly})});
