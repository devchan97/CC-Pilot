// ── 프로젝트 모달 ──────────────────────────────────────────────────────────────
function openProjectModal(){
  document.getElementById('proj-modal-name').value = '';
  document.getElementById('proj-modal-cwd').value = '';
  document.getElementById('project-modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('proj-modal-name').focus(), 50);
}
function closeProjectModal(){
  document.getElementById('project-modal-overlay').classList.remove('open');
}
async function confirmNewProject(){
  const name = document.getElementById('proj-modal-name').value.trim();
  if(!name){ alert('프로젝트 이름을 입력하세요.'); return; }
  const cwd = document.getElementById('proj-modal-cwd').value.trim();
  closeProjectModal();
  const p = await createProject(name, cwd);
  if(p) selectProject(p.id);
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('proj-modal-name')?.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); confirmNewProject(); }
    if(e.key==='Escape') closeProjectModal();
  });
});

// ── 새 태스크 모달 ─────────────────────────────────────────────────────────────
let _pendingPhase = 'backlog';
function openNewModal(phase){
  _pendingPhase = phase;
  document.getElementById('modal-phase').value = phase;
  document.getElementById('modal-title').value = '';
  document.getElementById('modal-init-prompt').value = '';
  // 현재 선택 모델 기본값 동기화
  const curModel = getSelectedModel();
  const modalModelSel = document.getElementById('modal-model');
  if(modalModelSel) modalModelSel.value = curModel;
  // 활성 프로젝트 root_cwd를 기본 경로로 채우기
  const proj = _activeProjectId ? projects[_activeProjectId] : null;
  document.getElementById('modal-cwd').value = proj?.root_cwd || '';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('modal-title').focus(), 50);
}
function closeModal(){
  document.getElementById('modal-overlay').classList.remove('open');
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('modal-title')?.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); confirmNewTask(); }
    if(e.key==='Escape') closeModal();
  });
});
function confirmNewTask(){
  const title      = document.getElementById('modal-title').value.trim() || '새 태스크';
  const phase      = document.getElementById('modal-phase').value;
  const cwd        = document.getElementById('modal-cwd').value.trim();
  const initPrompt = document.getElementById('modal-init-prompt').value.trim();
  const model      = document.getElementById('modal-model')?.value || getSelectedModel();
  closeModal();
  createSession(title, phase, cwd, initPrompt, model);
}

// ── 상세 모달 ──────────────────────────────────────────────────────────────────
let _detailSid = null;

function openDetailModal(sid){
  const s = sessions[sid]; if(!s) return;
  _detailSid = sid;
  const titleEl = document.getElementById('title-'+sid);
  document.getElementById('detail-title').textContent = titleEl ? titleEl.textContent : sid;
  const dotSrc = document.getElementById('dot-'+sid);
  const dotDst = document.getElementById('detail-dot');
  if(dotSrc && dotDst) dotDst.className = dotSrc.className.replace('task-dot','detail-dot');
  const slSrc = document.getElementById('sl-'+sid);
  document.getElementById('detail-sl').innerHTML = slSrc ? slSrc.innerHTML : '';
  // 📁 버튼: cwd가 있으면 표시
  const filesBtn = document.getElementById('detail-files-btn');
  if(filesBtn) filesBtn.style.display = s.cwd ? '' : 'none';
  const chat = document.getElementById('detail-chat');
  chat.innerHTML = '';
  for(const entry of (s.chatLog||[])) renderLogEntry(chat, entry, sid);
  chat.scrollTop = chat.scrollHeight;
  const ta = document.getElementById('ta-detail');
  const btn = document.getElementById('send-detail');
  ta.disabled = !s.verified; btn.disabled = !s.verified;
  ta.value = ''; ta.style.height = 'auto';
  attachDetailInputHandlers();
  document.getElementById('detail-overlay').classList.add('open');
  if(s.verified) setTimeout(()=>ta.focus(), 80);
}
function closeDetailModal(){
  document.getElementById('detail-overlay').classList.remove('open');
  _detailSid = null;
  document.getElementById('dd-detail').innerHTML = '';
}

