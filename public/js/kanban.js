// ── 프로젝트 상태 ──────────────────────────────────────────────────────────────
const projects = {};          // pid → {id, name, root_cwd, created_at}

// ── 뷰 전환 ───────────────────────────────────────────────────────────────────
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  document.getElementById('view-'+name)?.classList.remove('hidden');
}

// ── 사이드바 ───────────────────────────────────────────────────────────────────
function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const collapsed = sb.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  document.getElementById('sidebar-tab').textContent = collapsed ? '›' : '‹';
  try{ localStorage.setItem('sidebar_open', collapsed ? '0' : '1'); }catch(e){}
}

function restoreSidebarState(){
  try{
    const v = localStorage.getItem('sidebar_open');
    if(v === '0'){
      document.getElementById('sidebar').classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
      document.getElementById('sidebar-tab').textContent = '›';
    }
  }catch(e){}
}

function clearProjectSelection(){
  AppState.activeProjectId = null;
  document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));
  try{ localStorage.removeItem('active_project'); }catch(e){}
}

// ── 프로젝트 CRUD ──────────────────────────────────────────────────────────────
async function loadProjects(){
  try{
    const r = await fetch('/api/projects');
    const data = await r.json();
    (data.projects||[]).forEach(p=>{ projects[p.id] = p; });
    renderSidebar();
  }catch(e){}
}

async function createProject(name, rootCwd){
  const r = await fetch('/api/projects', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({name, root_cwd: rootCwd||''})
  });
  const data = await r.json();
  if(data.error){ alert(data.error); return null; }
  projects[data.id] = data;
  renderSidebar();
  return data;
}

async function deleteProject(pid){
  if(!await showConfirm(t('confirm.delete_project'), {icon:'🗑', okText:t('confirm.delete')})) return;
  // 해당 프로젝트의 세션 모두 삭제
  const sidsToRemove = Object.keys(sessions).filter(sid=>sessions[sid].projectId===pid);
  for(const sid of sidsToRemove) removeCard(sid);
  await fetch('/api/projects/'+pid, {method:'DELETE'}).catch(()=>{});
  delete projects[pid];
  if(AppState.activeProjectId === pid){
    AppState.activeProjectId = null;
    showView('home');
  }
  renderSidebar();
}

// ── 사이드바 렌더 ──────────────────────────────────────────────────────────────
function renderSidebar(){
  const list = document.getElementById('sidebar-list');
  const pids = Object.keys(projects);
  if(!pids.length){
    list.innerHTML = '<div class="sidebar-empty">'+t('nav.no_projects')+'</div>';
    return;
  }
  list.innerHTML = pids.map(pid=>{
    const p = projects[pid];
    const count = Object.values(sessions).filter(s=>s.projectId===pid).length;
    const active = pid === AppState.activeProjectId;
    return `<div class="sidebar-item${active?' active':''}" id="si-${pid}"
      onclick="selectProject('${pid}')">
      <div class="sidebar-item-dot"></div>
      <span class="sidebar-item-name">${esc(p.name)}</span>
      <span class="sidebar-item-count">${count||''}</span>
      <button class="sidebar-item-del" title="${t('confirm.delete')}"
        onclick="event.stopPropagation();deleteProject('${pid}')">✕</button>
    </div>`;
  }).join('');
}

function selectProject(pid){
  AppState.activeProjectId = pid;
  const p = projects[pid];
  // kanban 보드로 전환
  showView('kanban');
  // 프로젝트명/경로 표시
  document.getElementById('kanban-project-name').textContent = p.name;
  document.getElementById('kanban-project-cwd').textContent = p.root_cwd || '';
  // plan-cwd 자동 채우기
  if(p.root_cwd) document.getElementById('plan-cwd').value = p.root_cwd;
  // 사이드바 하이라이트
  document.querySelectorAll('.sidebar-item').forEach(el=>el.classList.remove('active'));
  document.getElementById('si-'+pid)?.classList.add('active');
  // 보드 카드 필터
  filterBoard();
  updateCounts();
  try{ localStorage.setItem('active_project', pid); }catch(e){}
}

function filterBoard(){
  Object.keys(sessions).forEach(sid=>{
    const card = document.getElementById('card-'+sid);
    if(!card) return;
    const belongs = !AppState.activeProjectId || sessions[sid].projectId === AppState.activeProjectId;
    card.style.display = belongs ? '' : 'none';
  });
}

// ── 세션 생성 ──────────────────────────────────────────────────────────────────
function createSession(title, phase, cwd, initPrompt, model){
  model = model || getSelectedModel();
  fetch('/api/session', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({model, title, phase,
      cwd: cwd||undefined,
      project_id: AppState.activeProjectId||undefined})
  }).then(r=>r.json()).then(j=>{
    if(j.error){alert(j.error);return;}
    if(initPrompt) _pendingInitPrompts[j.session_id] = initPrompt;
    mountCard(j.session_id, title, phase, model, j.slash_commands||[], AppState.activeProjectId, j.cwd||'');
  }).catch(e=>alert('Session creation failed: '+e));
}

