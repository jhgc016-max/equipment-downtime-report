/* Separate Supabase identity; ChatGPT credentials never enter this module. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.DowntimeSyncConfig || {};
  let client, store, user, adapter, applying = false, connected = false, timer, polling, epoch = 0;
  function say(text) { $('sync-status').textContent = text; }
  function state(s) {
    say(s.message); $('sync-conflict').hidden = !s.conflict;
    $('sync-user').textContent = user?.email || '';
    $('sync-out').disabled = !user; $('sync-now').disabled = !user;
  }
  function settings() { try { return JSON.parse(localStorage.getItem('build-2611-11.settings') || '{}'); } catch { return {}; } }
  function current() { return adapter ? adapter.get() : store?.current() || { version: 1, files: [], settings: settings() }; }
  function apply(value) {
    applying = true;
    try { localStorage.setItem('build-2611-11.settings', JSON.stringify(value.settings)); if (adapter) adapter.apply(value); }
    finally { applying = false; }
  }
  async function attach(session) {
    const ticket = ++epoch; connected = false;
    store?.disconnect(); clearInterval(polling);
    user = session?.user || null;
    if (!user) return state({ message: '동기화 로그인이 필요합니다. ChatGPT 로그인과 별개입니다.', conflict: false });
    const local = adapter ? adapter.get() : { version: 1, files: [], settings: settings() };
    const uid = user.id;
    store = new window.DowntimeSync.Store({
      storage: localStorage, apply, status: state,
      remote: {
        async read(_user, knownRevision) {
          if (Number.isInteger(knownRevision)) {
            const meta = await client.from('downtime_workspaces').select('revision').eq('user_id', uid).maybeSingle();
            if (meta.error) throw meta.error;
            if (!meta.data || meta.data.revision === knownRevision) return null;
          }
          const { data, error } = await client.from('downtime_workspaces').select('revision,payload,updated_at').eq('user_id', uid).maybeSingle();
          if (error) throw error; return data;
        },
        async write(revision, payload) {
          const { data, error } = await client.rpc('save_downtime_workspace', { expected_revision: revision, workspace: payload });
          if (error) throw error; return data;
        }
      }
    });
    await store.connect(uid, local); if (ticket !== epoch) return;
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
    panel.innerHTML = `<h2 style="margin-top:0">내 데이터 자동 동기화</h2>
      <p class="sub">확인 후 집계로 보낸 작업일보·엑셀 자료와 기준 설정을 같은 계정의 다른 PC·공개 사이트에 동기화합니다. 원본 PDF·사진은 업로드하지 않습니다. ChatGPT 로그인과 별도의 이메일 인증입니다.</p>
      <div id="sync-auth" class="ctrl"><label>이메일<input id="sync-email" type="email" autocomplete="email"></label><button class="btn" type="button" id="sync-otp">인증번호 받기</button><label>이메일 인증번호<input id="sync-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label><button class="btn" type="button" id="sync-in">동기화 로그인</button></div>
      <p><b id="sync-user"></b> <span id="sync-status" role="status">동기화 설정 확인 중…</span></p>
      <div class="btnrow"><button class="btn" id="sync-now" type="button" disabled>지금 동기화</button><button class="btn" id="sync-out" type="button" disabled>동기화 로그아웃</button></div>
      <div class="warn" id="sync-conflict" hidden><b>어느 자료를 사용할까요?</b><p>자동으로 덮어쓰지 않았습니다. 교체 전 이 PC 자료와 클라우드 자료를 내려받아 비교할 수 있습니다.</p><div class="btnrow"><button class="btn" id="sync-local-copy" type="button">이 PC 백업(JSON)</button><button class="btn" id="sync-cloud-copy" type="button">클라우드 백업(JSON)</button><button class="btn" id="sync-use-cloud" type="button">클라우드 자료 사용</button><button class="btn" id="sync-use-local" type="button">이 PC 자료로 저장</button></div></div>`;
    document.querySelector('main .wrap').prepend(panel);
    if (!config.url || !config.publishableKey) { say('관리자가 Supabase 프로젝트를 연결하면 사용할 수 있습니다. 현재는 이 PC에서만 작업합니다.'); $('sync-auth').hidden = true; return; }
    try {
      const url = new URL(config.url);
      if (url.protocol !== 'https:' || !(/^sb_publishable_/.test(config.publishableKey) || /^eyJ/.test(config.publishableKey))) throw new Error('Invalid public configuration');
      if (/^eyJ/.test(config.publishableKey)) {
        const claims = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.role !== 'anon') throw new Error('Use an anon or publishable key');
      }
      const lib = await sdk();
      client = lib.createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user.id === user?.id) return;
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => { if(event==='SIGNED_IN'&&user?.id===session?.user.id)return; attach(session).catch(() => say('동기화 연결 실패. 프로젝트 설정과 SQL 설치를 확인하세요.')); }, 0);
      });
      $('sync-otp').onclick = async () => {
        const email = $('sync-email').value.trim(); if (!email || !$('sync-email').checkValidity()) return say('이메일을 확인하세요.');
        $('sync-otp').disabled = true;
        try { const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw error; say('이메일 인증번호를 입력하세요. 링크만 온다면 메일 템플릿을 OTP 방식으로 바꿔야 합니다.'); }
        catch { say('인증번호 발송 실패. 이메일·메일 설정과 발송 한도를 확인하세요.'); }
        finally { $('sync-otp').disabled = false; }
      };
      $('sync-in').onclick = async () => {
        try { const { data, error } = await client.auth.verifyOtp({ email: $('sync-email').value.trim(), token: $('sync-code').value.trim(), type: 'email' }); if (error) throw error; $('sync-code').value = ''; if (data.session && user?.id !== data.session.user.id) await attach(data.session); }
        catch { say('인증번호가 올바르지 않거나 만료되었습니다. 다시 받아 주세요.'); }
      };
      $('sync-out').onclick = async () => { if (!window.confirm('동기화에서 로그아웃할까요? 현재 화면과 미저장 자료는 이 PC에 남습니다.')) return; try { const {error}=await client.auth.signOut(); if(error)throw error; } catch { say('로그아웃에 실패했습니다. 연결을 확인하세요.'); } };
      $('sync-now').onclick = () => store?.poll();
      $('sync-use-cloud').onclick = async () => { if (window.confirm('이 PC 화면을 클라우드 자료로 교체할까요?')) await store.resolve('cloud'); };
      $('sync-use-local').onclick = async () => { if (window.confirm('현재 이 PC 자료로 클라우드를 교체할까요? 다른 PC에도 반영됩니다.')) await store.resolve('local'); };
      $('sync-local-copy').onclick = () => backup(store?.current(), '이-PC-동기화백업');
      $('sync-cloud-copy').onclick = () => backup(store?.conflict?.payload, '클라우드-동기화백업');
      const { data } = await client.auth.getSession(); if (data.session && !user) await attach(data.session); else if (!user) state({ message: '이메일 인증으로 동기화에 로그인하세요.', conflict: false });
      window.addEventListener('online', () => store?.poll());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') store?.poll(); });
    } catch { say('동기화 초기화 실패. 공개 프로젝트 URL·키와 인터넷 연결을 확인하세요.'); }
  }
  window.CloudSync = {
    register(value) { adapter = value; },
    changed() {
      if (applying || !connected || !user) return;
      try { store.change(current()); clearTimeout(timer); timer = setTimeout(() => store.flush(), 1000); } catch (e) { say(e.message); }
    },
    async addScan(scan) {
      if (!connected || !user) return false;
      const value = store.current();
      if (!value.files.some(f => f.id === scan.id)) value.files.push({ id: scan.id, name: scan.name, sheets: [{ name: '비가동일보', type: 'form', aoa: scan.aoa }] });
      store.change(value); await store.flush(); return true;
    }
  };
  init();
})();
