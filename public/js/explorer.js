// ── 오른쪽 Explorer 사이드바 ───────────────────────────────────────────────────
let _rexDir = '';
let _rexLastClick = { item: null, time: 0 };
// 경로 선택기 모드: { inputId, callback } 또는 null
let _rexPickTarget = null;

// 경로 선택기 모드로 Explorer 열기
// inputId: 채울 input element id, callback: 선택 완료 후 콜백(path)
function openRexPicker(inputId, callback){
  _rexPickTarget = { inputId, callback: callback||null };
  const sb = document.getElementById('rsidebar');
  if(sb.classList.contains('collapsed')){
    sb.classList.remove('collapsed');
    document.body.classList.add('rsidebar-open');
    if(!_rexDir) rexLoad('');
  }
  // 선택 버튼 표시
  _rexUpdatePickBar();
}

function _rexUpdatePickBar(){
  let bar = document.getElementById('rex-pick-bar');
  if(_rexPickTarget){
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'rex-pick-bar';
      bar.className = 'rex-pick-bar';
      document.getElementById('rsidebar').appendChild(bar);
    }
    bar.innerHTML = `<span class="rex-pick-hint">현재 폴더를 선택</span>
      <button class="rex-pick-btn" onclick="rexConfirmPick()">✔ 여기 선택</button>
      <button class="rex-pick-cancel" onclick="rexCancelPick()">✕</button>`;
  } else {
    bar?.remove();
  }
}

function rexConfirmPick(){
  if(!_rexPickTarget || !_rexDir) return;
  const { inputId, callback } = _rexPickTarget;
  if(inputId){
    const el = document.getElementById(inputId);
    if(el) el.value = _rexDir;
  }
  if(callback) callback(_rexDir);
  rexCancelPick();
}

function rexOpenSessionCwd(){
  const s = _detailSid ? sessions[_detailSid] : null;
  if(!s?.cwd) return;
  // Explorer 열고 해당 경로로 이동
  const sb = document.getElementById('rsidebar');
  if(sb.classList.contains('collapsed')){
    sb.classList.remove('collapsed');
    document.body.classList.add('rsidebar-open');
  }
  rexLoad(s.cwd);
}

function rexCancelPick(){
  _rexPickTarget = null;
  document.getElementById('rex-pick-bar')?.remove();
}

function toggleRsidebar(){
  const sb = document.getElementById('rsidebar');
  const collapsed = sb.classList.toggle('collapsed');
  document.body.classList.toggle('rsidebar-open', !collapsed);
  try{ localStorage.setItem('rsidebar_open', collapsed ? '0' : '1'); }catch(e){}
  if(!collapsed && !_rexDir) rexLoad('');
  if(collapsed) rexCancelPick();
}

function restoreRsidebarState(){
  try{
    const v = localStorage.getItem('rsidebar_open');
    if(v === '1'){
      document.getElementById('rsidebar').classList.remove('collapsed');
      document.body.classList.add('rsidebar-open');
      rexLoad('');
    }
  }catch(e){}
}

// 경로 표시줄 클릭 → 직접 편집
function rexStartPathEdit(){
  const span = document.getElementById('rex-path');
  const inp  = document.getElementById('rex-path-input');
  if(!span||!inp) return;
  inp.value = _rexDir || '';
  span.style.display = 'none';
  inp.style.display  = '';
  setTimeout(()=>{ inp.focus(); inp.select(); }, 20);
}

function rexPathInputKey(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    const val = e.target.value.trim();
    rexEndPathEdit();
    if(val) rexLoad(val);
  } else if(e.key === 'Escape'){
    rexEndPathEdit();
  }
}

function rexPathInputBlur(){
  // blur 시 짧은 딜레이 후 닫기 (Enter 처리와 충돌 방지)
  setTimeout(rexEndPathEdit, 120);
}

function rexEndPathEdit(){
  const span = document.getElementById('rex-path');
  const inp  = document.getElementById('rex-path-input');
  if(!span||!inp) return;
  inp.style.display  = 'none';
  span.style.display = '';
}

