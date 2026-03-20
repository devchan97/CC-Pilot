// ── 세션 상태 ──────────────────────────────────────────────────────────────────
const sessions = {};

// ── WebSocket ──────────────────────────────────────────────────────────────────
function connectWS(sid){
  const proto=location.protocol==='https:'?'wss':'ws';
  const ws=new WebSocket(`${proto}://${location.host}/ws/${sid}`);
  sessions[sid].ws=ws;
  ws.onopen=()=>{ws.send(JSON.stringify({type:'heartbeat'}));setSl(sid,t('ws.connecting'));};
  ws.onmessage=evt=>{
    let msg;try{msg=JSON.parse(evt.data);}catch{return;}
    const s=sessions[msg.session_id||sid];if(!s)return;
    handleMsg(msg.session_id||sid,s,msg);
  };
  ws.onclose=()=>{
    if(!sessions[sid])return;
    sessions[sid].verified=false;setDot(sid,'err');setSl(sid,t('ws.disconnected'));
    if(_detailSid===sid){document.getElementById('ta-detail').disabled=true;document.getElementById('send-detail').disabled=true;}
  };
}

function handleMsg(sid,s,msg){
  if(msg.type==='connected'){
    s.verified=true;s.status=msg.status||s.status;
    setDot(sid,'ok');setSl(sid,renderSlHtml(s.status));
    if(_detailSid===sid){
      document.getElementById('detail-dot').className='detail-dot ok';
      document.getElementById('detail-sl').innerHTML=renderSlHtml(s.status);
      document.getElementById('ta-detail').disabled=false;document.getElementById('send-detail').disabled=false;
      setTimeout(()=>{if(_detailSid===sid)document.getElementById('ta-detail').focus();},50);
    }
    // Backlog 상태에서는 init_prompt 전송 보류 (In Progress 이동 시 전송)
    if(_pendingInitPrompts[sid] && s.phase !== 'backlog'){
      const ip=_pendingInitPrompts[sid];delete _pendingInitPrompts[sid];
      setTimeout(()=>{if(s.ws&&s.ws.readyState===WebSocket.OPEN&&s.verified){pushLog(sid,{role:'user',text:ip});s.ws.send(JSON.stringify({type:'input',data:ip}));setInputBusy(sid,true);}},300);
    }
    return;
  }
  if(msg.type==='slash_commands'){registerCmds(msg.commands||[]);return;}
  if(msg.type==='status'){
    s.status=msg.status;const html=renderSlHtml(msg.status);setSl(sid,html);
    if(_detailSid===sid)document.getElementById('detail-sl').innerHTML=html;
    document.getElementById('card-'+sid)?.classList.toggle('thinking',!!msg.status.thinking);
    setDot(sid,msg.status.thinking?'busy':'ok');
    updateSidebarUsage();
    return;
  }
  if(msg.type==='cleared'){
    s.chatLog=[];s.aiEl=null;s.aiBuf='';s.lastResponse='';
    pushLog(sid,{role:'sys',text:t('ws.cleared')});updatePreview(sid);
    if(_detailSid===sid){const chat=document.getElementById('detail-chat');if(chat)chat.innerHTML='';appendDetailSys(t('ws.cleared'));}
    return;
  }
  if(msg.type==='sys_notice'){
    if(s.aiEl)finalizeAiEl(sid,s);
    pushLog(sid,{role:'sys',text:msg.message});
    if(_detailSid===sid){appendDetailSys(msg.message);scrollDetailBottom();}
    return;
  }
  if(msg.type==='phase'){return;}
  if(msg.type==='tool_use'){
    if(s.aiEl)finalizeAiEl(sid,s);
    pushLog(sid,{type:'tool',name:msg.name,summary:msg.summary});
    if(_detailSid===sid){const chat=document.getElementById('detail-chat');renderLogEntry(chat,{type:'tool',name:msg.name,summary:msg.summary},sid);scrollDetailBottom();}
    return;
  }
  if(msg.type==='thinking'){
    if(s.aiEl)finalizeAiEl(sid,s);
    if(msg.data){pushLog(sid,{type:'thinking',text:msg.data});if(_detailSid===sid){const chat=document.getElementById('detail-chat');renderLogEntry(chat,{type:'thinking',text:msg.data},sid);scrollDetailBottom();}}
    return;
  }
  if(msg.type==='output'){
    if(!s.aiEl){
      s.aiBuf='';
      if(_detailSid===sid){
        const chat=document.getElementById('detail-chat');
        const wrap=document.createElement('div');wrap.className='msg ai';
        const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent='Claude';wrap.appendChild(lbl);
        const b=document.createElement('div');b.className='bubble streaming';wrap.appendChild(b);chat.appendChild(wrap);s.aiEl=b;
      } else {s.aiEl={_virtual:true,textContent:''};}
    }
    s.aiBuf+=msg.data;
    if(s.aiEl._virtual){s.aiEl.textContent=s.aiBuf;}else{s.aiEl.textContent=s.aiBuf;scrollDetailBottom();}
    return;
  }
  if(msg.type==='done'){
    if(s.aiEl){const text=s.aiBuf;if(!s.aiEl._virtual)s.aiEl.classList.remove('streaming');s.lastResponse=text;pushLog(sid,{role:'ai',text});s.aiEl=null;s.aiBuf='';updatePreview(sid);}
    setInputBusy(sid,false);
    if(_detailSid===sid){document.getElementById('ta-detail').disabled=false;document.getElementById('send-detail').disabled=false;scrollDetailBottom();}
    // InProgress 상태에서 목표 달성 감지 → 자동 Done 이동
    if(s.phase==='inprogress' && s.lastResponse){
      checkAutoComplete(sid,s.lastResponse);
    }
    return;
  }
  if(msg.type==='error'){
    if(s.aiEl)finalizeAiEl(sid,s);
    pushLog(sid,{role:'sys',text:t('ws.error')+msg.message});
    if(_detailSid===sid){appendDetailSys(t('ws.error')+msg.message);scrollDetailBottom();}
    setInputBusy(sid,false);
    if(_detailSid===sid){document.getElementById('ta-detail').disabled=false;document.getElementById('send-detail').disabled=false;}
    return;
  }
  if(msg.type==='usage_limit'){
    if(s.aiEl)finalizeAiEl(sid,s);
    const resetText = msg.reset_time ? ` (${t('err.usage_limit_reset')}: ${msg.reset_time})` : '';
    const text = `${t('err.usage_limit')}${resetText}\n\n${msg.message}`;
    pushLog(sid,{role:'sys',text});
    if(_detailSid===sid){appendDetailSys(text);scrollDetailBottom();}
    setInputBusy(sid,false);
    if(_detailSid===sid){document.getElementById('ta-detail').disabled=false;document.getElementById('send-detail').disabled=false;}
    return;
  }
}