// ── 카드 ───────────────────────────────────────────────────────────────────────
function mountCard(sid, title, phase, model, slashCmds, projectId, cwd){
  const col = document.getElementById('col-'+phase);
  if(!col) return;
  document.getElementById('empty-'+phase)?.remove();

  registerCmds(slashCmds);

  sessions[sid] = {
    ws: null, status:{model:model||''}, verified:false,
    aiEl:null, aiBuf:'',
    phase: phase,
    projectId: projectId||null,
    lastResponse: '',
    chatLog: [],
    cwd: cwd||'',
  };

  // 현재 활성 프로젝트와 다르면 숨김
  const visible = !AppState.activeProjectId || projectId === AppState.activeProjectId;

  const card = document.createElement('div');
  card.className = 'task-card'; card.id = 'card-'+sid;
  if(!visible) card.style.display = 'none';
  card.innerHTML = `
    <div class="task-head" onclick="openDetailModal('${sid}')" style="cursor:pointer">
      <div class="task-dot err" id="dot-${sid}"></div>
      <div class="task-title" id="title-${sid}" contenteditable="true" spellcheck="false"
        onclick="event.stopPropagation()"
        onblur="renameTask('${sid}',this.textContent.trim())"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
      >${esc(title)}</div>
      <div class="task-actions">
        <button class="task-btn" title="상세보기" onclick="event.stopPropagation();openDetailModal('${sid}')">↗</button>
        <button class="task-btn" title="세션 닫기" onclick="event.stopPropagation();removeCard('${sid}')">✕</button>
      </div>
    </div>
    <div class="phase-btns">
      <button class="phase-btn" data-to="backlog"    onclick="movePhase('${sid}','backlog')">Backlog</button>
      <button class="phase-btn" data-to="inprogress" onclick="movePhase('${sid}','inprogress')">In Progress</button>
      <button class="phase-btn" data-to="done"       onclick="movePhase('${sid}','done')">Done</button>
    </div>
    <div class="task-sl" id="sl-${sid}">${t('ws.connecting')}</div>
    <div class="task-queue-badge" id="queue-badge-${sid}"></div>
    <div class="task-preview" id="preview-${sid}" onclick="openDetailModal('${sid}')">-</div>`;
  col.appendChild(card);

  // Backlog: init_prompt 내용을 preview에 미리 표시 (WS 연결은 하되 전송 보류)
  if(phase === 'backlog' && _pendingInitPrompts[sid]){
    const prev = document.getElementById('preview-'+sid);
    if(prev){
      prev.textContent = _pendingInitPrompts[sid];
      prev.classList.add('preview-pending');
    }
  }

  connectWS(sid);
  updateCounts();
  renderSidebar();
}

function removeCard(sid){
  if(typeof _trashAdd === 'function') _trashAdd(sid);
  sessions[sid]?.ws?.close();
  if(_detailSid === sid) closeDetailModal();
  const phase = sessions[sid]?.phase;
  delete sessions[sid];
  document.getElementById('card-'+sid)?.remove();
  if(phase){
    const col = document.getElementById('col-'+phase);
    const visible = col ? [...col.querySelectorAll('.task-card')].filter(c=>c.style.display!=='none') : [];
    if(col && !visible.length){
      const e = document.createElement('div'); e.className='col-empty'; e.id='empty-'+phase;
      e.textContent=t('kanban.no_tasks'); col.prepend(e);
    }
  }
  updateCounts();
  renderSidebar();
  fetch('/api/session/'+sid, {method:'DELETE'}).catch(()=>{});
}

function renameTask(sid, title){
  if(!title) return;
  fetch('/api/session/'+sid+'/rename', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({title})
  }).catch(()=>{});
}

function movePhase(sid, phase){
  const s = sessions[sid]; if(!s) return;
  const oldPhase = s.phase;
  if(oldPhase === phase) return;
  const card = document.getElementById('card-'+sid);
  const newCol = document.getElementById('col-'+phase);
  if(!card || !newCol) return;
  document.getElementById('empty-'+phase)?.remove();
  newCol.appendChild(card);
  s.phase = phase;
  // done → inprogress: WebSocket 재연결 및 자동 완료 플래그 리셋
  if(phase === 'inprogress' && oldPhase === 'done'){
    delete _autoDoneNotified[sid];
    s.isDoneRestored = false;
    // WS가 없거나 끊긴 상태면 무조건 재연결
    if(!s.ws || s.ws.readyState === WebSocket.CLOSED || s.ws.readyState === WebSocket.CLOSING){
      connectWS(sid);
    }
  }
  // backlog → inprogress: 보류된 init_prompt 전송 + pending 표시 제거
  if(phase === 'inprogress' && oldPhase === 'backlog' && _pendingInitPrompts[sid]){
    document.getElementById('preview-'+sid)?.classList.remove('preview-pending');
    const ip = _pendingInitPrompts[sid]; delete _pendingInitPrompts[sid];
    setTimeout(()=>{
      if(s.ws && s.ws.readyState===WebSocket.OPEN && s.verified){
        pushLog(sid,{role:'user',text:ip});
        s.ws.send(JSON.stringify({type:'input',data:ip}));
        setInputBusy(sid,true);
      }
    }, 300);
  }
  const oldCol = document.getElementById('col-'+oldPhase);
  const visible = oldCol ? [...oldCol.querySelectorAll('.task-card')].filter(c=>c.style.display!=='none') : [];
  if(oldCol && !visible.length){
    const e = document.createElement('div'); e.className='col-empty'; e.id='empty-'+oldPhase;
    e.textContent=t('kanban.no_tasks'); oldCol.prepend(e);
  }
  fetch('/api/session/'+sid+'/phase', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phase})
  }).catch(()=>{});
  updateCounts();
}

