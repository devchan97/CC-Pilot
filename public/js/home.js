// ── 홈 화면 ───────────────────────────────────────────────────────────────────

function setHomeMode(mode){
  AppState.homeMode = mode;
  document.querySelectorAll('.home-mode-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  // placeholder/sub 텍스트를 모드에 맞게 갱신
  const ta = document.getElementById('home-textarea');
  if(ta) ta.placeholder = t('home.mode_placeholder.'+mode) || ta.placeholder;
  // 캐러셀은 planning 모드에서만 표시
  const carousel = document.getElementById('carousel-wrap')?.closest('.home-carousel');
  if(carousel) carousel.style.display = mode === 'planning' ? '' : 'none';
}

function getHomeMode(){ return AppState.homeMode; }

// Claude Code가 지원하는 파일 확장자
const CLAUDE_SUPPORTED_EXTS = new Set([
  'txt','md','markdown','rst','csv','tsv','log',
  'js','ts','jsx','tsx','py','rb','go','rs','java',
  'c','cpp','h','hpp','cs','php','swift','kt','scala',
  'r','m','sh','bash','zsh','fish','ps1','bat','cmd',
  'json','yaml','yml','toml','ini','env','conf','config',
  'xml','html','htm','css','scss','sass','less',
  'tex','org','adoc','sql','graphql','proto',
  'vue','svelte','astro','prisma',
  // 이미지
  'png','jpg','jpeg','gif','webp','bmp','svg',
  // 확장자 없는 파일 (Dockerfile 등)은 별도 처리
]);

// 이미지 확장자 구분용
const _IMAGE_EXTS = new Set(['png','jpg','jpeg','gif','webp','bmp','svg']);

// 각 키의 마지막 사용 인덱스 추적 (같은 variant 반복 방지)
const _lastVariantIdx = {};

function setHomeTemplate(key){
  const ta = document.getElementById('home-textarea');
  const variants = HOME_VARIANTS[key];
  if(!variants || !variants.length){
    const lang = typeof getLang === 'function' ? getLang() : 'en';
    const tmpl = HOME_TEMPLATES[key];
    ta.value = (tmpl ? (tmpl['text_'+lang] || tmpl.text_en || (typeof tmpl==='string' ? tmpl : '')) : '') || '';
    ta.focus();
    return;
  }
  // 이전과 다른 랜덤 인덱스 선택
  let idx;
  do { idx = Math.floor(Math.random() * variants.length); }
  while(variants.length > 1 && idx === _lastVariantIdx[key]);
  _lastVariantIdx[key] = idx;

  const lang = typeof getLang === 'function' ? getLang() : 'en';
  ta.value = variants[idx]['text_'+lang] || variants[idx].text_en || variants[idx].text || '';
  ta.focus();

  // 버튼 flash 효과
  const tpl = HOME_BUTTONS_ORDER.find(t=>t.key===key);
  const tplLabel = tpl ? (typeof window.t==='function' ? window.t('home.btn.'+tpl.key) : (tpl.label||tpl.key)) : '';
  const btn = [...document.querySelectorAll('.home-quick-btn')]
    .find(b => tpl && b.textContent.trim() === tplLabel.trim());
  if(btn){
    btn.classList.add('active');
    setTimeout(()=>btn.classList.remove('active'), 400);
  }
}

// ── 홈 퀵버튼 캐러셀 (화살표 hover → 연속 스크롤) ────────────────────────────
let _carouselOffset = 0;
let _carouselRaf = null;

function _carouselMaxOff(){
  const track = document.getElementById('carousel-track');
  const wrap  = document.getElementById('carousel-wrap');
  if(!track||!wrap) return 0;
  return Math.max(0, track.scrollWidth - wrap.offsetWidth);
}

function _carouselApply(){
  const track = document.getElementById('carousel-track');
  const maxOff = _carouselMaxOff();
  _carouselOffset = Math.min(maxOff, Math.max(0, _carouselOffset));
  if(track) track.style.transform = `translateX(-${_carouselOffset}px)`;
  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  if(prev) prev.classList.toggle('carousel-edge', _carouselOffset <= 0);
  if(next) next.classList.toggle('carousel-edge', _carouselOffset >= maxOff);
}

function _carouselStartScroll(dir){
  if(_carouselRaf) return;
  const speed = 1.8; // px per frame
  function step(){
    _carouselOffset += dir * speed;
    _carouselApply();
    _carouselRaf = requestAnimationFrame(step);
  }
  _carouselRaf = requestAnimationFrame(step);
}

function _carouselStopScroll(){
  if(_carouselRaf){ cancelAnimationFrame(_carouselRaf); _carouselRaf = null; }
}

document.addEventListener('DOMContentLoaded', ()=>{
  // 셔플된 순서로 퀵버튼 렌더
  const track = document.getElementById('carousel-track');
  if(track){
    track.innerHTML = HOME_BUTTONS_ORDER.map(tpl=>
      `<button class="home-quick-btn" onclick="setHomeTemplate('${tpl.key}')">${typeof window.t==='function'?window.t('home.btn.'+tpl.key):(tpl.label||tpl.key)}</button>`
    ).join('');
  }

  const prev = document.getElementById('carousel-prev');
  const next = document.getElementById('carousel-next');
  if(prev){
    prev.addEventListener('mouseenter', ()=>_carouselStartScroll(-1));
    prev.addEventListener('mouseleave', _carouselStopScroll);
  }
  if(next){
    next.addEventListener('mouseenter', ()=>_carouselStartScroll(1));
    next.addEventListener('mouseleave', _carouselStopScroll);
  }
  window.addEventListener('resize', _carouselApply);
  _carouselApply();
});

function onHomeFileAttach(input){
  const files = [...input.files];
  let pending = 0;
  for(const f of files){
    const ext = f.name.split('.').pop().toLowerCase();
    if(!CLAUDE_SUPPORTED_EXTS.has(ext)){
      alert(t('err.file_type') + '.' + ext + '\n' + t('err.file_type_detail') + 'txt, md, js, ts, py, json, yaml…');
      continue;
    }
    if(AppState.homeFiles.find(x=>x.name===f.name)) continue;
    if(_IMAGE_EXTS.has(ext)){
      // 이미지: FileReader로 base64 변환
      pending++;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result; // data:<mime>;base64,<b64>
        const b64 = dataUrl.split(',')[1];
        const mimeType = f.type || ('image/'+ext);
        AppState.homeFiles.push({
          name: f.name, _isImage: true, _b64: b64, _mimeType: mimeType,
          text: async ()=> '',
        });
        pending--;
        if(pending === 0) renderHomeAttachments();
      };
      reader.readAsDataURL(f);
    } else {
      AppState.homeFiles.push(f);
    }
  }
  if(pending === 0) renderHomeAttachments();
  input.value = '';
}

