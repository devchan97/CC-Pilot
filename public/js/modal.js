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
  if(!name){ alert(t('err.project_name')); return; }
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
  const proj = AppState.activeProjectId ? projects[AppState.activeProjectId] : null;
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
    if(entry.role==='user'||entry.role==='cmd'){const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent=entry.role==='cmd'?'/cmd':'Me';wrap.appendChild(lbl);}
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
  document.getElementById('detail-sl').innerHTML='<span class="c-green">'+t('detail.done_tag')+'</span>';
  const chat=document.getElementById('detail-chat');
  chat.innerHTML='';
  const wrap=document.createElement('div');wrap.className='msg sys';
  const b=document.createElement('div');b.className='bubble';
  b.style.cssText='color:var(--green);font-size:11px;text-align:center';
  b.textContent=t('detail.done_notice');
  wrap.appendChild(b);chat.appendChild(wrap);
  const wrap2=document.createElement('div');wrap2.className='msg ai';
  const lbl=document.createElement('div');lbl.className='lbl';lbl.textContent=t('detail.done_label');wrap2.appendChild(lbl);
  const b2=document.createElement('div');b2.className='bubble';b2.textContent=text;wrap2.appendChild(b2);chat.appendChild(wrap2);
  chat.scrollTop=chat.scrollHeight;
  // 입력 비활성화
  const ta=document.getElementById('ta-detail');
  const btn=document.getElementById('send-detail');
  ta.disabled=true;btn.disabled=true;ta.placeholder=t('detail.done_placeholder');
  document.getElementById('detail-overlay').classList.add('open');
}

// ── Planning 패널 ──────────────────────────────────────────────────────────────
let _planTab='text',_spawnAgents=[];
AppState.spawnSummary=''; AppState.spawnRootCwd=''; AppState.spawnDefaultName=''; AppState.spawnPrereqs=[]; AppState.spawnDesignFiles=[];
// spawnDesignFiles → AppState.spawnDesignFiles (constants.js)

function togglePlanPanel(){document.getElementById('plan-panel').classList.toggle('collapsed');}
function switchPlanTab(tab){
  _planTab=tab;
  document.querySelectorAll('.plan-tab').forEach(b=>b.classList.toggle('active',b.dataset.i18n===(tab==='text'?'plan.tab_text':'plan.tab_file')));
  document.getElementById('plan-tab-text').classList.toggle('hidden',tab!=='text');
  document.getElementById('plan-tab-file').classList.toggle('hidden',tab!=='file');
}
function onFileSelect(input){
  const f=input.files[0];
  if(f){
    const ext = f.name.split('.').pop().toLowerCase();
    // CLAUDE_SUPPORTED_EXTS (home.js에 정의) 기준으로 검증
    if(typeof CLAUDE_SUPPORTED_EXTS !== 'undefined' && !CLAUDE_SUPPORTED_EXTS.has(ext)){
      alert(t('err.file_type') + '.' + ext + '\n' + t('err.file_type_detail') + 'txt, md, json, yaml, csv…');
      input.value = '';
      document.getElementById('plan-file-name').textContent = t('plan.no_file');
      return;
    }
    document.getElementById('plan-file-name').textContent = f.name;
  } else {
    document.getElementById('plan-file-name').textContent = t('plan.no_file');
  }
}