function updateCounts(){
  ['backlog','inprogress','done'].forEach(ph=>{
    const col = document.getElementById('col-'+ph);
    const n = col ? [...col.querySelectorAll('.task-card')].filter(c=>c.style.display!=='none').length : 0;
    const cnt = document.getElementById('cnt-'+ph);
    if(cnt) cnt.textContent = n;
  });
}

// ── InProgress → Done 자동 감지 ────────────────────────────────────────────────
const DONE_PATTERNS=[
  /작업\s*(완료|완성|마쳤|끝났)/i,
  /구현\s*(완료|완성|했습니다|했어요)/i,
  /모든?\s*(기능|태스크|작업)\s*(완료|구현)/i,
  /완료되었습니다/i,
  /완성되었습니다/i,
  /배포\s*(완료|됩니다)/i,
  /테스트\s*(통과|완료|성공)/i,
  /all\s+tasks?\s+completed?/i,
  /task\s+completed?/i,
  /implementation\s+(complete|done|finished)/i,
  /successfully\s+(completed?|implemented|deployed|finished)/i,
  /\ball\s+done\b/i,
];
const _autoDoneNotified={};
function checkAutoComplete(sid,text){
  if(_autoDoneNotified[sid])return;
  const matched=DONE_PATTERNS.some(p=>p.test(text));
  if(!matched)return;
  _autoDoneNotified[sid]=true;
  // 1초 후 자동 이동 (스트리밍 완료 보장)
  setTimeout(()=>{
    const s=sessions[sid];if(!s||s.phase!=='inprogress')return;
    movePhase(sid,'done');
    // 시스템 알림 표시
    pushLog(sid,{role:'sys',text:t('ws.done_auto')});
    if(_detailSid===sid){scrollDetailBottom();}
  },1000);
}

function updatePreview(sid){
  const s = sessions[sid]; if(!s) return;
  const el = document.getElementById('preview-'+sid); if(!el) return;
  const short = (s.lastResponse||'-').split('\n')[0].slice(0,120);
  el.textContent = short || '-';
}

// Done 카드 마운트 (WebSocket 없이 완료 기록만 표시)
function mountDoneCard(sid, title, model, projectId, lastResponse){
  const col = document.getElementById('col-done');
  if(!col) return;
  document.getElementById('empty-done')?.remove();

  sessions[sid] = {
    ws: null, status:{model:model||''}, verified:false,
    aiEl:null, aiBuf:'',
    phase: 'done',
    projectId: projectId||null,
    lastResponse: lastResponse||'',
    chatLog: [],
    isDoneRestored: true,
  };

  const visible = !AppState.activeProjectId || projectId === AppState.activeProjectId;

  const card = document.createElement('div');
  card.className = 'task-card'; card.id = 'card-'+sid;
  if(!visible) card.style.display = 'none';
  const shortPreview = (lastResponse||t('detail.done_tag')).split('\n')[0].slice(0,120);
  card.innerHTML = `
    <div class="task-head" style="cursor:default">
      <div class="task-dot ok" id="dot-${sid}"></div>
      <div class="task-title" id="title-${sid}" contenteditable="true" spellcheck="false"
        onclick="event.stopPropagation()"
        onblur="renameTask('${sid}',this.textContent.trim())"
        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}"
      >${esc(title)}</div>
      <div class="task-actions">
        <button class="task-btn" title="세션 닫기" onclick="event.stopPropagation();removeCard('${sid}')">✕</button>
      </div>
    </div>
    <div class="phase-btns">
      <button class="phase-btn" data-to="backlog"    onclick="movePhase('${sid}','backlog')">Backlog</button>
      <button class="phase-btn" data-to="inprogress" onclick="movePhase('${sid}','inprogress')">In Progress</button>
      <button class="phase-btn" data-to="done"       onclick="movePhase('${sid}','done')">Done</button>
    </div>
    <div class="task-sl" id="sl-${sid}"><span class="c-green">완료</span>${model?' | '+esc(model.replace('claude-','')):''}
    </div>
    <div class="task-preview done-preview" id="preview-${sid}" onclick="openDoneSummaryModal('${sid}')">${esc(shortPreview)}</div>`;
  col.appendChild(card);
  updateCounts();
  renderSidebar();
}

const _pendingInitPrompts={};