function finalizeAiEl(sid,s){
  if(!s.aiEl)return;
  if(!s.aiEl._virtual)s.aiEl.classList.remove('streaming');
  const text=s.aiBuf;s.lastResponse=text||s.lastResponse;
  if(text)pushLog(sid,{role:'ai',text});s.aiEl=null;s.aiBuf='';updatePreview(sid);
}
function pushLog(sid,entry){
  const s=sessions[sid];if(!s)return;s.chatLog.push(entry);
  if(_detailSid===sid){const chat=document.getElementById('detail-chat');if(chat){renderLogEntry(chat,entry,sid);scrollDetailBottom();}}
}
function appendDetailSys(text){
  const chat=document.getElementById('detail-chat');if(!chat)return;
  const wrap=document.createElement('div');wrap.className='msg sys';
  const b=document.createElement('div');b.className='bubble';b.textContent=text;wrap.appendChild(b);chat.appendChild(wrap);
}
function scrollDetailBottom(){const c=document.getElementById('detail-chat');if(c)c.scrollTop=c.scrollHeight;}

// ── send ───────────────────────────────────────────────────────────────────────
function sendMsg(sid, inputId){
  const s=sessions[sid];
  if(!s||!s.verified||!s.ws||s.ws.readyState!==WebSocket.OPEN)return;
  const taId=inputId==='detail'?'ta-detail':'ta-'+sid;
  const btnId=inputId==='detail'?'send-detail':'send-'+sid;
  const ta=document.getElementById(taId);
  const text=ta.value.trim();if(!text)return;
  const isCmd=text.startsWith('/');
  if(s.aiEl)finalizeAiEl(sid,s);
  const UNSUP={'/help':'ℹ /help는 interactive 모드 전용입니다.','/model':'ℹ /model은 세션 생성 시 모델 선택으로 변경하세요.'};
  const cmd0=text.split(' ')[0];
  if(isCmd&&UNSUP[cmd0]){pushLog(sid,{role:'cmd',text});resetInputEl(ta,document.getElementById(btnId));pushLog(sid,{role:'sys',text:UNSUP[cmd0]});return;}
  if(isCmd&&cmd0==='/clear'){pushLog(sid,{role:'cmd',text});resetInputEl(ta,document.getElementById(btnId));closeDropdown(inputId==='detail'?'detail':sid);s.ws.send(JSON.stringify({type:'clear'}));return;}
  pushLog(sid,{role:isCmd?'cmd':'user',text});
  s.ws.send(JSON.stringify({type:'input',data:text}));
  setInputBusy(sid,true);resetInputEl(ta,document.getElementById(btnId));closeDropdown(inputId==='detail'?'detail':sid);
}
function resetInputEl(ta,btn){
  if(ta){ta.value='';ta.style.height='auto';ta.classList.remove('is-cmd');}
  if(btn){btn.classList.remove('is-cmd');btn.textContent='↑';}
}
function setInputBusy(sid,busy){
  setDot(sid,busy?'busy':'ok');
  if(_detailSid===sid){document.getElementById('ta-detail').disabled=busy;document.getElementById('send-detail').disabled=busy;}
}

