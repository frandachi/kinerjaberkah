(function () {
  const API = '/kinerjaberkah/api';
  const state = { id: '', image: '' };

  function css() {
    if (document.getElementById('kb-captcha-style')) return;
    const s = document.createElement('style');
    s.id = 'kb-captcha-style';
    s.textContent = `
      .kb-captcha-hide{display:none !important}
      .kb-captcha-box{margin-top:4px}
      .kb-captcha-label{color:#475569;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
      .kb-captcha-row{display:flex;gap:8px;align-items:center}
      .kb-captcha-img{height:40px;width:auto;flex:1 1 auto;max-width:220px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;object-fit:contain}
      .kb-captcha-refresh{border:1px solid #e2e8f0;background:#fff;border-radius:10px;width:40px;height:40px;flex:0 0 40px;cursor:pointer;color:#334155;font-size:16px;line-height:1}
      .kb-captcha-refresh:hover{background:#f8fafc}
      .kb-login-row{display:flex !important;gap:8px;align-items:center;width:100%}
      .kb-captcha-input{flex:1 1 0;min-width:0;height:40px;box-sizing:border-box;margin:0;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:14px;letter-spacing:.18em;text-transform:uppercase}
      .kb-captcha-input:focus{outline:none;border-color:#2563eb;background:#fff}
      .kb-login-row button[type=submit]{flex:1 1 0;width:auto !important}
    `;
    document.head.appendChild(s);
  }

  async function loadCaptcha() {
    const res = await window.__kbNativeFetch(`${API}/auth/captcha`, { method: 'GET' });
    const data = await res.json();
    state.id = data.id;
    state.image = data.image;
    const img = document.getElementById('kb-captcha-img');
    const input = document.getElementById('kb-captcha-input');
    if (img) img.src = data.image;
    if (input) input.value = '';
  }

  function currentAnswer() {
    const input = document.getElementById('kb-captcha-input');
    return input ? String(input.value || '').trim() : '';
  }

  function findMathWrap(input) {
    let el = input;
    for (let i = 0; i < 6 && el; i += 1) {
      const text = el.textContent || '';
      if (text.includes('+') && (text.includes('Keamanan') || text.includes('='))) {
        return el;
      }
      el = el.parentElement;
    }
    return input.parentElement;
  }

  function solveMathCaptcha() {
    const input = document.getElementById('captcha');
    if (!input) return null;
    const wrap = findMathWrap(input);
    const text = (wrap && wrap.textContent) || '';
    const match = text.match(/(\d+)\s*\+\s*(\d+)/);
    if (!match) return wrap;
    const sum = String(Number(match[1]) + Number(match[2]));
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(input, sum);
    else input.value = sum;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return wrap;
  }

  function placeInputBesideSubmit() {
    const input = document.getElementById('kb-captcha-input');
    const form = originalForm();
    const submit = form && form.querySelector('button[type="submit"]');
    if (!input || !submit) return;
    const footer = submit.parentElement;
    if (!footer) return;
    footer.classList.add('kb-login-row');
    if (input.nextElementSibling === submit) return;
    footer.insertBefore(input, submit);
  }

  function originalForm() {
    const original = document.getElementById('captcha');
    return original ? original.closest('form') : document.querySelector('#root form');
  }

  function mountWidget() {
    css();
    const original = document.getElementById('captcha');
    if (!original) return;
    const wrap = solveMathCaptcha();
    if (wrap) wrap.classList.add('kb-captcha-hide');

    if (!document.getElementById('kb-captcha-box')) {
      const box = document.createElement('div');
      box.id = 'kb-captcha-box';
      box.className = 'kb-captcha-box';
      box.innerHTML = `
        <div class="kb-captcha-label">Keamanan</div>
        <div class="kb-captcha-row">
          <img id="kb-captcha-img" class="kb-captcha-img" alt="Captcha" />
          <button type="button" class="kb-captcha-refresh" id="kb-captcha-refresh" title="Muat ulang" aria-label="Muat ulang captcha">↻</button>
        </div>
        <input id="kb-captcha-input" class="kb-captcha-input" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" />
      `;
      if (wrap && wrap.parentElement) wrap.parentElement.insertBefore(box, wrap.nextSibling);
      else original.parentElement.appendChild(box);

      document.getElementById('kb-captcha-refresh').addEventListener('click', (e) => {
        e.preventDefault();
        loadCaptcha();
      });
      loadCaptcha();
    }

    placeInputBesideSubmit();
  }

  const nativeFetch = window.fetch.bind(window);
  window.__kbNativeFetch = window.__kbNativeFetch || nativeFetch;

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    const isLogin = method === 'POST' && /\/api\/auth\/login\/?$/.test(url);

    if (isLogin) {
      solveMathCaptcha();
      const nextInit = { ...(init || {}) };
      let body = {};
      try { body = JSON.parse(nextInit.body || '{}'); } catch (e) { body = {}; }
      body.captchaId = state.id;
      body.captcha = currentAnswer();
      nextInit.body = JSON.stringify(body);
      const res = await nativeFetch(input, nextInit);
      loadCaptcha();
      return res;
    }

    return nativeFetch(input, init);
  };

  const observer = new MutationObserver(() => {
    if (document.getElementById('captcha')) mountWidget();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountWidget);
  } else {
    mountWidget();
  }
})();
