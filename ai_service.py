from __future__ import annotations
import json, os, re
from dataclasses import asdict
from typing import Any, Optional
from openai import OpenAI
from search_engine import UserProfile, YouthPolicySearchEngine

OPENAI_MODEL=os.getenv('OPENAI_MODEL','gpt-5-mini')
PROFILE_FIELDS=['location','age','housing','employment','income']
PROFILE_QUESTIONS={
 'location':{'text':'현재 살고 있는 지역을 알려주세요.','choices':['서울','경기','전주','부산','직접 입력']},
 'age':{'text':'나이도 알려주실 수 있나요?','choices':['19~24살','25~29살','30~34살','직접 입력']},
 'housing':{'text':'현재 어떤 형태로 거주하고 있나요?','choices':['자취/원룸','부모님과 거주','기숙사','전월세','직접 입력']},
 'employment':{'text':'현재 취업 상태도 알려주세요.','choices':['취업준비생','대학생','재직 중','프리랜서','무직']},
 'income':{'text':'마지막으로 월 소득도 알려주실 수 있나요?','subtext':'정확한 혜택 추천을 위해 필요해요!','choices':['소득 없음','100만원 이하','100~200만원','200만원 이상','직접 입력']},
}
ALLOWED_INTENTS=['주거','취업','창업','교육','금융','문화','건강']

def ai_enabled(): return bool(os.getenv('OPENAI_API_KEY','').strip())
def _client():
    key=os.getenv('OPENAI_API_KEY','').strip(); return OpenAI(api_key=key) if key else None

def _json(text:str):
    text=(text or '').strip(); text=re.sub(r'^```(?:json)?\s*|\s*```$','',text)
    try: return json.loads(text)
    except json.JSONDecodeError:
        m=re.search(r'\{.*\}',text,re.S)
        if not m: raise
        return json.loads(m.group(0))

def _gpt(instructions:str,payload:dict[str,Any]):
    client=_client()
    if client is None: raise RuntimeError('OPENAI_API_KEY가 설정되지 않았습니다.')
    r=client.responses.create(model=OPENAI_MODEL,instructions=instructions,input=json.dumps(payload,ensure_ascii=False),store=False)
    return _json(r.output_text)

def _norm_profile(p): return {k:str((p or {}).get(k) or '').strip() for k in PROFILE_FIELDS}

def _fallback_profile(message,current):
    p=_norm_profile(current); t=re.sub(r'\s+',' ',message)
    m=re.search(r'(?:만\s*)?(\d{1,2})\s*(?:살|세)',t)
    if m:p['age']=f'만 {m.group(1)}세'
    for loc in ['서울','경기','인천','전주','부산','대구','대전','광주','울산','세종','제주','수원','청주','천안','창원']:
        if loc in t:p['location']=loc;break
    if re.search(r'자취|원룸|혼자\s*살|1인\s*가구',t):p['housing']='1인가구 / 자취(원룸)'
    elif re.search(r'부모님|본가|가족과',t):p['housing']='부모님과 거주'
    elif '기숙사' in t:p['housing']='기숙사'
    elif re.search(r'전세|월세|전월세',t):p['housing']='월세 거주' if '월세' in t else '전세 거주'
    if re.search(r'취준|취업\s*준비|구직|취업준비생',t):p['employment']='취업준비생'
    elif re.search(r'대학생|재학',t):p['employment']='대학생'
    elif re.search(r'재직|직장인|회사원',t):p['employment']='재직 중'
    elif '프리랜서' in t:p['employment']='프리랜서'
    elif '무직' in t:p['employment']='무직'
    if re.search(r'소득\s*(?:은|이)?\s*없|수입\s*(?:은|이)?\s*없',t):p['income']='소득 없음'
    else:
        m=re.search(r'(?:월\s*)?(\d{1,4})\s*만\s*원',t)
        if m:p['income']=f'월 {m.group(1)}만원'
    return p