function setHomeCwd(path){
  AppState.homeCwd = (path||'').trim();
  const badge = document.getElementById('home-cwd-badge');
  const clearBtn = document.getElementById('home-cwd-clear-btn');
  if(AppState.homeCwd){
    const label = AppState.homeCwd.replace(/\\/g,'/').split('/').filter(Boolean).pop() || AppState.homeCwd;
    badge.textContent = '📁 ' + label;
    badge.title = AppState.homeCwd;
    badge.style.display = '';
    if(clearBtn) clearBtn.style.display = '';
  } else {
    badge.style.display = 'none';
    if(clearBtn) clearBtn.style.display = 'none';
  }
}
function clearHomeCwd(){
  setHomeCwd('');
}

// 범용 OS 네이티브 폴더 선택 (inputId: 결과를 채울 input 요소 id, 없으면 홈 cwd로 설정)
async function openFolderDialogFor(inputId){
  try{
    const r = await fetch('/api/folder-dialog');
    const data = await r.json();
    if(!data.path) return;
    if(inputId){
      const el = document.getElementById(inputId);
      if(el) el.value = data.path;
    } else {
      setHomeCwd(data.path);
    }
    if(typeof rexLoad === 'function') rexLoad(data.path);
  }catch(e){ console.error('folder-dialog error', e); }
}

