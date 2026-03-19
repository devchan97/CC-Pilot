// ── 세션 상태 ──────────────────────────────────────────────────────────────────
const sessions = {};

// ── WebSocket ──────────────────────────────────────────────────────────────────
function connectWS(sid){
  const proto=location.protocol==='https:'?'wss':'ws';
  const ws=new WebSocket(`${proto}://${location.host}/ws/${sid}`);
  sessions[sid].ws=ws;
  ws.onopen=()=>{ws.send(JSON.stringify({type:'heartbeat'}));setSl(sid,'Claude 연결 중…');};
  ws.onmessage=evt=>{
    let msg;try{msg=JSON.parse(evt.data);}catch{return;}
    const s=sessions[msg.session_id||sid];if(!s)return;
    handleMsg(msg.session_id||sid,s,msg);
  };
  ws.onclose=()=>{
    if(!sessions[sid])return;
    sessions[sid].verified=false;setDot(sid,'err');setSl(sid,'연결 끊김');
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
    setDot(sid,msg.status.thinking?'busy':'ok');return;
  }
  if(msg.type==='cleared'){
    s.chatLog=[];s.aiEl=null;s.aiBuf='';s.lastResponse='';
    pushLog(sid,{role:'sys',text:'Context 및 화면이 초기화되었습니다.'});updatePreview(sid);
    if(_detailSid===sid){const chat=document.getElementById('detail-chat');if(chat)chat.innerHTML='';appendDetailSys('Context 및 화면이 초기화되었습니다.');}
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
    pushLog(sid,{role:'sys',text:'오류: '+msg.message});
    if(_detailSid===sid){appendDetailSys('오류: '+msg.message);scrollDetailBottom();}
    setInputBusy(sid,false);
    if(_detailSid===sid){document.getElementById('ta-detail').disabled=false;document.getElementById('send-detail').disabled=false;}
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
  if(!st)return '준비됨';
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
  return parts||'준비됨';
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

// ── 세션 자동저장 & 복원 ───────────────────────────────────────────────────────
const LS_KEY='cdl_ui_state';
function saveUIState(){
  try{
    const model=document.getElementById('home-model-sel')?.value||'';
    localStorage.setItem(LS_KEY,JSON.stringify({model,activeProject:_activeProjectId}));
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
    if(state.activeProject) _activeProjectId=state.activeProject;
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
        mountCard(s.session_id,s.title,s.phase,s.model,s.slash_commands||[],s.project_id||null,s.cwd||'');
        // 이전 작업내용 요약 컨텍스트 전달
        if(s.resume_context){
          _pendingInitPrompts[s.session_id]=s.resume_context;
        }
      }
    }
  }catch(e){}
}

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