def analyze_profile_turn(message,current_profile):
    base=_norm_profile(current_profile); used=False; error=None
    try:
        data=_gpt("너는 한국 청년 복지 서비스 '복지 Finder AI'의 프로필 인터뷰 도우미다. 사용자의 문장에서 프로필을 갱신한다. 과도하게 추론하지 않는다. 기존 값은 새 정보가 명백할 때만 덮어쓴다. 반드시 JSON만 출력한다: {\"profile\":{\"location\":\"\",\"age\":\"\",\"housing\":\"\",\"employment\":\"\",\"income\":\"\"},\"reply\":\"짧은 한국어 응답\"}",{'message':message,'current_profile':base})
        p=_norm_profile(data.get('profile',{}))
        for k in PROFILE_FIELDS:
            if not p[k] and base[k]:p[k]=base[k]
        reply=str(data.get('reply') or '말씀해주신 내용을 이해했어요.').strip();used=True
    except Exception as exc:
        p=_fallback_profile(message,base);reply='말씀해주신 내용을 분석했어요.';error=f'{type(exc).__name__}: {exc}'
    missing=next((k for k in PROFILE_FIELDS if not p[k]),None);complete=missing is None
    if complete:
        reply='프로필을 완성했어요. 이제 조건에 맞는 청년 혜택을 찾아볼 수 있어요.'
    elif missing:
        next_question=PROFILE_QUESTIONS[missing]['text']
        if not used:
            reply=next_question
        elif next_question not in reply:
            reply=f"{reply}\n\n{next_question}"
    return {'reply':reply,'profile':p,'missing_field':missing,'complete':complete,'question':PROFILE_QUESTIONS.get(missing) if missing else None,'ai_used':used,'model':OPENAI_MODEL if used else None,'error':error}

def _fallback_plan(query,profile):
    profile_text=' '.join(str(v) for v in profile.values() if v)
    t=f"{query} {profile_text}"
    age=re.search(r'(?:만\s*)?(\d{1,2})\s*(?:살|세)',t);inc=re.search(r'(?:월\s*)?(\d{1,4})\s*만원',t)
    emp='미취업자' if re.search(r'취준|취업준비|구직|무직',t) else ('재직자' if re.search(r'재직|직장인|회사원',t) else ('프리랜서' if '프리랜서' in t else None))
    terms={'주거':['주거','월세','전세','보증금','주택','임대'],'취업':['취업','일자리','구직','면접','채용'],'창업':['창업','사업'],'교육':['교육','자격증','훈련','학비'],'금융':['대출','금융','저축','이자'],'문화':['문화','공연','여가'],'건강':['건강','병원','심리','상담']}
    # 사용자의 취업 상태 같은 프로필 표현을 검색 의도로 오인하지 않는다.
    intent_text=query
    for profile_term in ('미취업자','미취업','취업준비생','취업준비','취준생','취준'):
        intent_text=intent_text.replace(profile_term,' ')
    intents=[k for k,vs in terms.items() if any(v in intent_text for v in vs)]
    return {'search_query':query,'intents':intents,'age':int(age.group(1)) if age else None,'region':profile.get('location') or None,'employment':emp,'education':None,'marital_status':None,'annual_income_manwon':int(inc.group(1))*12 if inc else None,'median_income_percent':None}

def _plan(query,profile,history):
    fb=_fallback_plan(query,profile)
    try:
        data=_gpt("너는 한국 청년 복지 정책 검색 쿼리 분석기다. 요청과 저장 프로필을 구조화한다. 자격을 임의로 확정하지 않는다. intents는 주거,취업,창업,교육,금융,문화,건강 중에서만 고른다. employment는 미취업자, 재직자, (예비)창업자, 자영업자, 프리랜서, 일용근로자, 단기근로자, 영농종사자 중 하나 또는 null. 반드시 JSON만 출력한다: {\"search_query\":\"\",\"intents\":[],\"age\":null,\"region\":null,\"employment\":null,\"education\":null,\"marital_status\":null,\"annual_income_manwon\":null,\"median_income_percent\":null}",{'query':query,'profile_context':profile,'recent_history':history[-6:]})
        plan={**fb,**{k:v for k,v in data.items() if k in fb}};plan['intents']=[x for x in (plan.get('intents') or []) if x in ALLOWED_INTENTS];return plan,True,None
    except Exception as exc:return fb,False,f'{type(exc).__name__}: {exc}'