let _detailInputAttached = false;
function attachDetailInputHandlers(){
  if(_detailInputAttached) return;
  _detailInputAttached = true;
  const ta = document.getElementById('ta-detail');
  const btn = document.getElementById('send-detail');
  ta.addEventListener('input', function(){
    this.style.height='auto';
    this.style.height=Math.min(this.scrollHeight,120)+'px';
    const isCmd=this.value.startsWith('/');
    this.classList.toggle('is-cmd',isCmd);
    btn.classList.toggle('is-cmd',isCmd);
    btn.textContent=isCmd?'⌘':'↑';
    if(_detailSid) updateDropdown('detail',this.value);
  });
  ta.addEventListener('keydown', function(e){
    const dd=document.getElementById('dd-detail');
    const items=dd?[...dd.querySelectorAll('.cmd-item')]:[];
    const ai=items.findIndex(i=>i.classList.contains('active'));
    if(e.key==='ArrowUp'&&items.length){e.preventDefault();items[ai]?.classList.remove('active');items[ai<=0?items.length-1:ai-1].classList.add('active');return;}
    if(e.key==='ArrowDown'&&items.length){e.preventDefault();items[ai]?.classList.remove('active');items[ai>=items.length-1?0:ai+1].classList.add('active');return;}
    if(e.key==='Tab'&&items.length){e.preventDefault();const p=items[ai>=0?ai:0];if(p)selectCmd('detail',p.dataset.cmd);return;}
    if(e.key==='Escape'){if(items.length){closeDropdown('detail');return;}closeDetailModal();return;}
    if(e.key==='Enter'&&!e.shiftKey){if(items.length&&ai>=0){e.preventDefault();selectCmd('detail',items[ai].dataset.cmd);}else{e.preventDefault();sendDetailMsg();}}
  });
  btn.addEventListener('click', sendDetailMsg);
}
function sendDetailMsg(){ if(_detailSid) sendMsg(_detailSid,'detail'); }

function renderLogEntry(chat, entry, sid){
  if(entry.type==='tool'){
    const wrap=document.createElement('div');wrap.className='msg tool';
    const b=document.createElement('div');b.className='bubble';
    b.innerHTML=`<span class="tool-name">${esc(entry.name||'')}</span><span class="tool-summary">${esc(entry.summary||'')}</span>`;
    wrap.appendChild(b);chat.appendChild(wrap);
  } else if(entry.type==='thinking'){
    const wrap=document.createElement('div');wrap.className='msg thinking-msg';
    const b=document.createElement('div');b.className='bubble';
    b.textContent=entry.text||'';b.onclick=()=>b.classList.toggle('expanded');
    wrap.appendChild(b);chat.appendChild(wrap);
  } else {
    const wrap=document.createElement('div');wrap.className='msg '+(entry.role||'sys');
    if(entry.role==='user'||entry.role==='cmd'){const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent=entry.role==='cmd'?'/cmd':'나';wrap.appendChild(lbl);}
    else if(entry.role==='ai'){const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent='Claude';wrap.appendChild(lbl);}
    const b=document.createElement('div');b.className='bubble';b.textContent=entry.text||'';wrap.appendChild(b);chat.appendChild(wrap);return b;
  }
}

// Done 카드 클릭 시 요약 모달
function openDoneSummaryModal(sid){
  const s=sessions[sid];if(!s)return;
  const title=document.getElementById('title-'+sid)?.textContent||sid;
  const text=s.lastResponse||'(기록 없음)';
  // 기존 detail 모달 재활용 (읽기 전용)
  _detailSid=sid;
  document.getElementById('detail-title').textContent=title;
  document.getElementById('detail-dot').className='detail-dot ok';
  document.getElementById('detail-sl').innerHTML='<span class="c-green">완료된 태스크</span>';
  const chat=document.getElementById('detail-chat');
  chat.innerHTML='';
  const wrap=document.createElement('div');wrap.className='msg sys';
  const b=document.createElement('div');b.className='bubble';
  b.style.cssText='color:var(--green);font-size:11px;text-align:center';
  b.textContent='✓ 이 태스크는 완료된 상태입니다. 다시 진행하려면 In Progress로 이동하세요.';
  wrap.appendChild(b);chat.appendChild(wrap);
  const wrap2=document.createElement('div');wrap2.className='msg ai';
  const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent='마지막 완료 기록';wrap2.appendChild(lbl);
  const b2=document.createElement('div');b2.className='bubble';b2.textContent=text;wrap2.appendChild(b2);chat.appendChild(wrap2);
  chat.scrollTop=chat.scrollHeight;
  // 입력 비활성화
  const ta=document.getElementById('ta-detail');
  const btn=document.getElementById('send-detail');
  ta.disabled=true;btn.disabled=true;ta.placeholder='완료된 태스크입니다. In Progress로 이동하면 대화가 재개됩니다.';
  document.getElementById('detail-overlay').classList.add('open');
}