async function rexLoad(dir){
  const list = document.getElementById('rex-list');
  if(!list) return;
  list.innerHTML = '<div class="rex-empty">로딩 중…</div>';
  try{
    const r = await fetch('/api/explorer?dir=' + encodeURIComponent(dir||''));
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if(data.error){
      list.innerHTML = `<div class="rex-empty rex-error">⚠ ${esc(data.error)}<br><small>${esc(data.dir||'')}</small></div>`;
      _rexUpdatePathBar(data.dir || dir || '');
      return;
    }
    _rexDir = data.dir;
    _rexUpdatePathBar(_rexDir);
    // 상위 버튼 활성화 여부
    const upBtn = document.getElementById('rex-up-btn');
    if(upBtn) upBtn.disabled = !data.parent;
    if(!data.items.length){
      list.innerHTML = '<div class="rex-empty">빈 폴더</div>';
    } else {
      list.innerHTML = data.items.map(item => {
        const icon = item.is_dir ? '📁' : _rexFileIcon(item.name);
        const size = item.is_dir ? '' : _rexFmtSize(item.size);
        return `<div class="rex-item${item.is_dir?' is-dir':''}"
          data-path="${esc(item.path)}" data-isdir="${item.is_dir}"
          onclick="rexItemClick(this)"
          title="${esc(item.path)}">
          <span class="rex-icon">${icon}</span>
          <span class="rex-name">${esc(item.name)}</span>
          ${size?`<span class="rex-size">${size}</span>`:''}
        </div>`;
      }).join('');
    }
    // pick 모드면 pick bar 현재 경로 업데이트
    if(_rexPickTarget) _rexUpdatePickBar();
  }catch(e){
    list.innerHTML = `<div class="rex-empty rex-error">⚠ 로드 실패<br><small>${esc(String(e))}</small></div>`;
  }
}

function _rexUpdatePathBar(path){
  const span = document.getElementById('rex-path');
  if(!span) return;
  span.textContent = path;
  span.title = '클릭하여 경로 직접 입력 — ' + path;
}

function rexItemClick(el){
  const path = el.dataset.path;
  const isDir = el.dataset.isdir === 'true';
  const now = Date.now();

  // 더블클릭 감지 (같은 아이템, 500ms 이내) → 탐색기에서 열기
  if(_rexLastClick.item === el && now - _rexLastClick.time < 500){
    _rexLastClick = { item: null, time: 0 };
    fetch('/api/explorer/open', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({path})
    }).catch(()=>{});
    return;
  }
  _rexLastClick = { item: el, time: now };

  // 단일클릭: 폴더면 해당 경로로 이동 (rsidebar-path 갱신), 파일은 무시
  if(isDir) rexLoad(path);
}

function rexGoUp(){
  if(!_rexDir) return;
  // 로컬에서 parent 계산 (슬래시/백슬래시 양쪽 처리)
  const norm = _rexDir.replace(/[/\\]+$/, '');
  const sep  = norm.includes('\\') ? '\\' : '/';
  const parts = norm.split(sep).filter(Boolean);
  if(parts.length <= 1){
    // 드라이브 루트(C:\) 등 → 서버에 물어봄
    fetch('/api/explorer?dir=' + encodeURIComponent(_rexDir))
      .then(r=>r.json()).then(data=>{ if(data.parent) rexLoad(data.parent); })
      .catch(()=>{});
    return;
  }
  parts.pop();
  // Windows 드라이브 루트 복원 (C: → C:\)
  let parent = parts.join(sep);
  if(/^[A-Za-z]:$/.test(parent)) parent += sep;
  rexLoad(parent);
}

function rexRefresh(){ rexLoad(_rexDir); }

function _rexFileIcon(name){
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    js:'📜', ts:'📜', py:'🐍', html:'🌐', css:'🎨', json:'📋',
    md:'📝', txt:'📄', png:'🖼', jpg:'🖼', jpeg:'🖼', gif:'🖼',
    svg:'🖼', pdf:'📕', zip:'📦', gz:'📦', sh:'⚙️', yml:'⚙️',
    yaml:'⚙️', toml:'⚙️', env:'🔒', gitignore:'🚫',
  };
  return map[ext] || '📄';
}

function _rexFmtSize(bytes){
  if(bytes < 1024) return bytes+'B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+'K';
  return (bytes/1024/1024).toFixed(1)+'M';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  restoreUIState();
  restoreSidebarState();
  restoreRsidebarState();
  ['home-model-sel','modal-model'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change',function(){syncModelSels(id,this.value);});
  });

  await loadProjects();

  // 저장된 활성 프로젝트 복원
  const savedPid = _activeProjectId;
  if(savedPid && projects[savedPid]){
    selectProject(savedPid);
  } else {
    showView('home');
  }

  await restoreSessions();
  // 복원 후 필터 재적용
  filterBoard();
  updateCounts();
  renderSidebar();
});