// 홈 화면용 폴더 선택 (하위호환)
async function openFolderDialog(){
  return openFolderDialogFor(null);
}

function renderHomeAttachments(){
  const el = document.getElementById('home-attachments');
  if(!AppState.homeFiles.length){ el.innerHTML=''; return; }
  el.innerHTML = AppState.homeFiles.map((f,i)=>{
    if(f._isImage && f._b64){
      return `<div class="home-attach-chip home-attach-img-chip">
        <img class="home-attach-thumb" src="data:${f._mimeType};base64,${f._b64}" alt="${esc(f.name)}">
        <span class="home-attach-img-name">${esc(f.name)}</span>
        <button onclick="removeHomeFile(${i})">✕</button>
      </div>`;
    }
    return `<div class="home-attach-chip">
      <span>📄 ${esc(f.name)}</span>
      <button onclick="removeHomeFile(${i})">✕</button>
    </div>`;
  }).join('');
}

function removeHomeFile(i){
  AppState.homeFiles.splice(i,1);
  renderHomeAttachments();
}

// 홈 분석 요청 AbortController
let _homeAnalysisAbort = null;

function _showHomeAnalyzing(show){
  const ov = document.getElementById('home-analyzing-overlay');
  if(!ov) return;
  ov.classList.toggle('open', show);
}

// 취소 버튼 핸들러 (DOMContentLoaded 이후 연결)
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('home-analyzing-cancel')?.addEventListener('click', ()=>{
    if(_homeAnalysisAbort){ _homeAnalysisAbort.abort(); _homeAnalysisAbort = null; }
    _showHomeAnalyzing(false);
    const btn = document.getElementById('home-send-btn');
    if(btn) btn.disabled = false;
  });
});

async function runHomeAnalysis(){
  const text = document.getElementById('home-textarea').value.trim();
  const hasFile = AppState.homeFiles.length > 0;
  if(!text && !hasFile){ alert(t('err.enter_text_or_file')); return; }

  const model = getSelectedModel();
  const lang  = typeof getLang === 'function' ? getLang() : 'en';
  const mode  = getHomeMode();

  // refactoring / enhancement는 기존 코드베이스 대상이므로 작업 폴더 필수
  if(mode !== 'planning' && !AppState.homeCwd){
    await showConfirm(t('err.need_folder'), {icon:'📁', okText:'OK', cancelText:'', safe:true});
    return;
  }
  const btn = document.getElementById('home-send-btn');
  btn.disabled = true;
  _homeAnalysisAbort = new AbortController();
  _showHomeAnalyzing(true);

  try{
    let result;
    // 텍스트 파일 vs 이미지 파일 분리
    const textFiles  = AppState.homeFiles.filter(f => !f._isImage);
    const imageFiles = AppState.homeFiles.filter(f => f._isImage);

    // 이미지는 design_files 페이로드로, 텍스트는 본문에 합산
    const designFiles = imageFiles.map(f=>({
      name: f.name, isImage: true, mimeType: f._mimeType, data: f._b64
    }));

    const signal = _homeAnalysisAbort.signal;

    if(textFiles.length > 0 && !text){
      // 텍스트 파일만 있고 직접 입력이 없으면 첫 파일을 multipart로 전송
      const fd = new FormData();
      // _rexPath(서버 경로) 파일은 Blob 형태로 변환
      const firstFile = textFiles[0];
      if(firstFile._rexPath){
        fd.append('file', new Blob([firstFile._text||''], {type:'text/plain'}), firstFile.name);
      } else {
        fd.append('file', firstFile);
      }
      fd.append('cwd', AppState.homeCwd);
      fd.append('model', model);
      fd.append('lang', lang);
      fd.append('mode', mode);
      const r = await fetch('/api/plan/file', {method:'POST', body:fd, signal});
      result = await r.json();
    } else {
      let combined = text;
      // 텍스트 파일 내용 합치기
      for(const f of textFiles){
        const content = await f.text();
        combined += '\n\n---\nFile: '+f.name+'\n'+content;
      }
      const r = await fetch('/api/plan/text', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text: combined, cwd: AppState.homeCwd, model, lang, mode, design_files: designFiles}),
        signal
      });
      result = await r.json();
    }

    if(result.error){ alert(t('err.analysis')+result.error); return; }
    if(!result.agents||!result.agents.length){ alert(t('err.no_agents')); return; }

    // 프로젝트명 추출: 첫 줄 또는 요약에서
    const defaultName = result.summary
      ? result.summary.slice(0,30).replace(/[^\w가-힣\s]/g,'').trim() || '새 프로젝트'
      : '새 프로젝트';

    AppState.spawnSummary = result.summary || '';
    AppState.spawnRootCwd = AppState.homeCwd;
    AppState.spawnDefaultName = defaultName;
    AppState.spawnPrereqs = result.prerequisites || [];
    showSpawnModal(result.agents, true);

  }catch(e){
    if(e.name === 'AbortError') return; // 취소 시 무시
    alert(t('err.request_failed')+e);
  }finally{
    _homeAnalysisAbort = null;
    btn.disabled = false;
    _showHomeAnalyzing(false);
  }
}