// ── statusline ─────────────────────────────────────────────────────────────────
function renderSlHtml(st){
  if(!st)return t('ws.ready');
  const pct=st.ctx_pct||0,bw=6,filled=Math.min(bw,Math.floor(pct*bw/100)),empty=bw-filled;
  const bc=pct>=75?'c-red':pct>=50?'c-yellow':'c-green';
  const bar=`<span class="${bc}" style="letter-spacing:-1px">${'▓'.repeat(filled)}${'░'.repeat(empty)}</span>`;
  const sep='<span class="c-gray"> | </span>';
  const ctxTok=st.ctx_tokens||0,outTok=st.total_output_tokens||0;
  const parts=[
    st.model?`<span class="c-cyan">${esc(st.model.replace('claude-',''))}</span>`:null,
    pct>0?`${bar} <span class="${bc}">${pct}%</span>`:null,
    ctxTok>0?`<span class="c-magenta" title="out: ${outTok.toLocaleString()}">${ctxTok.toLocaleString()} tok</span>`:null,
    st.cost_usd?`<span class="c-gray">$${st.cost_usd.toFixed(4)}</span>`:null,
  ].filter(Boolean).join(sep);
  return parts||t('ws.ready');
}

// ── DOM helpers ────────────────────────────────────────────────────────────────
function setDot(sid,cls){
  const d=document.getElementById('dot-'+sid);if(d)d.className='task-dot '+cls;
  if(_detailSid===sid){const dd=document.getElementById('detail-dot');if(dd)dd.className='detail-dot '+cls;}
}
function setSl(sid,html){const sl=document.getElementById('sl-'+sid);if(sl)sl.innerHTML=html;}

// ── dropdown ───────────────────────────────────────────────────────────────────
const SRC_BADGE={builtin:'#4b5563',skill:'#7c3aed',user:'#15803d',project:'#0f766e',claude:'#1e40af'};
function updateDropdown(sid,val){
  const dd=document.getElementById('dd-'+sid);if(!dd)return;
  if(!val.startsWith('/')){dd.innerHTML='';return;}
  const q=val.toLowerCase();
  const matches=Object.values(CMD_REGISTRY).filter(e=>e.name.startsWith(q)).sort((a,b)=>a.name.localeCompare(b.name));
  if(!matches.length){dd.innerHTML='';return;}
  dd.innerHTML=matches.map((e,i)=>{
    const badge=e.source?`<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${SRC_BADGE[e.source]||'#333'};color:#ccc;margin-left:auto;flex-shrink:0">${esc(e.source)}</span>`:'';
    return `<div class="cmd-item${i===0?' active':''}" data-cmd="${esc(e.name)}"
      onmousedown="event.preventDefault();selectCmd('${sid}','${esc(e.name)}')">
      <span class="cmd-name">${esc(e.name)}</span><span class="cmd-desc">${esc(e.description||'')}</span>${badge}</div>`;
  }).join('');
}
function selectCmd(sid,cmd){
  const ta=document.getElementById('ta-'+sid);if(!ta)return;
  ta.value=cmd+' ';ta.classList.add('is-cmd');
  const btn=document.getElementById('send-'+sid);
  if(btn){btn.classList.add('is-cmd');btn.textContent='⌘';}
  closeDropdown(sid);ta.focus();
}
function closeDropdown(sid){const dd=document.getElementById('dd-'+sid);if(dd)dd.innerHTML='';}

