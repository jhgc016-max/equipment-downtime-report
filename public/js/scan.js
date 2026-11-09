/* 스캔본 읽기 화면 — 지시문 · 답 읽기 · 검사 · 변환은 scanread.js 가 한다. 여기서는 파일을 보여 주고, 고친 값을 들고, 집계 화면으로 넘길 뿐이다. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var S = window.Scan, D = window.Downtime;
  var LS_AI = 'build-2611-11.ai', LS_SCAN = 'build-2611-11.scan', LS_SET = 'build-2611-11.settings';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var busy = false, nextId = 1;
  var state = { files: [], pages: [] };            // files: { name, mime, base64, url } · pages: { page, src(파일 이름), issues }
  function msg(id, html, cls) { $(id).innerHTML = html ? '<div class="' + (cls || 'note') + '">' + html + '</div>' : ''; }
  function settings() { try { return D.normSettings(JSON.parse(localStorage.getItem(LS_SET) || 'null') || {}); } catch (e) { return D.normSettings({}); } }
  // 집계 설정의 범례와 사유 이름. 전달할 원본 코드는 변경하지 않는다.
  function legend() { var st = settings(); return { mach: st.codes.map(function (c) { return c.code; }), weld: st.weldCodes.map(function (c) { return c.code; }) }; }
  function codeMap() { var st = settings(), m = { mach: {}, weld: {} }; st.codes.forEach(function (c) { m.mach[c.label] = c.code; }); st.weldCodes.forEach(function (c) { m.weld[c.label] = c.code; }); return m; }

  /* ---------- 1. 파일 ---------- */
  function addFiles(list) {
    Array.prototype.forEach.call(list, function(f) {
      var mime=f.type || (/\.pdf$/i.test(f.name)?'application/pdf':'');
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(mime) || f.size > 10*1024*1024) { msg('sc-msg',esc(f.name)+': JPG·PNG·WEBP·PDF, 최대 10MB만 지원합니다.','warn'); return; }
      var item={id:nextId++,name:f.name,mime:mime,status:'loading'};
      state.files.push(item);
      var rd=new FileReader();
      rd.onload=function(e) {item.url=URL.createObjectURL(f);item.base64=String(e.target.result).split(',')[1];item.status='pending';renderThumbs();};
      rd.onerror=function(){item.status='failed';item.error='파일 읽기 실패';renderThumbs();};
      rd.readAsDataURL(f);
    });
    renderThumbs();
  }
  function renderThumbs() {
    $('sc-thumbs').innerHTML = state.files.map(function (f, i) {
      return '<figure class="thumb">' + (/pdf/i.test(f.mime) ? '<div class="pdfbox">PDF</div>' : '<img src="' + (f.url || '') + '" alt="' + esc(f.name) + '">') + '<figcaption>' + esc(f.name) + ' · ' + esc(f.error || ({loading:'파일 읽는 중',pending:'대기',reading:'AI 처리 중',done:'완료',failed:'실패'})[f.status]) + (f.status === 'failed' && f.base64 ? ' <button type="button" data-retry="' + i + '">이 파일 다시 처리</button>' : '') + ' <button class="x" data-rm="' + i + '" type="button">빼기</button></figcaption></figure>';
    }).join('');
    syncRun();
  }
  function canRead() { return $('sc-provider').value === 'chatgpt' ? window.ScanChatGPT && window.ScanChatGPT.ready() : !!$('sc-key').value.trim(); }
  function syncRun() { $('btn-sc-run').disabled = busy || !(state.files.some(function(f){return f.status==='pending';}) && $('sc-agree').checked && canRead()); }
  async function runFile(f) {
    f.status='reading'; f.error='';renderThumbs();
    try {
      var j;
      if ($('sc-provider').value === 'chatgpt') { j=await window.ScanChatGPT.read(f,$('sc-form').value); } else {
      var api=window.ScanAPI;
      var response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+$('sc-key').value.trim()},
        body:JSON.stringify(api.buildRequest(f,$('sc-form').value)),signal:AbortSignal.timeout(195000),credentials:'omit',redirect:'error'
      });
      if(!response.ok) { await response.body?.cancel(); throw api.upstreamError(response.status); }
      var payload;try {payload=await response.json();}catch(e){throw new Error('OpenAI 응답을 읽을 수 없습니다. 이 파일만 다시 처리하세요.');}
      j=api.convert(payload);
      }
      j.pages.forEach(function(p){state.pages.push({page:p,src:f.name+' · '+p.sourcePage+'쪽',fileId:f.id});});
      state.pages.sort(function(a,b){return (a.fileId || 0)-(b.fileId || 0) || (a.page.sourcePage || 0)-(b.page.sourcePage || 0);});
      f.status='done'; $('sc-reviewed').checked=false;renderPages();
    } catch(e) {f.status='failed';f.error=e.name==='TypeError'?'OpenAI 연결 실패: 인터넷 연결 또는 브라우저의 외부 요청 차단을 확인하세요.':e.message;}
    renderThumbs();
  }
  async function run(only) {
    if(busy || !$('sc-agree').checked || !canRead()) return;
    busy=true;syncRun();
    var files=only?[only]:state.files.filter(function(f){return f.status==='pending';});
    for(var f of files) {msg('sc-msg',esc(f.name)+' 읽는 중…','note');await runFile(f);}
    busy=false;syncRun();
    msg('sc-msg',state.files.some(function(f){return f.status==='failed';})?'일부 파일이 실패했습니다. 파일별 오류를 확인하고 해당 파일만 다시 처리하세요.':'읽기가 끝났습니다. 원본과 모든 페이지를 확인하세요.',state.files.some(function(f){return f.status==='failed';})?'warn':'ok');
  }
  function usePages(r, src) {
    if (r.error) { msg('sc-msg', esc(r.error), 'warn'); return; }
    r.pages.forEach(function (p) { state.pages.push({ page: p, src: src }); });
    var sm = S.summary(r.pages);
    msg('sc-msg', '읽었습니다 — 일보 ' + sm.pages + '장 · 비가동 ' + sm.downtime + '줄 · 작업 ' + sm.work + '줄. 아래 3 에서 원본과 대조해 주세요.', 'ok');
    renderPages();
  }

  /* ---------- 3. 확인 · 수정 ---------- */
  function renderPages() {
    var lg = legend();
    $('s-pages').hidden = !state.pages.length; $('s-send').hidden = !state.pages.length;
    $('sc-count').textContent = state.pages.length + '장';
    $('sc-pages').innerHTML = state.pages.map(function (e, pi) {
      var p = e.page, F = S.FORMS[p.form], issues = S.validate(p, lg); e.issues = issues;
      var img = state.files.filter(function(f) {return f.id === e.fileId;})[0];
      var h = '<div class="page" data-p="' + pi + '"><div class="page-h"><h3>' + (pi + 1) + '. ' + esc(F.name) + '</h3><span class="sub">' + esc(e.src) + '</span>' + (p.confidence ? '<span class="tag' + (p.confidence === 'low' ? ' bad-t' : '') + '">AI 확신 ' + esc(p.confidence) + '</span>' : '') + '<button class="x" data-del-page="' + pi + '" type="button">이 장 빼기</button></div>';
      h += '<div class="page-body">' + (img ? '<div class="orig">' + (/pdf/i.test(img.mime) ? '<iframe title="PDF 원본" style="width:100%;height:650px" src="' + img.url + '#page=' + p.sourcePage + '"></iframe><a target="_blank" rel="noopener" href="' + img.url + '#page=' + p.sourcePage + '">원본 페이지 열기</a>' : '<img src="' + img.url + '" alt="원본">') + '</div>' : '') + '<div class="vals">';
      h += '<div class="fgrid">' + [['equipment', '설비명 · 트랙'], ['worker', '작업자'], ['date', '작업일자'], ['start', '시작시간'], ['end', '종료시간']].map(function (f) {
        return '<label>' + f[1] + '<input type="text" data-pf="' + f[0] + '" value="' + esc(p[f[0]]) + '" placeholder="' + (f[0] === 'date' ? '2026-11-03' : f[0] === 'start' || f[0] === 'end' ? '08:00' : '') + '"></label>';
      }).join('') + '<label>양식<select data-pf="form"><option value="mach"' + (p.form === 'mach' ? ' selected' : '') + '>생산작업일보(가공)</option><option value="weld"' + (p.form === 'weld' ? ' selected' : '') + '>용접 ROBOT 가동일보</option></select></label></div>';
      h += '<h4>비가동 내역 <small class="sub">범례 ' + settings()[p.form === 'weld' ? 'weldCodes' : 'codes'].map(function (c) { return c.code + ' ' + c.label; }).join(' · ') + '</small></h4>';
      h += '<div class="tablewrap"><table class="dt"><thead><tr><th>순번</th><th>범례</th><th>시작</th><th>종료</th><th>내역</th><th></th></tr></thead><tbody>' + p.downtime.map(function (d, di) {
        return '<tr><td>' + d.no + '</td><td><input class="code" data-dt="' + di + '" data-k="code" value="' + esc(d.code || d.rawCode) + '" maxlength="2"></td><td><input class="tm" data-dt="' + di + '" data-k="start" value="' + esc(d.start) + '"></td><td><input class="tm" data-dt="' + di + '" data-k="end" value="' + esc(d.end) + '"></td><td><input class="wide" data-dt="' + di + '" data-k="note" value="' + esc(d.note) + '"></td><td><button class="x" data-dt-del="' + di + '" type="button">빼기</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="btnrow"><button class="btn sm" data-dt-add="' + pi + '" type="button">비가동 줄 더하기</button></div>';
      h += '<details class="box"><summary>' + (p.form === 'weld' ? '생산 현황' : '일 작업 내역') + ' ' + p.work.length + '줄(가동 시간으로 보냄)</summary><div class="tablewrap"><table class="dt"><thead><tr><th>순번</th><th>시작</th><th>종료</th><th>' + (p.form === 'weld' ? 'Model' : '기종 · 품명 · 작업명') + '</th><th>수량</th><th>비고</th><th></th></tr></thead><tbody>' + p.work.map(function (w, wi) {
        return '<tr><td>' + w.no + '</td><td><input class="tm" data-wk="' + wi + '" data-k="start" value="' + esc(w.start) + '"></td><td><input class="tm" data-wk="' + wi + '" data-k="end" value="' + esc(w.end) + '"></td><td><input class="wide" data-wk="' + wi + '" data-k="job" value="' + esc([w.model, w.part, w.job].filter(Boolean).join(' · ')) + '"></td><td><input class="code" data-wk="' + wi + '" data-k="qty" value="' + esc(w.qty) + '"></td><td><input data-wk="' + wi + '" data-k="note" value="' + esc(w.note) + '"></td><td><button class="x" data-wk-del="' + wi + '" type="button">빼기</button></td></tr>';
      }).join('') + '</tbody></table></div><div class="btnrow"><button class="btn sm" data-wk-add="' + pi + '" type="button">작업 줄 더하기</button></div></details>';
      if (p.checks.length) h += '<p class="sub">장비 점검: ' + p.checks.map(function (c) { return esc(c.item) + ' ' + (c.status || '(미표시)'); }).join(' · ') + '</p>';
      if (p.raw) h += '<details><summary>AI가 읽은 원문 (수정 전)</summary><pre style="white-space:pre-wrap">' + esc(JSON.stringify(p.raw,null,2)) + '</pre></details>';
      if (p.special) h += '<p class="sub">특이사항: ' + esc(p.special) + '</p>';
      h += issues.length ? '<div class="warn"><b>확인할 것 ' + issues.length + '건</b><ul>' + issues.map(function (x) { return '<li>' + esc(x.where) + ' — ' + esc(x.what) + '</li>'; }).join('') + '</ul></div>' : '<div class="ok">확인할 것이 없습니다.</div>';
      h += '</div></div></div>';
      return h;
    }).join('');
    $('sc-reviewed').checked = false;
    renderPreview();
  }
  function renderPreview() {
    var rows = S.toFormRows(state.pages.map(function (e) { return e.page; }), codeMap()), sm = S.summary(state.pages.map(function (e) { return e.page; }));
    $('sc-preview').innerHTML = '<p class="sub">입력 양식 ' + (rows.length - 1) + '줄(비가동 ' + sm.downtime + ' · 가동 ' + sm.work + ') · 비가동 합계 ' + sm.downMinutes + '분</p><div class="tablewrap small"><table><thead><tr>' + rows[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.slice(1, 40).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + (rows.length > 41 ? '<p class="sub">… 외 ' + (rows.length - 41) + '줄</p>' : '');
  }
  function pageAt(el) { var box = el.closest('.page'); return box ? state.pages[+box.dataset.p] : null; }
  function onEdit(e) {
    var t = e.target, pe = pageAt(t); if (!pe) return; var p = pe.page;
    if (t.dataset.pf) { p[t.dataset.pf] = t.dataset.pf === 'form' ? t.value : (t.dataset.pf === 'date' ? (S.date(t.value) || t.value.trim()) : (t.dataset.pf === 'start' || t.dataset.pf === 'end') ? (S.time(t.value) || t.value.trim()) : t.value.trim()); }
    else if (t.dataset.dt != null) { var d = p.downtime[+t.dataset.dt], k = t.dataset.k; d[k] = k === 'code' ? S.code(t.value) : (k === 'start' || k === 'end') ? (S.time(t.value) || t.value.trim()) : t.value.trim(); if (k === 'code') d.rawCode = t.value.trim(); }
    else if (t.dataset.wk != null) { var w = p.work[+t.dataset.wk], kk = t.dataset.k; if (kk === 'job') { w.model = ''; w.part = ''; w.job = t.value.trim(); } else w[kk] = (kk === 'start' || kk === 'end') ? (S.time(t.value) || t.value.trim()) : t.value.trim(); }
    else return;
    renderPages();
  }
  function onClick(e) {
    var t = e.target;
    if (t.dataset.delPage != null) { state.pages.splice(+t.dataset.delPage, 1); renderPages(); return; }
    var pe = pageAt(t); if (!pe) return; var p = pe.page;
    if (t.dataset.dtDel != null) p.downtime.splice(+t.dataset.dtDel, 1);
    else if (t.dataset.dtAdd != null) p.downtime.push({ no: p.downtime.length + 1, code: '', rawCode: '', start: '', end: '', note: '' });
    else if (t.dataset.wkDel != null) p.work.splice(+t.dataset.wkDel, 1);
    else if (t.dataset.wkAdd != null) p.work.push({ no: p.work.length + 1, start: '', end: '', model: '', part: '', job: '', qty: '', note: '', code: '' });
    else return;
    renderPages();
  }

  /* ---------- 4. 보내기 ---------- */
  function rows() { return S.toFormRows(state.pages.map(function (e) { return e.page; }), codeMap()); }
  function send() {
    if (busy) { msg('sc-send-msg','AI 처리가 끝난 후 모든 페이지를 확인하세요.','warn'); return; }
    if (!$('sc-reviewed').checked) { msg('sc-send-msg','원본과 검토 항목을 확인한 후 확인란을 선택하세요.','warn'); return; }
    var r = rows(); if (r.length < 2) { msg('sc-send-msg', '보낼 줄이 없습니다.', 'warn'); return; }
    var open = state.pages.reduce(function (n, e) { return n + (e.issues || []).length; }, 0);
    try { localStorage.setItem(LS_SCAN, JSON.stringify({ at: new Date().toISOString(), name: '스캔본 읽은 값(' + state.pages.length + '장)', aoa: r, issues: open })); }
    catch (e) { msg('sc-send-msg', '브라우저 저장에 실패했습니다. 엑셀로 내려받아 집계 화면에 올려 주세요.', 'warn'); return; }
    location.href = 'index.html#scan';
  }
  function xlsx() {
    if (busy) { msg('sc-send-msg','AI 처리가 끝난 후 모든 페이지를 확인하세요.','warn'); return; }
    if (!$('sc-reviewed').checked) { msg('sc-send-msg','원본 확인란을 선택한 후 내려받으세요.','warn'); return; }
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows()), '비가동일보');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(D.legendRows(settings())), '범례');
    XLSX.writeFile(wb, '비가동일보_스캔본읽기_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }

  /* ---------- 이벤트 ---------- */
  var drop = $('sc-drop');
  ['dragover', 'dragenter'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  $('sc-file').addEventListener('change', function () { addFiles(this.files); this.value = ''; });
  $('sc-thumbs').addEventListener('click',function(e){
    if(busy) return;
    if(e.target.dataset.retry!=null) {run(state.files[+e.target.dataset.retry]);return;}
    if(e.target.dataset.rm!=null) {var f=state.files.splice(+e.target.dataset.rm,1)[0];URL.revokeObjectURL(f.url);state.pages=state.pages.filter(function(p){return p.fileId!==f.id;});renderThumbs();renderPages();}
  });
  $('btn-sc-sample').addEventListener('click', function () { usePages(S.parseReply(S.sampleReply()), '예제(가짜 일보)'); });
  $('btn-sc-manual').addEventListener('click', function () { state.pages.push({ page: S.blankPage('mach'), src: '손으로 입력' }); renderPages(); });
  $('btn-sc-manual-w').addEventListener('click', function () { state.pages.push({ page: S.blankPage('weld'), src: '손으로 입력' }); renderPages(); });
  $('btn-sc-clear').addEventListener('click', function () { if(busy) return; state.files.forEach(function(f){URL.revokeObjectURL(f.url);});state.files = []; state.pages = []; renderThumbs(); renderPages(); msg('sc-msg', ''); });
  try {localStorage.removeItem(LS_AI);} catch(e) {}
  $('sc-forget').addEventListener('click', function () { localStorage.removeItem(LS_AI); $('sc-key').value = ''; syncRun(); });
  ['input', 'change'].forEach(function (t) { $('sc-key').addEventListener(t, syncRun); $('sc-agree').addEventListener(t, syncRun); });
  $('btn-sc-run').addEventListener('click', function(){run();});
  $('sc-pages').addEventListener('change', onEdit);
  $('sc-pages').addEventListener('click', onClick);
  $('btn-sc-send').addEventListener('click', send);
  $('btn-sc-xlsx').addEventListener('click', xlsx);
  if (window.ScanChatGPT) window.ScanChatGPT.init(syncRun);
  syncRun();
})();
