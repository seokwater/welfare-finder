import { useEffect, useRef, useState } from 'react';
import { analyzeProfile, getAIStatus, searchWithAI } from './api';
const EMPTY_PROFILE = { location: '', age: '', housing: '', employment: '', income: '' };
const FIELD_ORDER = ['location', 'age', 'housing', 'employment', 'income'];
const QUESTIONS = {
  location: { text: '현재 살고 있는 지역을 알려주세요.', choices: ['서울', '경기', '전주', '부산', '직접 입력'] },
  age: { text: '나이도 알려주실 수 있나요?', choices: ['19~24살', '25~29살', '30~34살', '직접 입력'] },
  housing: { text: '현재 어떤 형태로 거주하고 있나요?', choices: ['자취/원룸', '부모님과 거주', '기숙사', '전월세', '직접 입력'] },
  employment: { text: '현재 취업 상태도 알려주세요.', choices: ['취업준비생', '대학생', '재직 중', '프리랜서', '무직'] },
  income: { text: '마지막으로 월 소득도 알려주실 수 있나요?', subtext: '정확한 혜택 추천을 위해 필요해요!', choices: ['소득 없음', '100만원 이하', '100~200만원', '200만원 이상', '직접 입력'] },
};

function Icon({ name, className = '' }) {
  return <svg className={className} aria-hidden="true"><use href={`#${name}`} /></svg>;
}

function SystemStatus({ light = false }) {
  return (
    <div className={light ? 'status-bar' : 'onboarding-status'} aria-label="상태 표시줄">
      <strong>9:41</strong>
      <div className={light ? 'status-icons' : 'onboarding-system'} aria-hidden="true">
        <span className={light ? 'signal' : 'mini-signal'}><i /><i /><i /><i /></span>
        <svg viewBox="0 0 24 18"><path d="M2 6.8C7.8 1.7 16.2 1.7 22 6.8M5.7 10.7a9.6 9.6 0 0 1 12.6 0M9.5 14.2a4 4 0 0 1 5 0" /></svg>
        <span className={light ? 'battery' : 'mini-battery'}><i /></span>
      </div>
    </div>
  );
}