// ── 사이드바 Usage 위젯 ─────────────────────────────────────────────────────────
const USAGE_PLANS = { '5': 5.0, '10': 10.0, '20': 20.0 };
let _usageBudget = 5.0;

function onUsagePlanChange(val){
  _usageBudget = USAGE_PLANS[val] || 5.0;
  try{ localStorage.setItem('ccpilot_usage_plan', val); }catch(e){}
  updateSidebarUsage();
}

function _restoreUsagePlan(){
  try{
    const v = localStorage.getItem('ccpilot_usage_plan');
    if(v && USAGE_PLANS[v]){
      _usageBudget = USAGE_PLANS[v];
      const sel = document.getElementById('usage-plan-sel');
      if(sel) sel.value = v;
    }
  }catch(e){}
}

function updateSidebarUsage(){
  let totalCost = 0, totalTok = 0;
  for(const s of Object.values(sessions)){
    if(s.status?.cost_usd) totalCost += s.status.cost_usd;
    if(s.status?.total_output_tokens) totalTok += s.status.total_output_tokens;
  }
  const pct = Math.min(100, (totalCost / _usageBudget) * 100);
  const remaining = Math.max(0, _usageBudget - totalCost);

  const bar = document.getElementById('usage-bar');
  const detail = document.getElementById('usage-detail');
  if(!bar || !detail) return;

  bar.style.width = pct.toFixed(1) + '%';
  bar.className = 'usage-bar' + (pct >= 90 ? ' danger' : pct >= 60 ? ' warn' : '');

  const tokStr = totalTok > 0 ? ` · ${(totalTok/1000).toFixed(1)}k tok` : '';
  detail.textContent = `$${totalCost.toFixed(4)} / $${_usageBudget.toFixed(0)} · $${remaining.toFixed(4)} ${t('usage.remaining')}${tokStr}`;
}

// ── 휴지통 ─────────────────────────────────────────────────────────────────────
const _trash = []; // { id, title, phase, model, cwd, projectId, lastResponse, chatLog }

function _trashAdd(sid){
  const s = sessions[sid];
  if(!s) return;
  _trash.unshift({
    id: sid,
    title: document.getElementById('title-'+sid)?.textContent?.trim() || sid,
    phase: s.phase,
    model: s.status?.model || '',
    cwd: s.cwd || '',
    projectId: s.projectId || null,
    lastResponse: s.lastResponse || '',
    chatLog: s.chatLog ? [...s.chatLog] : [],
  });
  if(_trash.length > 20) _trash.pop();
  renderTrash();
}

function renderTrash(){
  const wrap = document.getElementById('sidebar-trash-wrap');
  const list = document.getElementById('trash-list');
  if(!wrap || !list) return;
  if(!_trash.length){ wrap.style.display='none'; return; }
  wrap.style.display = '';
  list.innerHTML = _trash.map((tItem,i)=>`
    <div class="trash-item">
      <span class="trash-item-name" title="${esc(tItem.cwd)}">${esc(tItem.title)}</span>
      <button class="trash-item-restore" onclick="restoreFromTrash(${i})">${t('ws.restore')}</button>
    </div>`).join('');
}

function restoreFromTrash(i){
  const t = _trash[i];
  if(!t) return;
  _trash.splice(i,1);
  // 카드 복원: 세션을 새로 만들어서 같은 title/cwd/phase로 생성
  fetch('/api/session', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      model: t.model||'',
      title: t.title,
      phase: t.phase||'backlog',
      cwd: t.cwd||'',
      project_id: t.projectId||undefined,
    })
  }).then(r=>r.json()).then(j=>{
    if(j.error){ renderTrash(); return; }
    mountCard(j.session_id, t.title, t.phase||'backlog', t.model||'', j.slash_commands||[], t.projectId||null, j.cwd||t.cwd||'');
    // chatLog 복원
    const s = sessions[j.session_id];
    if(s && t.chatLog?.length) s.chatLog = t.chatLog;
    if(s && t.lastResponse) s.lastResponse = t.lastResponse;
    renderTrash();
  }).catch(()=>{ renderTrash(); });
}