def _compact(item):
    p=item.get('policy',{});e=item.get('eligibility',{});a=item.get('application',{})
    return {'policy_number':p.get('정책번호'),'name':p.get('정책명'),'category':p.get('정책대분류'),'support':p.get('지원내용') or p.get('정책설명'),'region':p.get('정책거주지역요약'),'age_rule':p.get('연령조건'),'income_rule':p.get('소득조건요약'),'employment_rule':p.get('취업요건'),'application':a,'eligibility_status':e.get('status'),'eligibility_reasons':e.get('criteria',[])}

def _answer(query,plan,candidates):
    if not candidates:return '조건에 맞는 정책을 찾지 못했어요. 지역이나 나이를 더 알려주세요.',[],None,False,None
    fallback=f"'{query}' 조건으로 관련도가 높은 정책을 찾았어요. 자격 분석과 원문 공고를 함께 확인해 주세요."
    try:
        d=_gpt("너는 '복지 Finder AI'다. candidate_policies 안의 사실만 사용한다. 정책/금액/자격/기간을 지어내지 않는다. eligibility_status가 check이면 확정적으로 받을 수 있다고 말하지 않는다. 2~4문장으로 설명한다. 반드시 JSON만 출력한다: {\"answer\":\"\",\"policy_numbers\":[],\"follow_up_question\":null}",{'user_query':query,'search_plan':plan,'candidate_policies':[_compact(x) for x in candidates]})
        return str(d.get('answer') or fallback),[str(x) for x in d.get('policy_numbers',[]) if x is not None],str(d.get('follow_up_question') or '').strip() or None,True,None
    except Exception as exc:return fallback,[],None,False,f'{type(exc).__name__}: {exc}'

def ai_policy_search(engine:YouthPolicySearchEngine,*,query:str,profile_context:Optional[dict[str,Any]]=None,history:Optional[list[dict[str,str]]]=None,top_k:int=6,open_only:bool=True):
    query=(query or '').strip()
    if not query:raise ValueError('검색어를 입력해주세요.')
    profile_context=profile_context or {};history=history or []
    plan,pu,pe=_plan(query,profile_context,history)
    profile=UserProfile(age=plan.get('age'),region=plan.get('region'),employment=plan.get('employment'),marital_status=plan.get('marital_status'),education=plan.get('education'),annual_income_manwon=plan.get('annual_income_manwon'),median_income_percent=plan.get('median_income_percent'))
    q=' '.join(x for x in [plan.get('search_query'),' '.join(plan.get('intents') or [])] if x)
    candidates=engine.search(query=q,profile=profile,top_k=max(top_k*2,10),open_only=open_only,eligible_only=False).get('results',[])
    answer,order,follow,au,ae=_answer(query,plan,candidates)
    by={str(x.get('policy',{}).get('정책번호')):x for x in candidates};final=[];seen=set()
    for n in order:
        if n in by and n not in seen:final.append(by[n]);seen.add(n)
    for x in candidates:
        n=str(x.get('policy',{}).get('정책번호'))
        if n not in seen:final.append(x);seen.add(n)
    return {'query':query,'answer':answer,'follow_up_question':follow,'search_plan':plan,'parsed_profile':asdict(profile),'results':final[:top_k],'count':min(len(final),top_k),'ai':{'enabled':ai_enabled(),'model':OPENAI_MODEL if ai_enabled() else None,'plan_ai_used':pu,'answer_ai_used':au,'fallback_used':not(pu and au),'errors':[x for x in [pe,ae] if x]}}
