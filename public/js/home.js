// ── 홈 화면 ───────────────────────────────────────────────────────────────────
let _homeFiles = [];
let _homeCwd   = '';

// 각 키의 마지막 사용 인덱스 추적 (같은 variant 반복 방지)
const _lastVariantIdx = {};

function setHomeTemplate(key){
  const ta = document.getElementById('home-textarea');
  const variants = HOME_VARIANTS[key];
  if(!variants || !variants.length){
    ta.value = HOME_TEMPLATES[key] || '';
    ta.focus();
    return;
  }
  // 이전과 다른 랜덤 인덱스 선택
  let idx;
  do { idx = Math.floor(Math.random() * variants.length); }
  while(variants.length > 1 && idx === _lastVariantIdx[key]);
  _lastVariantIdx[key] = idx;

  ta.value = variants[idx].text;
  ta.focus();

  // 버튼 flash 효과
  const tpl = HOME_BUTTONS_ORDER.find(t=>t.key===key);
  const btn = [...document.querySelectorAll('.home-quick-btn')]
    .find(b => tpl && b.textContent.trim() === (tpl.icon+' '+tpl.label).trim());
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
    track.innerHTML = HOME_BUTTONS_ORDER.map(t=>
      `<button class="home-quick-btn" onclick="setHomeTemplate('${t.key}')">${t.icon} ${t.label}</button>`
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
  for(const f of input.files){
    if(!_homeFiles.find(x=>x.name===f.name)) _homeFiles.push(f);
  }
  renderHomeAttachments();
  input.value = '';
}

function setHomeCwd(path){
  _homeCwd = (path||'').trim();
  const badge = document.getElementById('home-cwd-badge');
  const clearBtn = document.getElementById('home-cwd-clear-btn');
  if(_homeCwd){
    const label = _homeCwd.replace(/\\/g,'/').split('/').filter(Boolean).pop() || _homeCwd;
    badge.textContent = '📁 ' + label;
    badge.title = _homeCwd;
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

function renderHomeAttachments(){
  const el = document.getElementById('home-attachments');
  if(!_homeFiles.length){ el.innerHTML=''; return; }
  el.innerHTML = _homeFiles.map((f,i)=>`
    <div class="home-attach-chip">
      <span>📄 ${esc(f.name)}</span>
      <button onclick="removeHomeFile(${i})">✕</button>
    </div>`).join('');
}

function removeHomeFile(i){
  _homeFiles.splice(i,1);
  renderHomeAttachments();
}

async function runHomeAnalysis(){
  const text = document.getElementById('home-textarea').value.trim();
  const hasFile = _homeFiles.length > 0;
  if(!text && !hasFile){ alert('텍스트를 입력하거나 파일을 첨부하세요.'); return; }

  const model = getSelectedModel();
  const btn = document.getElementById('home-send-btn');
  btn.disabled = true;
  showLoading(true);

  try{
    let result;
    if(hasFile && !text){
      // 파일만 있으면 첫 파일을 텍스트로 읽어 전송
      const fd = new FormData();
      fd.append('file', _homeFiles[0]);
      fd.append('cwd', _homeCwd);
      fd.append('model', model);
      const r = await fetch('/api/plan/file', {method:'POST', body:fd});
      result = await r.json();
    } else {
      let combined = text;
      // 텍스트 + 파일 내용 합치기
      for(const f of _homeFiles){
        const content = await f.text();
        combined += '\n\n---\n파일: '+f.name+'\n'+content;
      }
      const r = await fetch('/api/plan/text', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({text: combined, cwd: _homeCwd, model})
      });
      result = await r.json();
    }

    if(result.error){ alert('분석 오류: '+result.error); return; }
    if(!result.agents||!result.agents.length){ alert('에이전트 제안이 없습니다. 내용을 더 구체적으로 작성해보세요.'); return; }

    // 프로젝트명 추출: 첫 줄 또는 요약에서
    const defaultName = result.summary
      ? result.summary.slice(0,30).replace(/[^\w가-힣\s]/g,'').trim() || '새 프로젝트'
      : '새 프로젝트';

    _spawnSummary = result.summary || '';
    _spawnRootCwd = _homeCwd;
    _spawnDefaultName = defaultName;
    showSpawnModal(result.agents, true);

  }catch(e){
    alert('요청 실패: '+e);
  }finally{
    btn.disabled = false;
    showLoading(false);
  }
}

// textarea auto-resize
document.addEventListener('DOMContentLoaded', ()=>{
  const ta = document.getElementById('home-textarea');
  ta?.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 300)+'px';
  });
  ta?.addEventListener('keydown', e=>{
    if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); runHomeAnalysis(); }
  });
});