function clearTrash(){
  _trash.length = 0;
  renderTrash();
}

// ── 세션 자동저장 & 복원 ───────────────────────────────────────────────────────
const LS_KEY='cdl_ui_state';
function saveUIState(){
  try{
    const model=document.getElementById('home-model-sel')?.value||'';
    localStorage.setItem(LS_KEY,JSON.stringify({model,activeProject:AppState.activeProjectId}));
  }catch(e){}
}
function restoreUIState(){
  try{
    const raw=localStorage.getItem(LS_KEY);if(!raw)return;
    const state=JSON.parse(raw);
    if(state.model){
      ['home-model-sel','modal-model'].forEach(id=>{
        const sel=document.getElementById(id);if(sel)sel.value=state.model;
      });
    }
    if(state.activeProject) AppState.activeProjectId=state.activeProject;
  }catch(e){}
}
// 모델 선택 동기화: 어느 셀렉터 변경 시 나머지 동기화
function syncModelSels(srcId,val){
  ['home-model-sel','modal-model'].forEach(id=>{
    if(id===srcId)return;
    const sel=document.getElementById(id);if(sel)sel.value=val;
  });
  saveUIState();
}
function getSelectedModel(){
  return document.getElementById('home-model-sel')?.value||'';
}

async function restoreSessions(){
  try{
    const r=await fetch('/api/sessions');
    const {sessions:saved}=await r.json();
    if(!saved||!saved.length)return;
    const r2=await fetch('/api/sessions/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessions:saved})});
    const {sessions:restored}=await r2.json();
    if(!restored||!restored.length)return;
    for(const s of restored){
      if(document.getElementById('card-'+s.session_id))continue;
      if(s.phase==='done'){
        // Done 세션: WebSocket 연결 없이 완료 기록만 표시
        mountDoneCard(s.session_id,s.title,s.model,s.project_id||null,s.last_response||'');
      } else {
        // 이전 작업내용 요약 컨텍스트를 mountCard(→connectWS) 전에 먼저 세팅
        if(s.resume_context){
          _pendingInitPrompts[s.session_id]=s.resume_context;
        }
        mountCard(s.session_id,s.title,s.phase,s.model,s.slash_commands||[],s.project_id||null,s.cwd||'');
      }
    }
  }catch(e){}
}

// ── 커스텀 Confirm 모달 ────────────────────────────────────────────────────────
let _confirmResolve = null;
function showConfirm(msg, {icon='⚠', okText, cancelText, safe=false}={}){
  // cancelText가 undefined일 때만 기본값 적용 (''는 "숨김" 의미)
  if(okText == null) okText = t('confirm.ok');
  if(cancelText == null) cancelText = t('confirm.cancel');
  return new Promise(resolve=>{
    _confirmResolve = resolve;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-icon').textContent = icon;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okText;
    okBtn.className = 'btn-primary confirm-ok-btn' + (safe?' safe':'');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    cancelBtn.textContent = cancelText;
    // cancelText가 빈 문자열이면 cancel 버튼 숨김
    cancelBtn.style.display = cancelText ? '' : 'none';
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
function _confirmClose(result){
  document.getElementById('confirm-overlay').classList.remove('open');
  if(_confirmResolve){ _confirmResolve(result); _confirmResolve=null; }
}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('confirm-ok-btn')?.addEventListener('click',()=>_confirmClose(true));
  document.getElementById('confirm-cancel-btn')?.addEventListener('click',()=>_confirmClose(false));
  document.getElementById('confirm-overlay')?.addEventListener('click',e=>{
    if(e.target===e.currentTarget) _confirmClose(false);
  });
  _applyI18n();
});

// ── 테마 ───────────────────────────────────────────────────────────────────────
function toggleTheme(){
  const isLight=document.documentElement.classList.toggle('light');
  document.getElementById('theme-btn').textContent=isLight?'🌙':'☀️';
  try{localStorage.setItem('theme',isLight?'light':'dark');}catch(e){}
}
(function(){
  try{
    if(localStorage.getItem('theme')==='light'){
      document.documentElement.classList.add('light');
      document.addEventListener('DOMContentLoaded',()=>{const b=document.getElementById('theme-btn');if(b)b.textContent='☀️';});
    }
  }catch(e){}
})();

// ── 언어 토글 ────────────────────────────────────────────────────────────────
function toggleLang(){
  setLang(_lang === 'en' ? 'ko' : 'en');
}