// textarea auto-resize + Explorer 파일 드래그 앤 드롭
document.addEventListener('DOMContentLoaded', ()=>{
  const ta = document.getElementById('home-textarea');
  ta?.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 300)+'px';
  });
  ta?.addEventListener('keydown', e=>{
    if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); runHomeAnalysis(); }
  });

  // Explorer rsidebar 파일 → home-input-box 드롭 첨부
  const box = document.getElementById('home-input-box');
  if(box){
    box.addEventListener('dragover', e=>{
      if(e.dataTransfer.types.includes('text/rex-path')){
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        box.classList.add('drag-over');
      }
    });
    box.addEventListener('dragleave', e=>{
      if(!box.contains(e.relatedTarget)) box.classList.remove('drag-over');
    });
    box.addEventListener('drop', async e=>{
      const path = e.dataTransfer.getData('text/rex-path');
      if(!path){ box.classList.remove('drag-over'); return; }
      e.preventDefault();
      box.classList.remove('drag-over');
      // 확장자 검증
      const fname = path.replace(/\\/g,'/').split('/').pop();
      const ext = fname.split('.').pop().toLowerCase();
      if(!CLAUDE_SUPPORTED_EXTS.has(ext)){
        showConfirm(t('err.file_type') + '.' + ext, {icon:'⚠', okText:'OK', cancelText:'', safe:true});
        return;
      }
      // 중복 방지
      if(AppState.homeFiles.find(f=>f._rexPath===path)) return;
      const isImage = _IMAGE_EXTS.has(ext);
      try{
        const r = await fetch('/api/explorer/read', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({path, as_image: isImage})
        });
        const data = await r.json();
        if(data.error){ console.warn(t('err.file_read'), data.error); return; }
        let fakeFile;
        if(isImage){
          // 이미지: base64 데이터로 fakeFile 구성
          const mimeType = data.mime_type || ('image/'+ext);
          fakeFile = {
            name: fname, _rexPath: path, _isImage: true,
            _b64: data.b64, _mimeType: mimeType,
            text: async ()=> '',
          };
        } else {
          fakeFile = { name: fname, _rexPath: path, _text: data.content,
            text: async ()=> data.content };
        }
        AppState.homeFiles.push(fakeFile);
        renderHomeAttachments();
      }catch(err){ console.error('drop read error', err); }
    });
  }
});
