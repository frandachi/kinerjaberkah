(function () {
  const API = '/kinerjaberkah/api';

  function css() {
    if (document.getElementById('kb-mfa-style')) return;
    const s = document.createElement('style');
    s.id = 'kb-mfa-style';
    s.textContent = `
      .kb-mfa-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif}
      .kb-mfa-card{width:100%;max-width:420px;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);overflow:hidden}
      .kb-mfa-head{padding:20px 24px 8px}
      .kb-mfa-head h2{margin:0;font-size:18px;font-weight:700;color:#0f172a}
      .kb-mfa-head p{margin:6px 0 0;font-size:13px;color:#64748b;line-height:1.5}
      .kb-mfa-body{padding:12px 24px 24px}
      .kb-mfa-input{width:100%;box-sizing:border-box;letter-spacing:.4em;text-align:center;font-size:22px;font-weight:700;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
      .kb-mfa-input:focus{outline:none;border-color:#2563eb;background:#fff}
      .kb-mfa-err{color:#dc2626;font-size:12px;min-height:18px;margin:8px 0}
      .kb-mfa-btn{width:100%;border:0;border-radius:10px;padding:11px 16px;font-weight:600;cursor:pointer;font-size:14px}
      .kb-mfa-btn.primary{background:#2563eb;color:#fff}
      .kb-mfa-btn.primary:disabled{opacity:.6;cursor:not-allowed}
      .kb-mfa-btn.ghost{background:transparent;color:#64748b;margin-top:8px}
      .kb-mfa-secret{font-family:ui-monospace,Consolas,monospace;background:#f1f5f9;padding:10px 12px;border-radius:8px;font-size:13px;word-break:break-all;margin:8px 0 12px}
      .kb-mfa-qr{display:block;margin:4px auto 12px;width:180px;height:180px;border:1px solid #e2e8f0;border-radius:12px;padding:8px;background:#fff;box-sizing:border-box}
      .kb-mfa-actions{display:flex;gap:8px;margin-top:8px}
    `;
    document.head.appendChild(s);
  }

  function overlay(html) {
    css();
    closeOverlay();
    const el = document.createElement('div');
    el.className = 'kb-mfa-overlay';
    el.id = 'kb-mfa-overlay';
    el.innerHTML = `<div class="kb-mfa-card">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }

  function closeOverlay() {
    const el = document.getElementById('kb-mfa-overlay');
    if (el) el.remove();
  }

  function askOtp(message) {
    return new Promise((resolve, reject) => {
      overlay(`
        <div class="kb-mfa-head">
          <h2>Verifikasi MFA</h2>
          <p>${message || 'Masukkan kode 6 digit dari Google Authenticator / Authy.'}</p>
        </div>
        <div class="kb-mfa-body">
          <input class="kb-mfa-input" id="kb-mfa-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" />
          <div class="kb-mfa-err" id="kb-mfa-err"></div>
          <button class="kb-mfa-btn primary" id="kb-mfa-ok">Verifikasi</button>
          <button class="kb-mfa-btn ghost" id="kb-mfa-cancel" type="button">Batal</button>
        </div>
      `);
      const input = document.getElementById('kb-mfa-code');
      const err = document.getElementById('kb-mfa-err');
      const done = (value) => {
        closeOverlay();
        resolve(value);
      };
      const fail = (reason) => {
        closeOverlay();
        reject(reason);
      };
      document.getElementById('kb-mfa-ok').onclick = () => {
        const v = (input.value || '').replace(/\D/g, '');
        if (v.length !== 6) {
          err.textContent = 'Kode harus 6 digit';
          return;
        }
        done(v);
      };
      document.getElementById('kb-mfa-cancel').onclick = () => fail(new Error('MFA dibatalkan'));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('kb-mfa-ok').click();
      });
      input.focus();
    });
  }

  async function jsonFetch(url, options) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers) };
    if (token && !(options && options.skipAuth)) headers.Authorization = `Bearer ${token}`;
    const res = await window.__kbNativeFetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'Permintaan gagal');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function openSetup() {
    const started = await jsonFetch(`${API}/2fa/setup`, { method: 'POST', body: '{}' });
    overlay(`
      <div class="kb-mfa-head">
        <h2>Aktifkan MFA</h2>
        <p>Tambahkan akun di Google Authenticator / Authy, lalu masukkan kode 6 digit.</p>
      </div>
      <div class="kb-mfa-body">
        ${started.qr ? `<img class="kb-mfa-qr" src="${started.qr}" alt="QR MFA" />` : ''}
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Secret</div>
        <div class="kb-mfa-secret" id="kb-mfa-secret">${started.secret}</div>
        <button class="kb-mfa-btn ghost" type="button" id="kb-mfa-copy">Salin secret</button>
        <input class="kb-mfa-input" id="kb-mfa-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" />
        <div class="kb-mfa-err" id="kb-mfa-err"></div>
        <div class="kb-mfa-actions">
          <button class="kb-mfa-btn primary" id="kb-mfa-ok">Aktifkan</button>
          <button class="kb-mfa-btn ghost" id="kb-mfa-cancel" type="button">Nanti</button>
        </div>
      </div>
    `);
    document.getElementById('kb-mfa-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(started.secret); } catch (e) {}
    };
    document.getElementById('kb-mfa-cancel').onclick = closeOverlay;
    document.getElementById('kb-mfa-ok').onclick = async () => {
      const err = document.getElementById('kb-mfa-err');
      const code = (document.getElementById('kb-mfa-code').value || '').replace(/\D/g, '');
      if (code.length !== 6) {
        err.textContent = 'Kode harus 6 digit';
        return;
      }
      try {
        await jsonFetch(`${API}/2fa/verify`, { method: 'POST', body: JSON.stringify({ token: code }) });
        closeOverlay();
        sessionStorage.setItem('kb_mfa_prompt', 'done');
        overlay(`
          <div class="kb-mfa-head"><h2>MFA aktif</h2><p>Login berikutnya akan meminta kode authenticator.</p></div>
          <div class="kb-mfa-body"><button class="kb-mfa-btn primary" id="kb-mfa-ok">Tutup</button></div>
        `);
        document.getElementById('kb-mfa-ok').onclick = closeOverlay;
      } catch (e) {
        err.textContent = e.message || 'Kode tidak valid';
      }
    };
    document.getElementById('kb-mfa-code').focus();
  }

  function askEnroll(setup, message) {
    const secret = setup.secret || '';
    const qr = setup.qr
      ? `<img class="kb-mfa-qr" src="${setup.qr}" alt="QR MFA" />`
      : '';
    return new Promise((resolve, reject) => {
      overlay(`
        <div class="kb-mfa-head">
          <h2>Aktifkan MFA</h2>
          <p>${message || 'MFA wajib untuk semua akun. Scan QR di Google Authenticator / Authy, atau ketik secret manual, lalu masukkan kode 6 digit.'}</p>
        </div>
        <div class="kb-mfa-body">
          ${qr}
          <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Secret</div>
          <div class="kb-mfa-secret">${secret}</div>
          <button class="kb-mfa-btn ghost" type="button" id="kb-mfa-copy">Salin secret</button>
          <input class="kb-mfa-input" id="kb-mfa-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000" />
          <div class="kb-mfa-err" id="kb-mfa-err"></div>
          <button class="kb-mfa-btn primary" id="kb-mfa-ok">Aktifkan</button>
          <button class="kb-mfa-btn ghost" id="kb-mfa-cancel" type="button">Batal</button>
        </div>
      `);
      document.getElementById('kb-mfa-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(secret); } catch (e) {}
      };
      const input = document.getElementById('kb-mfa-code');
      const err = document.getElementById('kb-mfa-err');
      document.getElementById('kb-mfa-ok').onclick = () => {
        const v = (input.value || '').replace(/\D/g, '');
        if (v.length !== 6) {
          err.textContent = 'Kode harus 6 digit';
          return;
        }
        closeOverlay();
        resolve(v);
      };
      document.getElementById('kb-mfa-cancel').onclick = () => {
        closeOverlay();
        reject(new Error('Aktivasi MFA dibatalkan'));
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('kb-mfa-ok').click();
      });
      input.focus();
    });
  }

  async function enrollThenLogin(mfaToken) {
    const setupRes = await window.__kbNativeFetch(`${API}/auth/login/mfa-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken }),
    });
    const setup = await setupRes.json().catch(() => ({}));
    if (!setupRes.ok || !setup.secret) {
      throw new Error(setup.message || 'Gagal menyiapkan MFA');
    }

    let lastError = '';
    while (true) {
      const code = await askEnroll(setup, lastError);
      const activateRes = await window.__kbNativeFetch(`${API}/auth/login/mfa-activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, token: code }),
      });
      const activated = await activateRes.clone().json().catch(() => null);
      if (activateRes.ok && activated && activated.user && activated.token) {
        return activateRes;
      }
      if (activateRes.status !== 401 || (activated && /sesi mfa berakhir|token mfa tidak valid/i.test(activated.message || ''))) {
        throw new Error((activated && activated.message) || 'Aktivasi MFA gagal');
      }
      lastError = (activated && activated.message) || 'Kode MFA tidak valid. Coba lagi.';
    }
  }

  const nativeFetch = window.fetch.bind(window);
  if (!window.__kbNativeFetch) window.__kbNativeFetch = nativeFetch;

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const isLogin = method === 'POST' && /\/api\/auth\/login\/?$/.test(url);

    const res = await nativeFetch(input, init);
    if (!isLogin) return res;

    const data = await res.clone().json().catch(() => null);
    if (!data) return res;

    try {
      if (data.requiresMFASetup && data.mfaToken) {
        return await enrollThenLogin(data.mfaToken);
      }

      if (data.requires2FA && data.mfaToken) {
        let lastError = data.message;
        while (true) {
          const code = await askOtp(lastError);
          const verifyRes = await nativeFetch(`${API}/auth/login/2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: data.mfaToken, token: code }),
          });
          const verified = await verifyRes.clone().json().catch(() => null);
          if (verifyRes.ok && verified && verified.user) {
            return verifyRes;
          }
          if (verifyRes.status !== 401 || (verified && /sesi mfa berakhir|token mfa tidak valid/i.test(verified.message || ''))) {
            return verifyRes;
          }
          lastError = (verified && verified.message) || 'Kode MFA tidak valid';
        }
      }
    } catch (e) {
      return new Response(JSON.stringify({ message: e.message || 'MFA dibatalkan' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return res;
  };

  window.KinerjaBerkahMFA = { openSetup, closeOverlay };
})();