function BottomNav({ active, navigate, wide = false }) {
  const items = [
    ['home', 'home-solid', '홈'],
    ['calendar', 'calendar', '캘린더'],
    ['search', 'search', '검색'],
    ['my', 'person', '마이'],
  ];
  return (
    <nav className={wide ? 'bottom-nav' : 'mobile-bottom-nav'} aria-label="주요 메뉴">
      {items.map(([route, icon, label]) => (
        <button key={label} className={active === label ? 'active' : ''} onClick={() => navigate(route)}>
          <Icon name={icon} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="brand-lockup" aria-label="복지 Finder">
      <svg className="brand-mark" viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="26" cy="26" r="19" />
        <path d="M26 38S14 31.5 14 23.5a7 7 0 0 1 12-4.7 7 7 0 0 1 12 4.7C38 31.5 26 38 26 38Z" />
        <path d="m39 39 11 11" />
      </svg>
      <span>복지 Finder</span>
    </div>
  );
}

function GiftScene() {
  return (
    <div className="gift-scene" aria-label="지원금, 주거, 혜택 선물 일러스트">
      <span className="benefit-chip chip-left">지원금</span><span className="benefit-chip chip-right">주거</span><span className="benefit-chip chip-won">원</span>
      {[1, 2, 3, 4, 5].map((n) => <i className={`confetti c${n}`} key={n} />)}
      <svg className="gift-art" viewBox="0 0 240 170" aria-hidden="true">
        <ellipse cx="120" cy="156" rx="70" ry="8" fill="#dff3e9" stroke="none" />
        <rect x="76" y="82" width="91" height="69" rx="5" fill="#59d391" stroke="none" /><path d="M120 82h47v69h-47Z" fill="#42be7c" stroke="none" />
        <rect x="68" y="71" width="108" height="25" rx="5" fill="#76dda5" stroke="none" /><path d="M116 71h14v80h-14Z" fill="#def8e9" stroke="none" />
        <path d="M123 70c-29-2-38-19-30-28 9-10 26 5 30 28Zm3 0c27-4 36-22 27-30-10-8-24 8-27 30Z" fill="#72dba3" stroke="#38b978" strokeWidth="3" />
        <path d="M103 118c0-8 10-11 15-4 5-7 15-4 15 4 0 9-15 17-15 17s-15-8-15-17Z" fill="#ebfff4" stroke="none" />
        <rect x="43" y="126" width="42" height="29" rx="4" fill="#65aee9" stroke="none" /><rect x="39" y="119" width="50" height="12" rx="3" fill="#86c5f3" stroke="none" />
        <path d="M61 119h7v36h-7Z" fill="#d9f0ff" stroke="none" /><circle cx="56" cy="103" r="20" fill="#c9f2de" stroke="none" />
        <path d="M56 113S45 107 45 99.5a6.5 6.5 0 0 1 11-4.3 6.5 6.5 0 0 1 11 4.3C67 107 56 113 56 113Z" fill="#42bf7e" stroke="none" />
      </svg>
    </div>
  );
}

function Onboarding({ navigate }) {
  return (
    <section className="onboarding-screen" aria-label="복지 Finder 온보딩">
      <div className="onboarding-phone">
        <SystemStatus />
        <div className="onboarding-content">
          <Brand />
          <div className="onboarding-copy"><h1>내 혜택,<br />내가 찾지 않아도.</h1><p>AI가 내 상황을 이해하고<br />받을 수 있는 청년 혜택을<br />찾아드려요.</p></div>
          <button className="start-button" onClick={() => navigate('profile')}>혜택 확인하기</button>
          <GiftScene />
        </div>
      </div>
    </section>
  );
}

function analyzeMessage(message, current) {
  const next = { ...current };
  const compact = message.replace(/\s+/g, ' ').trim();
  const ageRange = compact.match(/(\d{1,2})\s*[~-]\s*(\d{1,2})\s*(?:살|세)/);
  const age = compact.match(/(?:만\s*)?(\d{1,2})\s*(?:살|세)/);
  if (ageRange) next.age = `만 ${ageRange[1]}~${ageRange[2]}세`;
  else if (age) next.age = `만 ${age[1]}세`;
  const locations = ['서울', '경기', '인천', '전주', '부산', '대구', '대전', '광주', '울산', '세종', '제주', '수원', '청주', '천안', '창원'];
  const location = locations.find((name) => compact.includes(name));
  if (location) next.location = location === '전주' ? '전라북도 전주시' : location;
  if (/(자취|원룸|혼자\s*살|1인\s*가구)/.test(compact)) next.housing = '1인가구 / 자취(원룸)';
  else if (/(부모님|본가|가족과)/.test(compact)) next.housing = '부모님과 거주';
  else if (/기숙사/.test(compact)) next.housing = '기숙사';
  else if (/(전세|월세|전월세)/.test(compact)) next.housing = compact.includes('전세') ? '전세 거주' : '월세 거주';
  if (/(취준|취업\s*준비|구직|취업준비생)/.test(compact)) next.employment = '취업준비생';
  else if (/(대학생|재학)/.test(compact)) next.employment = '대학생';
  else if (/(재직|직장인|회사원)/.test(compact)) next.employment = '재직 중';
  else if (/프리랜서/.test(compact)) next.employment = '프리랜서';
  else if (/무직/.test(compact)) next.employment = '무직';
  if (/(소득\s*(?:이\s*)?없|수입\s*(?:이\s*)?없)/.test(compact)) next.income = '소득 없음';
  else if (/100만원\s*이하/.test(compact)) next.income = '100만원 이하';
  else if (/100\s*[~-]\s*200/.test(compact)) next.income = '100~200만원';
  else if (/200만원\s*이상/.test(compact)) next.income = '200만원 이상';
  else {
    const income = compact.match(/(?:월\s*)?(\d{1,4})\s*만\s*원/);
    if (income) next.income = `월 ${income[1]}만원`;
  }
  return next;
}

function ProfileSummary({ profile }) {
  const labels = { location: ['📍', '거주지'], age: ['🎂', '나이'], housing: ['🏠', '주거 형태'], employment: ['💼', '취업 상태'], income: ['💰', '월 소득'] };
  return (
    <div className="profile-summary"><dl>
      {FIELD_ORDER.filter((key) => profile[key]).map((key) => <div key={key}><dt>{labels[key][0]} {labels[key][1]}</dt><dd>{profile[key]}</dd></div>)}
    </dl></div>
  );
}

function ProfileSetup({ navigate, profile, setProfile }) {
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const complete = FIELD_ORDER.every((field) => profile[field]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [turns]);

  async function submit(value) {
    const message = value.trim();
    if (!message || complete || loading) return;
    setInput(''); setLoading(true);
    try {
      const data = await analyzeProfile(message, profile);
      setProfile(data.profile);
      setTurns((current) => [...current, { message, reply: data.reply, snapshot: data.profile, missing: data.missing_field, question: data.question, aiUsed: data.ai_used }]);
    } catch (error) {
      const analyzed = analyzeMessage(message, profile);
      const missing = FIELD_ORDER.find((field) => !analyzed[field]) || null;
      setProfile(analyzed);
      setTurns((current) => [...current, { message, reply: `AI 서버 연결을 확인해주세요. (${error.message})`, snapshot: analyzed, missing, question: missing ? QUESTIONS[missing] : null, aiUsed: false }]);
    } finally { setLoading(false); }
  }

  function selectChoice(choice) {
    if (choice === '직접 입력') { inputRef.current?.focus(); return; }
    submit(choice);
  }

  return (
    <section className="profile-setup" aria-label="AI 프로필 생성">
      <div className="setup-phone">
        <SystemStatus />
        <header className="chat-header"><div className="bot-title"><span className="bot-icon"><i /><b /><b /></span><strong>복지 Finder AI</strong></div><button className="chat-menu" aria-label="메뉴">☰</button></header>
        <div className="chat-scroll" ref={scrollRef} aria-live="polite">
          <div className="chat-message assistant intro-message">요즘 어떤 상황인지<br />편하게 알려주세요 😊</div>
          <div className="example-message"><span>예시</span> 전주 살고 22살에 자취하고 있어요.</div>
          <div className="dynamic-chat">
            {turns.map((turn, index) => (
              <div className="chat-turn" key={`${turn.message}-${index}`}>
                <div className="chat-message user">{turn.message}</div>
                <div className="chat-message assistant">{turn.reply || '말씀해주신 내용을 분석했어요!'}</div>
                <div className={`ai-source ${turn.aiUsed ? 'connected' : 'fallback'}`}>{turn.aiUsed ? 'GPT API로 이해했어요' : '기본 분석 모드'}</div>
                <ProfileSummary profile={turn.snapshot} />
                {turn.missing && index === turns.length - 1 && (() => { const q = turn.question || QUESTIONS[turn.missing]; return <>
                  <div className="chat-message assistant">{q.text}{q.subtext && <><br />{q.subtext}</>}</div>
                  <div className="choice-list">{q.choices.map((choice) => <button key={choice} onClick={() => selectChoice(choice)}>{choice}</button>)}</div>
                </>; })()}
              </div>
            ))}
            {loading && <div className="chat-message assistant ai-thinking">복지 Finder AI가 이해하고 있어요…</div>}
            {complete && <><div className="profile-complete"><strong>✓ 프로필 생성 완료!</strong>민지님에게 맞는 청년 혜택을 확인할 준비가 됐어요.</div><button className="go-profile" onClick={() => navigate('home')}>맞춤 혜택 확인하기</button></>}
          </div>
        </div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
          <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} aria-label="메시지 입력" placeholder="메시지를 입력하세요..." />
          <button type="submit" aria-label="메시지 보내기"><svg viewBox="0 0 24 24"><path d="m5 12 14-7-5 14-2-6-7-1Z" /></svg></button>
        </form>
      </div>
    </section>
  );
}

const policies = [
  { icon: 'building', tone: 'green-bg', title: '청년 월세 지원', amount: '최대 월 20만원', condition: '조건 4/4 충족', status: 'success' },
  { icon: 'briefcase', tone: 'purple-bg', title: '청년 취업지원금', amount: '최대 50만원', condition: '조건 5/5 충족', status: 'success' },
  { icon: 'home', tone: 'orange-bg', title: '청년 생활지원사업', amount: '최대 30만원', condition: '조건 하나 확인 필요', status: 'warning' },
];

function Home({ navigate }) {
  return (
    <main className="mobile-page benefit-home" aria-label="나의 혜택 홈">
      <header className="home-hero"><div className="page-status"><strong>9:41</strong><span>▮▮▮ ⌁ ▰</span></div><h1>👋 안녕하세요, 민지님!</h1><p>조건에 맞는 혜택을 찾아봤어요.</p></header>
      <div className="home-body">
        <button className="estimate-card" onClick={() => navigate('detail')}><span><small>예상 혜택</small><strong>최대 <em>320</em>만원</strong></span><span className="coin-art">🪙</span><Icon name="chevron" /></button>
        <section className="home-section"><div className="home-section-title"><h2>지금 확인할 혜택 (4)</h2><button>전체보기 <Icon name="chevron" /></button></div>
          <div className="home-policy-list">{policies.map((policy) => <button className="home-policy" key={policy.title} onClick={() => navigate('detail')}><span className={`mini-policy-icon ${policy.tone}`}><Icon name={policy.icon} /></span><span className="home-policy-copy"><strong>{policy.title}</strong><small>{policy.amount}</small></span><span className={`condition ${policy.status}`}>{policy.condition}</span></button>)}</div>
        </section>
        <section className="home-section available-section"><div className="home-section-title"><h2>곧 받을 수 있어요 (2)</h2></div><div className="home-policy-list"><button className="home-policy locked" onClick={() => navigate('detail')}><span className="mini-policy-icon blue-bg"><Icon name="home" /></span><span className="home-policy-copy"><strong>청년 주거지원</strong><small>최대 120만원<br />31일 후 조건 충족 예상</small></span><span>🔒</span></button></div></section>
      </div>
      <BottomNav active="홈" navigate={navigate} />
    </main>
  );
}

function eligibilityLabel(status) {
  if (status === 'likely') return '조건 충족 가능성 높음';
  if (status === 'mismatch') return '조건 불일치';
  return '추가 확인 필요';
}
function SearchPage({ navigate, profile, openPolicy }) {
  const [query,setQuery]=useState('');
  const [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(false);
  const [aiStatus,setAIStatus]=useState(null);
  const scrollRef=useRef(null);
  const suggestions=['전주 24살 취준생인데 월세 지원 받고 싶어','취업 준비하면서 받을 수 있는 지원금','청년 전세·보증금 지원 찾아줘'];
  useEffect(()=>{getAIStatus().then(setAIStatus).catch(()=>setAIStatus({enabled:false}))},[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[messages,loading]);
  async function submitSearch(value){
    const text=value.trim(); if(!text||loading)return;
    const prior=messages.map(m=>({role:m.role,content:m.text})).slice(-10);
    setMessages(c=>[...c,{role:'user',text}]); setQuery(''); setLoading(true);
    try{const data=await searchWithAI({query:text,profileContext:profile,history:prior,topK:6,openOnly:true});setMessages(c=>[...c,{role:'assistant',text:data.answer,results:data.results||[],followUp:data.follow_up_question,ai:data.ai}])}
    catch(error){setMessages(c=>[...c,{role:'assistant',text:`검색 중 문제가 생겼어요. ${error.message}`,error:true}])}
    finally{setLoading(false)}
  }
  return (
    <main className="mobile-page ai-search-page" aria-label="복지 Finder AI 검색">
      <header className="search-header">
        <div className="page-status"><strong>9:41</strong><span>▮▮▮ ⌁ ▰</span></div>
        <div className="search-title-row"><div><h1>복지 Finder AI</h1><p>말로 물어보면 내 조건에 맞는 정책을 찾아드려요.</p></div><span className={`gpt-status ${aiStatus?.enabled?'on':'off'}`}>{aiStatus?.enabled?'GPT 연결':'기본 검색'}</span></div>
        <form className="finder-search-box" onSubmit={e=>{e.preventDefault();submitSearch(query)}}><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 전주 24살 취준생 월세 지원"/><button type="submit" disabled={loading}>→</button></form>
      </header>
      <div className="ai-search-body" ref={scrollRef}>
        {messages.length===0&&<><section className="ai-welcome-card"><span className="bot-icon large"><i/><b/><b/></span><div><strong>안녕하세요! 복지 Finder AI예요.</strong><p>자연어로 상황을 말하면 PostgreSQL 정책 데이터에서 후보를 찾고 GPT가 추천 이유를 설명해드려요.</p></div></section><div className="search-suggestions">{suggestions.map(t=><button key={t} onClick={()=>submitSearch(t)}>{t}<span>→</span></button>)}</div>{FIELD_ORDER.some(f=>profile[f])&&<section className="saved-profile-card"><small>저장된 내 조건</small><ProfileSummary profile={profile}/></section>}</>}
        <div className="ai-conversation">
          {messages.map((m,i)=><div className={`ai-search-turn ${m.role}`} key={`${m.role}-${i}`}><div className={`search-bubble ${m.role} ${m.error?'error':''}`}>{m.text}</div>{m.role==='assistant'&&m.ai&&<div className="ai-grounded-note">{m.ai.answer_ai_used?'GPT가 DB 검색 결과를 바탕으로 설명했어요':'기본 검색 결과로 안내했어요'}</div>}{m.results?.length>0&&<div className="ai-policy-results">{m.results.map(r=>{const p=r.policy||{},e=r.eligibility||{},a=r.application||{};return <button className="ai-policy-card" key={p['정책번호']||p['정책명']} onClick={()=>openPolicy(r)}><span className="ai-policy-icon"><Icon name={String(p['정책대분류']||'').includes('일자리')?'briefcase':'building'}/></span><span className="ai-policy-card-copy"><small>{p['정책대분류']} · {a.label||'기간 확인'}</small><strong>{p['정책명']}</strong><p>{p['지원내용']||p['정책설명']||''}</p></span><span className={`ai-eligibility ${e.status||'check'}`}>{eligibilityLabel(e.status)}</span><Icon name="chevron"/></button>})}</div>}{m.followUp&&<button className="follow-up-chip" onClick={()=>setQuery(m.followUp)}>{m.followUp}</button>}</div>)}
          {loading&&<div className="search-bubble assistant thinking"><span/><span/><span/></div>}
        </div>
      </div>
      <BottomNav active="검색" navigate={navigate}/>
    </main>
  );
}
function PolicyDetail({ navigate, toast, policyResult }) {
  const dynamic=Boolean(policyResult?.policy), p=policyResult?.policy||{}, e=policyResult?.eligibility||{}, a=policyResult?.application||{}, criteria=e.criteria||[];
  const title=dynamic?p['정책명']:'청년 월세 지원';
  const detailUrl=p.detail_url||p['신청URL']||p['참고URL1']||p['참고URL2'];
  return (
    <main className="mobile-page policy-detail" aria-label="정책 상세 및 자격 분석">
      <header className="detail-header"><button onClick={()=>navigate(dynamic?'search':'home')}>←</button><h1>{title}</h1><button className="share-button"><svg viewBox="0 0 24 24"><path d="M12 16V3m0 0L8 7m4-4 4 4M5 11v9h14v-9"/></svg></button></header>
      <div className="detail-body">
        <section className={`eligibility-banner ${e.status==='mismatch'?'is-mismatch':''}`}><span className="check-badge">{e.status==='mismatch'?'!':'✓'}</span><div><strong>{dynamic?eligibilityLabel(e.status):'받을 가능성이 높아요!'}</strong><small>{dynamic?`충족 ${e.pass_count||0} · 확인 ${e.unknown_count||0} · 불일치 ${e.fail_count||0}`:'조건 4/4 충족'}</small></div></section>
        <section className="detail-section"><h2>왜 추천했나요?</h2><div className="qualification-table">{dynamic?(criteria.length?criteria.map(c=><div key={c.criterion}><span>{c.criterion}</span><strong className={c.status}>{c.status==='pass'?'✓ 충족':c.status==='fail'?'✕ 불일치':'△ 확인 필요'} <small>{c.policy_rule||c.reason}</small></strong></div>):<div><span>자격 조건</span><strong>상세 공고 확인 필요</strong></div>):<><div><span>♙ 나이 조건</span><strong>✓ 충족 <small>(만 19~34세)</small></strong></div><div><span>⌂ 거주지 조건</span><strong>✓ 충족 <small>(전주시)</small></strong></div><div><span>⌂ 주거 형태</span><strong>✓ 충족 <small>(무주택/월세 거주)</small></strong></div><div><span>♙ 소득 조건</span><strong>✓ 충족 <small>(중위소득 60% 이하)</small></strong></div></>}</div></section>
        <section className="detail-section text-detail"><h2>지원 내용</h2><p>{dynamic?(p['지원내용']||p['정책설명']||'원문 공고에서 확인해주세요.'):<><span>월 최대 20만원씩 최대 12개월 지원</span><br/>(생애 1회)</>}</p></section>
        <section className="detail-section"><h2>신청 정보</h2><div className="info-table"><div><span>신청 기간</span><b>{dynamic?(a.period||p['신청기간_정리']||a.label||'기간 확인 필요'):'2024.08.01 ~ 2024.08.31 (D-17)'}</b></div><div><span>신청 방법</span><b>{dynamic?(p['신청방법']||'공고 확인'):'온라인 신청 (복지로)'}</b></div><div><span>대상 지역</span><b>{dynamic?(p['정책거주지역요약']||p['정책거주지역명_현재기준']||'공고 확인'):'전주시'}</b></div></div></section>
        <section className="detail-section"><h2>필요 서류</h2>{dynamic?<p className="document-text">{p['제출서류']||'정책 원문에서 제출서류를 확인해주세요.'}</p>:<div className="document-list"><div><span>▤</span><small>주민등록등본</small></div><div><span>▤</span><small>임대차계약서</small></div><div><span>▤</span><small>소득확인서류</small></div></div>}</section>
        <button className="apply-button" onClick={()=>detailUrl?window.open(detailUrl,'_blank','noopener,noreferrer'):toast('공식 신청 URL은 원문 데이터에서 확인해주세요.')}>공식 신청 페이지로 이동 ↗</button>
      </div>
    </main>
  );
}

const events = [
  ['12일', '(월)', '📣', 'blue-bg', '청년 창업지원사업', '신청 시작'],
  ['18일', '(일)', '◷', 'red-bg', '청년 취업지원금', '신청 마감 (D-3)'],
  ['27일', '(화)', '✓', 'green-bg', '청년 주거지원', '거주기간 조건 충족 예상'],
  ['31일', '(토)', '♟', 'yellow-bg', '청년 문화·여가지원', '신청 마감'],
];

function Calendar({ navigate }) {
  return (
    <main className="mobile-page benefit-calendar" aria-label="혜택 캘린더">
      <header className="calendar-header"><button aria-label="이전 달">‹</button><h1>8월</h1><button aria-label="다음 달">›</button></header>
      <div className="calendar-body"><div className="weekdays">{'일월화수목금토'.split('').map((day) => <span key={day}>{day}</span>)}</div><div className="dates">{[11, 12, 13].map((date) => <span key={date}>{date}</span>)}<strong>14</strong>{[15, 16, 17].map((date) => <span key={date}>{date}</span>)}</div>
        <div className="calendar-events">{events.map(([date, day, symbol, tone, title, description]) => <button key={date} onClick={() => navigate('detail')}><b>{date}<br /><small>{day}</small></b><span className={`event-icon ${tone}`}>{symbol}</span><span><strong>{title}</strong><small className={date === '27일' ? 'green-text' : ''}>{description}</small>{date === '27일' && <small>알림 설정 완료</small>}</span><Icon name="chevron" /></button>)}</div>
      </div>
      <BottomNav active="캘린더" navigate={navigate} />
    </main>
  );
}

function MyPage({ navigate, toast }) {
  const [toggles, setToggles] = useState([true, true, true]);
  const alerts = [
    ['bell', 'mint-bg', '새로운 맞춤 정책 알림', '나에게 맞는 새로운 정책이 등록되면 알려드려요.'],
    ['clock', 'lilac-bg', '신청 마감 임박 알림', '관심 있는 정책의 신청 마감일을 알려드려요.'],
    ['refresh', 'blue-bg', '정책 조건 변경 알림', '관심 있는 정책의 조건이 변경되면 알려드려요.'],
  ];
  return (
    <main className="app-shell app-main">
      <div className="my-scroll">
        <header className="hero"><SystemStatus light /><div className="title-row"><h1>마이</h1><button className="icon-button" onClick={() => toast('설정 메뉴를 준비 중이에요.')}><Icon name="gear" /></button></div></header>
        <div className="content">
        <section className="profile card"><div className="portrait-placeholder"><svg viewBox="0 0 100 100"><circle cx="50" cy="37" r="17" /><path d="M21 89c2-23 13-35 29-35s27 12 29 35" /></svg><span>사진</span></div><div className="profile-body"><div className="profile-head"><div className="name-line"><h2>민지님</h2><span className="youth-badge"><Icon name="person" />청년</span></div><button className="edit-button" onClick={() => toast('정보 수정 화면을 준비 중이에요.')}><Icon name="edit" />정보 수정</button></div><div className="facts"><span><Icon name="pin" />전라북도 전주시</span><span><Icon name="cake" />24세</span><span><Icon name="person" />취업준비생</span></div><div className="updated"><Icon name="calendar" /><p>내 정보가 마지막으로 업데이트 된 날짜<br /><strong>2024.08.10</strong></p></div></div></section>
        <section className="section policies"><div className="section-heading"><h2>찜한 정책</h2><button className="see-all">전체보기 <Icon name="chevron" /></button></div><div className="card list-card policy-list">{policies.map((policy, index) => <article className="policy-row" key={policy.title} role="button" tabIndex="0" onClick={() => navigate('detail')}><Icon name="bookmark" className={`bookmark ${['green', 'purple', 'orange'][index]}`} /><div className={`round-icon ${policy.tone}`}><Icon name={policy.icon} /></div><div className="policy-copy"><h3>{policy.title}</h3><p>{policy.amount}</p></div><span className={`condition ${policy.status}`}>{policy.condition}</span><Icon name="chevron" className="row-chevron" /></article>)}</div></section>
        <section className="section notifications"><div className="section-heading"><h2>정책 알림 설정</h2></div><div className="card list-card">{alerts.map(([icon, tone, title, copy], index) => <div className="setting-row" key={title}><div className={`round-icon ${tone}`}><Icon name={icon} /></div><div className="setting-copy"><h3>{title}</h3><p>{copy}</p></div><button className={`toggle ${toggles[index] ? 'is-on' : ''}`} role="switch" aria-checked={toggles[index]} onClick={() => setToggles((current) => current.map((value, i) => i === index ? !value : value))} /></div>)}</div></section>
        <section className="section settings"><div className="section-heading"><h2>설정</h2></div><div className="card list-card compact-list">{[['person', '개인정보 관리'], ['shield', '앱 설정'], ['headset', '문의하기']].map(([icon, label]) => <button className="menu-row" key={label} onClick={() => toast(`${label} 메뉴를 준비 중이에요.`)}><Icon name={icon} /><span>{label}</span><Icon name="chevron" className="row-chevron" /></button>)}</div></section>
        </div>
      </div>
      <BottomNav active="마이" navigate={navigate} wide />
    </main>
  );
}

function Symbols() {
  return (
    <svg className="svg-defs" aria-hidden="true"><defs>
      <symbol id="chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></symbol><symbol id="person" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" /><path d="M4.5 21c.8-5.1 3.3-7.5 7.5-7.5s6.7 2.4 7.5 7.5" /></symbol><symbol id="pin" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" fill="white" /></symbol>
      <symbol id="cake" viewBox="0 0 24 24"><path d="M4 10h16v10H4zM3 14h18M8 10V7m4 3V6m4 4V7" /><path d="M7 6c0-1 1-2 1-2s1 1 1 2M11 5c0-1 1-2 1-2s1 1 1 2M15 6c0-1 1-2 1-2s1 1 1 2" /></symbol><symbol id="calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M8 14h3m2 0h3m-8 3h3" /></symbol><symbol id="edit" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20ZM14.7 5.8l2.5-2.5 3.5 3.5-2.5 2.5" /></symbol>
      <symbol id="bookmark" viewBox="0 0 24 30"><path d="M4 2h16a2 2 0 0 1 2 2v24l-10-6-10 6V4a2 2 0 0 1 2-2Z" /></symbol><symbol id="building" viewBox="0 0 24 24"><path d="M4 21V9h6v12m4 0V4h6v17M2 21h20M6 12h2m-2 4h2m8-9h2m-2 4h2m-2 4h2" /></symbol><symbol id="briefcase" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="13" rx="2" /><path d="M9 7V4h6v3M2 12h20m-12-2v5h4v-5" /></symbol>
      <symbol id="home" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z" /></symbol><symbol id="home-solid" viewBox="0 0 24 24"><path d="m2 11 10-9 10 9-2 2-1-1v9h-5v-6h-4v6H5v-9l-1 1-2-2Z" /></symbol><symbol id="bell" viewBox="0 0 24 24"><path d="M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4l-2 3Zm5 3h4" /></symbol><symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 3" /></symbol>
      <symbol id="refresh" viewBox="0 0 24 24"><path d="M20 8V3l-2 2a8 8 0 0 0-13 3M4 16v5l2-2a8 8 0 0 0 13-3M20 3h-5M4 21h5" /></symbol><symbol id="shield" viewBox="0 0 24 24"><path d="M12 2 21 6v6c0 5.5-3.8 8.8-9 10-5.2-1.2-9-4.5-9-10V6l9-4Z" /><path d="m9 12 2 2 4-5" stroke="white" /></symbol><symbol id="headset" viewBox="0 0 24 24"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v5h4v-5H4Zm16 0h2v5h-4v-5h2Zm0 5c0 2-2 3-5 3" /></symbol>
      <symbol id="heart" viewBox="0 0 24 24"><path d="M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z" /></symbol><symbol id="search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" /><path d="m15.5 15.5 5 5" fill="none" /></symbol><symbol id="gear" viewBox="0 0 24 24"><path d="m9.7 2-.5 2a8 8 0 0 0-1.8 1L5.5 4.4 3.8 6.2l.7 1.9a8 8 0 0 0-.8 1.9l-2 .5V13l2 .5a8 8 0 0 0 .8 1.9l-.7 1.9 1.8 1.8 1.9-.7a8 8 0 0 0 1.8.8l.5 2h2.5l.5-2a8 8 0 0 0 1.9-.8l1.9.7 1.8-1.8-.7-1.9a8 8 0 0 0 .8-1.9l2-.5v-2.5l-2-.5a8 8 0 0 0-.8-1.9l.7-1.9-1.8-1.8-1.9.7a8 8 0 0 0-1.9-.8l-.5-2H9.7Z" /><circle cx="11" cy="11.7" r="3" fill="#18a661" /></symbol>
    </defs></svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [motion, setMotion] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [userProfile, setUserProfile] = useState(EMPTY_PROFILE);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const toastTimer = useRef(null);
  const transitionTimer = useRef(null);

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(transitionTimer.current); }, []);
  function navigate(next) {
    if (next === screen || motion) return;
    if (next === 'home') setSelectedPolicy(null);
    setMotion('react-leaving');
    transitionTimer.current = setTimeout(() => {
      setScreen(next);
      setMotion('react-entering');
      window.scrollTo({ top: 0, behavior: 'auto' });
      transitionTimer.current = setTimeout(() => setMotion(''), 320);
    }, 180);
  }

  function openPolicy(result) { setSelectedPolicy(result); navigate('detail'); }

  function toast(message) {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => setToastMessage(''), 1600);
  }

  const screens = {
    onboarding: <Onboarding navigate={navigate} />,
    profile: <ProfileSetup navigate={navigate} profile={userProfile} setProfile={setUserProfile} />,
    home: <Home navigate={navigate} />,
    search: <SearchPage navigate={navigate} profile={userProfile} openPolicy={openPolicy} />,
    detail: <PolicyDetail navigate={navigate} toast={toast} policyResult={selectedPolicy} />,
    calendar: <Calendar navigate={navigate} />,
    my: <MyPage navigate={navigate} toast={toast} />,
  };

  return <><div className={`react-screen ${motion}`}>{screens[screen]}</div><div className={`toast ${toastMessage ? 'show' : ''}`} role="status">{toastMessage}</div><Symbols /></>;
}