function showLoading(show, targetId){
  // targetId: 로딩을 표시할 모달/컨테이너 id. 기본은 spawn-overlay 내부 모달
  const containerId = targetId || 'spawn-overlay';
  const container = document.getElementById(containerId);
  let el = container ? container.querySelector('.plan-loading') : document.getElementById('plan-loading-overlay');
  if(!el){
    el = document.createElement('div');
    el.className = 'plan-loading';
    el.innerHTML = '<div class="plan-spinner"></div><div class="plan-loading-text">'+t('spawn.analyze_loading')+'</div>';
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
  const lang=typeof getLang==='function'?getLang():'en';
  const cwd=document.getElementById('plan-cwd').value.trim();
  const btn=document.getElementById('plan-run-btn');
  btn.disabled=true;showLoading(true);
  try{
    let result;
    if(_planTab==='text'){
      const text=document.getElementById('plan-text').value.trim();
      if(!text){alert(t('err.enter_text'));return;}
      const r=await fetch('/api/plan/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,cwd,model,lang})});
      result=await r.json();
    } else {
      const file=document.getElementById('plan-file').files[0];
      if(!file){alert(t('err.select_file'));return;}
      const fd=new FormData();fd.append('file',file);fd.append('cwd',cwd);fd.append('model',model);fd.append('lang',lang);
      const r=await fetch('/api/plan/file',{method:'POST',body:fd});result=await r.json();
    }
    if(result.error){alert(t('err.analysis')+result.error);return;}
    if(!result.agents||!result.agents.length){alert(t('err.no_agents'));return;}
    AppState.spawnSummary=result.summary||'';AppState.spawnRootCwd=cwd;AppState.spawnDefaultName='';
    AppState.spawnPrereqs=result.prerequisites||[];
    showSpawnModal(result.agents,false);
  }catch(e){alert('요청 실패: '+e);}
  finally{btn.disabled=false;showLoading(false);}
}

function showSpawnModal(agents, fromHome){
  _spawnAgents=agents;
  AppState.spawnDesignFiles=[];
  // 디자인 섹션: fromHome일 때만 표시
  const ds=document.getElementById('spawn-design-section');
  if(ds) ds.style.display=fromHome?'':'none';
  const dsf=document.getElementById('spawn-design-files');
  if(dsf) dsf.innerHTML='';
  document.getElementById('spawn-summary').textContent=AppState.spawnSummary||'Project analysis complete';
  const list=document.getElementById('spawn-agent-list');
  // prerequisites 체크리스트
  const prereqHtml = (AppState.spawnPrereqs && AppState.spawnPrereqs.length) ? `
    <div class="spawn-prereq-section">
      <div class="spawn-prereq-title">${t('spawn.prereq_title')}</div>
      <div class="spawn-prereq-list">
        ${AppState.spawnPrereqs.map((p,i)=>`
          <label class="spawn-prereq-item">
            <input type="checkbox" id="prereq-${i}" class="spawn-prereq-check">
            <span class="spawn-prereq-label">${esc(p.label||'')}${p.detail?`<span class="spawn-prereq-detail"> — ${esc(p.detail)}</span>`:''}</span>
          </label>`).join('')}
      </div>
    </div>` : '';
  document.getElementById('spawn-prereq-wrap').innerHTML = prereqHtml;
  // 프로젝트명 + 루트 작업폴더 필드 (홈에서 왔을 때만)
  const cwdLabel = AppState.spawnRootCwd || t('spawn.no_folder');
  const cwdWarn = !AppState.spawnRootCwd ? ' spawn-cwd-warn' : '';
  const projField = fromHome ? `
    <div class="spawn-proj-field">
      <label style="font-size:11px;color:var(--text-mid);font-weight:500">${t('spawn.proj_name')}</label>
      <input id="spawn-proj-name" class="agent-proposal-input" style="margin-top:5px;width:100%"
        value="${esc(AppState.spawnDefaultName)}" placeholder="프로젝트 이름 입력">
      <div class="spawn-cwd-row">
        <span class="spawn-cwd-label">${t('spawn.work_folder')}</span>
        <span class="spawn-cwd-val${cwdWarn}" id="spawn-cwd-display" title="${esc(AppState.spawnRootCwd)}">${esc(cwdLabel)}</span>
        <button class="spawn-cwd-btn" onclick="spawnPickFolder()" title="${t('spawn.select_folder')}">${t('spawn.select_folder')}</button>
      </div>
    </div>` : '';
  const defaultModel = getSelectedModel() || 'sonnet';
  list.innerHTML = projField + agents.map((ag,i)=>`
    <div class="agent-proposal-item">
      <div class="agent-proposal-row">
        <span class="agent-role-badge">${esc(ag.role||'agent')}</span>
        <div class="agent-proposal-label">${t('spawn.agent_name')}</div>
        <input class="agent-proposal-input" id="ag-title-${i}" value="${esc(ag.title||ag.role||'Agent')}" placeholder="${t('spawn.agent_name')}">
        <div class="agent-proposal-label">${t('spawn.agent_path')}</div>
        <input class="agent-proposal-input" id="ag-cwd-${i}" value="${esc(ag.cwd_suffix||'')}" placeholder="${t('spawn.agent_path')}">
      </div>
      <div class="agent-proposal-row">
        <div class="agent-proposal-label" style="width:60px">${t('spawn.agent_model')}</div>
        <select class="agent-proposal-select" id="ag-model-${i}">
          <option value="sonnet"${defaultModel==='sonnet'||!defaultModel?' selected':''}>Sonnet 4.6</option>
          <option value="opus"${defaultModel==='opus'?' selected':''}>Opus 4.6</option>
          <option value="haiku"${defaultModel==='haiku'?' selected':''}>Haiku 4.5</option>
        </select>
      </div>
      <div class="agent-proposal-row">
        <div class="agent-proposal-label" style="width:60px">${t('spawn.agent_task')}</div>
        <textarea class="agent-proposal-prompt" id="ag-prompt-${i}" rows="2">${esc(ag.init_prompt||'')}</textarea>
      </div>
    </div>`).join('');
  document.getElementById('spawn-overlay').classList.add('open');
}
function closeSpawnModal(){document.getElementById('spawn-overlay').classList.remove('open');}

function spawnPickFolder(){
  openRexPicker(null, (path)=>{
    if(!path) return;
    AppState.spawnRootCwd = path;
    const disp = document.getElementById('spawn-cwd-display');
    if(disp){
      disp.textContent = path;
      disp.title = path;
      disp.classList.remove('spawn-cwd-warn');
    }
  });
}

// ── 디자인 파일 첨부 ──────────────────────────────────────────────────────────
const _DESIGN_IMG_EXTS = new Set(['png','jpg','jpeg','webp']);
const _DESIGN_TEXT_EXTS = new Set(['md','txt','json']);

async function onSpawnDesignAttach(input){
  const MAX_IMG  = 5*1024*1024;  // 이미지 5MB
  const MAX_TEXT = 512*1024;     // 텍스트 512KB
  for(const f of input.files){
    if(AppState.spawnDesignFiles.length >= 8){ showConfirm('Maximum 8 design files.',{icon:'⚠',okText:'OK',cancelText:'',safe:true}); break; }
    const ext = f.name.split('.').pop().toLowerCase();
    const isImage = _DESIGN_IMG_EXTS.has(ext);
    const isText  = _DESIGN_TEXT_EXTS.has(ext);
    if(!isImage && !isText){ showConfirm('Unsupported format: .'+ext+'\nAllowed: .md .txt .json .png .jpg .jpeg .webp',{icon:'⚠',okText:'OK',cancelText:'',safe:true}); continue; }
    const maxSize = isImage ? MAX_IMG : MAX_TEXT;
    if(f.size > maxSize){ showConfirm(f.name+': File too large.',{icon:'⚠',okText:'OK',cancelText:'',safe:true}); continue; }
    if(AppState.spawnDesignFiles.find(x=>x.name===f.name)) continue;
    const buf = await f.arrayBuffer();
    const mimeType = isImage ? (f.type||'image/'+ext) : 'text/plain';
    AppState.spawnDesignFiles.push({name:f.name, isImage, bytes:buf, mimeType});
  }
  input.value='';
  renderSpawnDesignFiles();
}

function renderSpawnDesignFiles(){
  const el=document.getElementById('spawn-design-files');
  if(!el) return;
  if(!AppState.spawnDesignFiles.length){ el.innerHTML=''; return; }
  el.innerHTML=AppState.spawnDesignFiles.map((f,i)=>`
    <div class="spawn-design-file-item">
      <span class="spawn-design-file-icon">${f.isImage?'🖼':'📄'}</span>
      <span class="spawn-design-file-name" title="${esc(f.name)}">${esc(f.name)}</span>
      <button class="spawn-design-file-remove" onclick="removeSpawnDesign(${i})">✕</button>
    </div>`).join('');
}

function removeSpawnDesign(i){
  AppState.spawnDesignFiles.splice(i,1);
  renderSpawnDesignFiles();
}

async function confirmSpawn(){
  // 프로젝트 처리
  let projectId=AppState.activeProjectId;
  const projNameEl=document.getElementById('spawn-proj-name');
  if(projNameEl){
    const pname=projNameEl.value.trim()||AppState.spawnDefaultName||'새 프로젝트';
    const p=await createProject(pname, AppState.spawnRootCwd);
    if(p){projectId=p.id;AppState.activeProjectId=p.id;}
  }

  const agents=_spawnAgents.map((ag,i)=>({
    role:ag.role,
    title:document.getElementById('ag-title-'+i)?.value.trim()||ag.title,
    cwd_suffix:document.getElementById('ag-cwd-'+i)?.value.trim()||ag.cwd_suffix||'',
    init_prompt:document.getElementById('ag-prompt-'+i)?.value.trim()||ag.init_prompt||'',
    phase:'backlog',
    model:document.getElementById('ag-model-'+i)?.value||getSelectedModel()||'sonnet',
  }));

  // 디자인 파일 base64 직렬화
  const _designFilesPayload = await Promise.all(AppState.spawnDesignFiles.map(async f=>{
    const bytes = new Uint8Array(f.bytes);
    let bin = '';
    for(let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
    return { name:f.name, isImage:f.isImage, mimeType:f.mimeType, data:btoa(bin) };
  }));

  const _spawnLang=typeof getLang==='function'?getLang():'en';
  closeSpawnModal();showLoading(true);
  try{
    const r=await fetch('/api/plan/spawn',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({agents,root_cwd:AppState.spawnRootCwd,summary:AppState.spawnSummary,project_id:projectId,design_files:_designFilesPayload,lang:_spawnLang})});
    const result=await r.json();
    if(result.error){alert(t('err.spawn')+result.error);return;}

    // Kanban 보드로 전환
    if(projectId && projects[projectId]) selectProject(projectId);
    else showView('kanban');

    for(const s of (result.sessions||[])){
      // Spawn 된 태스크는 Backlog에 먼저 — 사용자가 검토 후 In Progress로 이동
      mountCard(s.session_id,s.title,'backlog',s.model||'',s.slash_commands||[],projectId,s.cwd||'');
      if(s.init_prompt)_pendingInitPrompts[s.session_id]=s.init_prompt;
    }
    document.getElementById('plan-panel').classList.add('collapsed');
    // 홈 화면 초기화
    document.getElementById('home-textarea').value='';
    AppState.homeFiles=[];AppState.homeCwd='';renderHomeAttachments();
    document.getElementById('home-cwd-badge').style.display='none';
  }catch(e){alert(t('err.spawn_fail')+e);}
  finally{showLoading(false);}
}
