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
    try{ localStorage.setItem('rsidebar_open','1'); }catch(e){}
  }
  if(!_rexDir) rexLoad('');
  // 열린 overlay가 있으면 pointer-events를 none으로 해 rsidebar 클릭 허용
  document.querySelectorAll('.overlay.open').forEach(el=>{
    el.dataset.rexPickBlocked = '1';
    el.style.pointerEvents = 'none';
  });
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
    bar.innerHTML = `<span class="rex-pick-hint">${t('explorer.pick_hint')}</span>
      <button class="rex-pick-btn" onclick="rexConfirmPick()">${t('explorer.pick_confirm')}</button>
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
  // overlay pointer-events 복원
  document.querySelectorAll('.overlay[data-rex-pick-blocked]').forEach(el=>{
    el.style.pointerEvents = '';
    delete el.dataset.rexPickBlocked;
  });
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

// VSCode 스타일 트리: { path, open } 상태 관리
const _rexTree = new Map(); // path → { items, open }
let _rexSelected = null;

async function rexLoad(dir){
  const list = document.getElementById('rex-list');
  if(!list) return;
  list.innerHTML = '<div class="rex-empty">'+t('explorer.loading')+'</div>';
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
    const upBtn = document.getElementById('rex-up-btn');
    if(upBtn) upBtn.disabled = !data.parent;
    // 루트 변경 시 트리 초기화
    _rexTree.clear();
    _rexTree.set(_rexDir, { items: data.items, open: true });
    _rexSelected = null;
    _rexRenderTree(list);
    if(_rexPickTarget) _rexUpdatePickBar();
  }catch(e){
    list.innerHTML = `<div class="rex-empty rex-error">${t('explorer.load_fail')}<br><small>${esc(String(e))}</small></div>`;
  }
}

function _rexRenderTree(list){
  if(!list) return;
  const root = _rexTree.get(_rexDir);
  if(!root || !root.items.length){
    list.innerHTML = '<div class="rex-empty">'+t('explorer.empty')+'</div>';
    return;
  }
  list.innerHTML = '';
  _rexRenderItems(list, root.items, 0);
}

function _rexRenderItems(container, items, depth){
  for(const item of items){
    const row = document.createElement('div');
    row.className = 'rex-row' + (item.is_dir ? ' rex-dir' : ' rex-file') + (_rexSelected === item.path ? ' rex-selected' : '');
    row.dataset.path = item.path;
    row.dataset.isdir = item.is_dir;
    row.dataset.depth = depth;
    row.style.paddingLeft = (8 + depth * 12) + 'px';
    row.title = item.path;

    const chevron = document.createElement('span');
    chevron.className = 'rex-chevron';
    if(item.is_dir){
      const node = _rexTree.get(item.path);
      chevron.textContent = (node && node.open) ? '▾' : '▸';
    } else {
      chevron.textContent = '';
    }

    const icon = document.createElement('span');
    icon.className = 'rex-icon';
    icon.textContent = item.is_dir ? (_rexTree.get(item.path)?.open ? '📂' : '📁') : _rexFileIcon(item.name);

    const name = document.createElement('span');
    name.className = 'rex-name';
    name.textContent = item.name;

    row.appendChild(chevron);
    row.appendChild(icon);
    row.appendChild(name);

    // 파일만 드래그 가능 (홈 textarea에 첨부) — 지원하지 않는 형식은 드래그 불가
    if(!item.is_dir){
      const _ext = item.name.split('.').pop().toLowerCase();
      if(typeof CLAUDE_SUPPORTED_EXTS !== 'undefined' && !CLAUDE_SUPPORTED_EXTS.has(_ext)){
        row.draggable = false;
        row.classList.add('rex-unsupported');
        row.title = item.path + ' (unsupported)';
      } else {
        row.draggable = true;
        const _isImg = typeof _IMAGE_EXTS !== 'undefined' && _IMAGE_EXTS.has(_ext);
        row.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/rex-path', item.path);
          if(_isImg) e.dataTransfer.setData('text/rex-is-image', '1');
          e.dataTransfer.effectAllowed = 'copy';
        });
      }
    }

    if(!item.is_dir){
      const size = document.createElement('span');
      size.className = 'rex-size';
      size.textContent = _rexFmtSize(item.size);
      row.appendChild(size);
    }

    row.addEventListener('click', (e) => _rexRowClick(e, row, item));
    container.appendChild(row);

    // 열린 폴더면 자식 렌더
    if(item.is_dir && _rexTree.get(item.path)?.open){
      const node = _rexTree.get(item.path);
      if(node.items) _rexRenderItems(container, node.items, depth + 1);
    }
  }
}

async function _rexRowClick(e, row, item){
  e.stopPropagation();
  _rexSelected = item.path;

  if(item.is_dir){
    const node = _rexTree.get(item.path);
    if(node){
      // 이미 로드됨 → 토글
      node.open = !node.open;
      _rexRenderTree(document.getElementById('rex-list'));
    } else {
      // 처음 열기 → fetch
      try{
        const r = await fetch('/api/explorer?dir=' + encodeURIComponent(item.path));
        const data = await r.json();
        _rexTree.set(item.path, { items: data.items || [], open: true });
      }catch(e){ _rexTree.set(item.path, { items: [], open: true }); }
      _rexRenderTree(document.getElementById('rex-list'));
    }
  } else {
    // 파일: 선택만 (더블클릭은 탐색기 열기)
    _rexRenderTree(document.getElementById('rex-list'));
    // 더블클릭 감지
    const now = Date.now();
    if(_rexLastClick.item === item.path && now - _rexLastClick.time < 500){
      _rexLastClick = { item: null, time: 0 };
      fetch('/api/explorer/open', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({path: item.path})
      }).catch(()=>{});
      return;
    }
    _rexLastClick = { item: item.path, time: now };
  }
}

function _rexUpdatePathBar(path){
  const span = document.getElementById('rex-path');
  if(!span) return;
  span.textContent = path;
  span.title = t('explorer.path_hint') + path;
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
  _restoreUsagePlan();
  ['home-model-sel','modal-model'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change',function(){syncModelSels(id,this.value);});
  });

  await loadProjects();

  // 저장된 활성 프로젝트 복원
  const savedPid = AppState.activeProjectId;
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
