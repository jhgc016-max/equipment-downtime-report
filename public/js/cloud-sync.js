/* Public shared workspace; ChatGPT credentials never enter this module. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.DowntimeSyncConfig || {};
  let client, store, adapter, applying = false, connected = false, timer, polling;
  function say(text) { $('sync-status').textContent = text; }
  function state(s) {
    say(s.message); $('sync-conflict').hidden = !s.conflict;
    $('sync-now').disabled = !store;
  }
  function settings() { try { return JSON.parse(localStorage.getItem('build-2611-11.settings') || '{}'); } catch { return {}; } }
  function current() { return adapter ? adapter.get() : store?.current() || { version: 1, files: [], settings: settings() }; }
  function apply(value) {
    applying = true;
    try { localStorage.setItem('build-2611-11.settings', JSON.stringify(value.settings)); if (adapter) adapter.apply(value); }
    finally { applying = false; }
  }
  async function attach() {
    connected = false;
    clearInterval(polling);
    const local = adapter ? adapter.get() : { version: 1, files: [], settings: settings() };
    store = new window.DowntimeSync.Store({
      storage: localStorage, apply, status: state,
      remote: {
        async read(_user, knownRevision) {
          if (Number.isInteger(knownRevision)) {
            const meta = await client.from('downtime_shared_workspace').select('revision').eq('id', 'public').maybeSingle();
            if (meta.error) throw meta.error;
            if (!meta.data || meta.data.revision === knownRevision) return null;
          }
          const { data, error } = await client.from('downtime_shared_workspace').select('revision,payload,updated_at').eq('id', 'public').maybeSingle();
          if (error) throw error; return data;
        },
        async write(revision, payload) {
          const { data, error } = await client.rpc('save_shared_downtime_workspace', { expected_revision: revision, workspace: payload });
          if (error) throw error; return data;
        }
      }
    });
    await store.connect('public-shared-v1', local);
    connected = true;
    polling = setInterval(() => { if (connected) store.poll(); }, 15000);
  }
  async function sdk() {
    if (window.supabase) return window.supabase;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js';
      script.onload = () => resolve(window.supabase); script.onerror = () => reject(new Error('SDK download failed'));
      document.head.appendChild(script);
    });
  }
  function backup(value, name) {
    if (!value) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    a.download = name + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function init() {
    const panel = document.createElement('section'); panel.className = 'card'; panel.id = 'cloud-sync';
    panel.innerHTML = `<h2 style="margin-top:0">공개 자료 자동 동기화</h2>
      <p class="sub">이메일 인증 없이 확인한 작업일보·엑셀 자료와 기준 설정을 모든 PC·공개 사이트에서 함께 사용합니다. 누구나 공유 자료를 보고 수정할 수 있습니다. 원본 PDF·사진은 업로드하지 않습니다. PDF 읽기는 PC에서 ChatGPT로 로그인하세요.</p>
      <p><span id="sync-status" role="status">공개 자료 연결 중…</span></p>
      <div class="btnrow"><button class="btn" id="sync-now" type="button" disabled>지금 동기화</button></div>
      <div class="warn" id="sync-conflict" hidden><b>어느 자료를 사용할까요?</b><p>자동으로 덮어쓰지 않았습니다. 교체 전 이 PC 자료와 클라우드 자료를 내려받아 비교할 수 있습니다.</p><div class="btnrow"><button class="btn" id="sync-local-copy" type="button">이 PC 백업(JSON)</button><button class="btn" id="sync-cloud-copy" type="button">클라우드 백업(JSON)</button><button class="btn" id="sync-use-cloud" type="button">클라우드 자료 사용</button><button class="btn" id="sync-use-local" type="button">이 PC 자료로 저장</button></div></div>`;
    document.querySelector('main .wrap').prepend(panel);
    $('sync-now').disabled = true;
    if (!config.url || !config.publishableKey) { say('관리자가 Supabase 프로젝트를 연결하면 사용할 수 있습니다. 현재는 이 PC에서만 작업합니다.'); return; }
    try {
      const url = new URL(config.url);
      if (url.protocol !== 'https:' || !(/^sb_publishable_/.test(config.publishableKey) || /^eyJ/.test(config.publishableKey))) throw new Error('Invalid public configuration');
      if (/^eyJ/.test(config.publishableKey)) {
        const claims = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.role !== 'anon') throw new Error('Use an anon or publishable key');
      }
      const lib = await sdk();
      client = lib.createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      $('sync-now').onclick = () => store?.poll();
      $('sync-use-cloud').onclick = async () => { if (window.confirm('이 PC 화면을 클라우드 자료로 교체할까요?')) await store.resolve('cloud'); };
      $('sync-use-local').onclick = async () => { if (window.confirm('현재 이 PC 자료로 클라우드를 교체할까요? 다른 PC에도 반영됩니다.')) await store.resolve('local'); };
      $('sync-local-copy').onclick = () => backup(store?.current(), '이-PC-동기화백업');
      $('sync-cloud-copy').onclick = () => backup(store?.conflict?.payload, '클라우드-동기화백업');
      await attach();
      window.addEventListener('online', () => store?.poll());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') store?.poll(); });
    } catch { say('동기화 초기화 실패. 공개 프로젝트 URL·키와 인터넷 연결을 확인하세요.'); }
  }
  window.CloudSync = {
    register(value) { adapter = value; },
    changed() {
      if (applying || !connected) return;
      try { store.change(current()); clearTimeout(timer); timer = setTimeout(() => store.flush(), 1000); } catch (e) { say(e.message); }
    },
    async addScan(scan) {
      if (!connected) return false;
      const value = store.current();
      if (!value.files.some(f => f.id === scan.id)) value.files.push({ id: scan.id, name: scan.name, sheets: [{ name: '비가동일보', type: 'form', aoa: scan.aoa }] });
      store.change(value); await store.flush(); return true;
    }
  };
  init();
})();