// ── Planning 패널 ──────────────────────────────────────────────────────────────
let _planTab='text',_spawnAgents=[],_spawnSummary='',_spawnRootCwd='',_spawnDefaultName='';

function togglePlanPanel(){document.getElementById('plan-panel').classList.toggle('collapsed');}
function switchPlanTab(tab){
  _planTab=tab;
  document.querySelectorAll('.plan-tab').forEach(b=>b.classList.toggle('active',b.textContent.trim().startsWith(tab==='text'?'텍스트':'파일')));
  document.getElementById('plan-tab-text').classList.toggle('hidden',tab!=='text');
  document.getElementById('plan-tab-file').classList.toggle('hidden',tab!=='file');
}
function onFileSelect(input){
  const f=input.files[0];document.getElementById('plan-file-name').textContent=f?f.name:'선택된 파일 없음';
}

function showLoading(show, targetId){
  // targetId: 로딩을 표시할 모달/컨테이너 id. 기본은 spawn-overlay 내부 모달
  const containerId = targetId || 'spawn-overlay';
  const container = document.getElementById(containerId);
  let el = container ? container.querySelector('.plan-loading') : document.getElementById('plan-loading-overlay');
  if(!el){
    el = document.createElement('div');
    el.className = 'plan-loading';
    el.innerHTML = '<div class="plan-spinner"></div><div class="plan-loading-text">Claude가 프로젝트를 분석 중...</div>';
    if(container){
      // 모달 내부에 relative 위치로 삽입
      const modal = container.querySelector('.modal, .spawn-modal') || container;
      modal.style.position = 'relative';
      el.style.borderRadius = 'inherit';
      modal.appendChild(el);
    } else {
      el.id = 'plan-loading-overlay';
      document.body.appendChild(el);
    }
  }
  el.classList.toggle('show', show);
}

async function runPlanning(){
  const model=getSelectedModel();
  const cwd=document.getElementById('plan-cwd').value.trim();
  const btn=document.getElementById('plan-run-btn');
  btn.disabled=true;showLoading(true);
  try{
    let result;
    if(_planTab==='text'){
      const text=document.getElementById('plan-text').value.trim();
      if(!text){alert('텍스트를 입력하세요.');return;}
      const r=await fetch('/api/plan/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,cwd,model})});
      result=await r.json();
    } else {
      const file=document.getElementById('plan-file').files[0];
      if(!file){alert('파일을 선택하세요.');return;}
      const fd=new FormData();fd.append('file',file);fd.append('cwd',cwd);fd.append('model',model);
      const r=await fetch('/api/plan/file',{method:'POST',body:fd});result=await r.json();
    }
    if(result.error){alert('분석 오류: '+result.error);return;}
    if(!result.agents||!result.agents.length){alert('에이전트 제안이 없습니다.');return;}
    _spawnSummary=result.summary||'';_spawnRootCwd=cwd;_spawnDefaultName='';
    showSpawnModal(result.agents,false);
  }catch(e){alert('요청 실패: '+e);}
  finally{btn.disabled=false;showLoading(false);}
}

function showSpawnModal(agents, fromHome){
  _spawnAgents=agents;
  document.getElementById('spawn-summary').textContent=_spawnSummary||'프로젝트 분석 완료';
  const list=document.getElementById('spawn-agent-list');
  // 프로젝트명 입력 필드 (홈에서 왔을 때만)
  const projField = fromHome ? `
    <div class="spawn-proj-field">
      <label style="font-size:11px;color:var(--text-mid);font-weight:500">프로젝트 이름</label>
      <input id="spawn-proj-name" class="agent-proposal-input" style="margin-top:5px;width:100%"
        value="${esc(_spawnDefaultName)}" placeholder="프로젝트 이름 입력">
    </div>` : '';
  const defaultModel = getSelectedModel() || 'sonnet';
  list.innerHTML = projField + agents.map((ag,i)=>`
    <div class="agent-proposal-item">
      <div class="agent-proposal-row">
        <span class="agent-role-badge">${esc(ag.role||'agent')}</span>
        <div class="agent-proposal-label">이름</div>
        <input class="agent-proposal-input" id="ag-title-${i}" value="${esc(ag.title||ag.role||'Agent')}" placeholder="에이전트 이름">
        <div class="agent-proposal-label">경로</div>
        <input class="agent-proposal-input" id="ag-cwd-${i}" value="${esc(ag.cwd_suffix||'')}" placeholder="서브 디렉토리">
      </div>
      <div class="agent-proposal-row">
        <div class="agent-proposal-label" style="width:60px">모델</div>
        <select class="agent-proposal-input" id="ag-model-${i}" style="font-size:11px;padding:3px 6px">
          <option value="sonnet"${defaultModel==='sonnet'||!defaultModel?' selected':''}>Sonnet 4.6</option>
          <option value="opus"${defaultModel==='opus'?' selected':''}>Opus 4.6</option>
          <option value="haiku"${defaultModel==='haiku'?' selected':''}>Haiku 4.5</option>
        </select>
      </div>
      <div class="agent-proposal-row">
        <div class="agent-proposal-label" style="width:60px">태스크</div>
        <textarea class="agent-proposal-prompt" id="ag-prompt-${i}" rows="2">${esc(ag.init_prompt||'')}</textarea>
      </div>
    </div>`).join('');
  document.getElementById('spawn-overlay').classList.add('open');
}
function closeSpawnModal(){document.getElementById('spawn-overlay').classList.remove('open');}

async function confirmSpawn(){
  // 프로젝트 처리
  let projectId=_activeProjectId;
  const projNameEl=document.getElementById('spawn-proj-name');
  if(projNameEl){
    const pname=projNameEl.value.trim()||_spawnDefaultName||'새 프로젝트';
    const p=await createProject(pname, _spawnRootCwd);
    if(p){projectId=p.id;_activeProjectId=p.id;}
  }

  const agents=_spawnAgents.map((ag,i)=>({
    role:ag.role,
    title:document.getElementById('ag-title-'+i)?.value.trim()||ag.title,
    cwd_suffix:document.getElementById('ag-cwd-'+i)?.value.trim()||ag.cwd_suffix||'',
    init_prompt:document.getElementById('ag-prompt-'+i)?.value.trim()||ag.init_prompt||'',
    phase:'backlog',
    model:document.getElementById('ag-model-'+i)?.value||getSelectedModel()||'sonnet',
  }));

  closeSpawnModal();showLoading(true);
  try{
    const r=await fetch('/api/plan/spawn',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({agents,root_cwd:_spawnRootCwd,summary:_spawnSummary,project_id:projectId})});
    const result=await r.json();
    if(result.error){alert('Spawn 오류: '+result.error);return;}

    // Lifecycle 화면으로 전환
    if(projectId && projects[projectId]) selectProject(projectId);
    else showView('lifecycle');

    for(const s of (result.sessions||[])){
      // Spawn 된 태스크는 Backlog에 먼저 — 사용자가 검토 후 In Progress로 이동
      mountCard(s.session_id,s.title,'backlog',s.model||'',s.slash_commands||[],projectId,s.cwd||'');
      if(s.init_prompt)_pendingInitPrompts[s.session_id]=s.init_prompt;
    }
    document.getElementById('plan-panel').classList.add('collapsed');
    // 홈 화면 초기화
    document.getElementById('home-textarea').value='';
    _homeFiles=[];_homeCwd='';renderHomeAttachments();
    document.getElementById('home-cwd-badge').style.display='none';
  }catch(e){alert('Spawn 실패: '+e);}
  finally{showLoading(false);}
}
