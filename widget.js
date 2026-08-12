(function () {
  if (window.__zngWidget) return;
  window.__zngWidget = true;

  const API = 'https://zangoulehmusicschool.com/api/chat';
  const STORAGE_KEY = 'zng_widget_history';
  const PRIMARY = '#822331';
  const ACCENT = '#f0d060';

  /* ── Inject styles ── */
  const style = document.createElement('style');
  style.textContent = `
    #zng-bubble{position:fixed;bottom:20px;left:20px;width:52px;height:52px;border-radius:50%;background:${PRIMARY};border:none;cursor:pointer;box-shadow:0 4px 16px rgba(130,35,49,0.4);display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform 0.2s}
    #zng-bubble:hover{transform:scale(1.08)}
    #zng-bubble svg{width:26px;height:26px;fill:${ACCENT}}
    #zng-panel{position:fixed;bottom:82px;left:20px;width:340px;height:480px;background:#fdf8ec;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:'Noto Sans Arabic',Tahoma,sans-serif;direction:rtl}
    #zng-panel.open{display:flex}
    .zng-head{background:${PRIMARY};padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}
    .zng-head-info h4{color:${ACCENT};font-size:0.88rem;margin:0;font-weight:600}
    .zng-head-info p{color:rgba(240,208,96,0.75);font-size:0.68rem;margin:0}
    .zng-head-logo{width:36px;height:36px;border-radius:50%;background:${ACCENT};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
    .zng-close{margin-right:auto;background:none;border:none;color:rgba(240,208,96,0.7);cursor:pointer;font-size:1.2rem;line-height:1;padding:2px 6px}
    .zng-close:hover{color:${ACCENT}}
    .zng-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;scroll-behavior:smooth}
    .zng-msg{max-width:82%;padding:8px 11px;border-radius:10px;font-size:0.82rem;line-height:1.55;animation:zngFade 0.18s ease}
    .zng-msg.bot{background:#fff;border:1.5px solid rgba(130,35,49,0.15);align-self:flex-end;border-bottom-right-radius:3px}
    .zng-msg.user{background:${PRIMARY};color:${ACCENT};align-self:flex-start;border-bottom-left-radius:3px}
    .zng-typing{display:none;align-self:flex-end;background:#fff;border:1.5px solid rgba(130,35,49,0.15);padding:8px 12px;border-radius:10px;border-bottom-right-radius:3px;gap:4px;align-items:center}
    .zng-typing.show{display:flex}
    .zng-dot{width:6px;height:6px;border-radius:50%;background:${PRIMARY};opacity:0.35;animation:zngPulse 1.2s infinite}
    .zng-dot:nth-child(2){animation-delay:.2s}.zng-dot:nth-child(3){animation-delay:.4s}
    .zng-bar{padding:8px 10px;background:#fff;border-top:1.5px solid rgba(130,35,49,0.12);display:flex;gap:6px;align-items:flex-end;flex-shrink:0}
    #zng-input{flex:1;border:1.5px solid rgba(130,35,49,0.22);border-radius:16px;padding:7px 11px;font-family:inherit;font-size:0.82rem;resize:none;outline:none;background:#fdf8ec;max-height:80px;overflow-y:auto;line-height:1.45}
    #zng-input:focus{border-color:${PRIMARY}}
    #zng-send{background:${PRIMARY};border:none;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:opacity .15s}
    #zng-send:hover{opacity:.85}#zng-send:disabled{opacity:.4;cursor:not-allowed}
    #zng-send svg{width:15px;height:15px;fill:${ACCENT}}
    .zng-welcome{background:#fff;border:1.5px solid rgba(130,35,49,0.18);border-radius:10px;padding:12px;text-align:center;align-self:center;font-size:0.78rem;color:#555;line-height:1.6;max-width:240px;margin:auto 0}
    .zng-welcome b{color:${PRIMARY};display:block;margin-bottom:4px;font-size:0.85rem}
    @keyframes zngFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
    @keyframes zngPulse{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
  `;
  document.head.appendChild(style);

  /* ── HTML ── */
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="zng-bubble" aria-label="چت با زنگوله">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
    <div id="zng-panel" role="dialog" aria-label="چت با آموزشگاه زنگوله">
      <div class="zng-head">
        <div class="zng-head-logo">🎵</div>
        <div class="zng-head-info"><h4>آموزشگاه زنگوله</h4><p>معمولاً در چند دقیقه پاسخ می‌دهیم</p></div>
        <button class="zng-close" id="zng-close" aria-label="بستن">✕</button>
      </div>
      <div class="zng-msgs" id="zng-msgs">
        <div class="zng-welcome" id="zng-welcome"><b>سلام! 👋</b>چطور می‌تونم کمکتون کنم؟ درباره کلاس‌ها، اساتید، یا ثبت‌نام بپرسید.</div>
        <div class="zng-typing" id="zng-typing"><div class="zng-dot"></div><div class="zng-dot"></div><div class="zng-dot"></div></div>
      </div>
      <div class="zng-bar">
        <textarea id="zng-input" placeholder="پیام بنویسید..." rows="1"></textarea>
        <button id="zng-send" aria-label="ارسال"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  /* ── State ── */
  let history = [];
  let sending = false;
  let open = false;

  function loadHistory() {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        history = JSON.parse(s);
        history.forEach(m => {
          if (m.role === 'user' && typeof m.content === 'string') appendMsg(m.content, 'user', false);
          if (m.role === 'assistant' && typeof m.content === 'string') appendMsg(m.content, 'bot', false);
        });
        if (history.length) document.getElementById('zng-welcome').style.display = 'none';
      }
    } catch { history = []; }
  }

  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30))); } catch {}
  }

  function appendMsg(text, who, animate) {
    const msgs = document.getElementById('zng-msgs');
    const typing = document.getElementById('zng-typing');
    const div = document.createElement('div');
    div.className = `zng-msg ${who}`;
    div.textContent = text;
    if (animate === false) div.style.animation = 'none';
    msgs.insertBefore(div, typing);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping(show) {
    const t = document.getElementById('zng-typing');
    t.classList.toggle('show', show);
    if (show) document.getElementById('zng-msgs').scrollTop = 99999;
  }

  async function send() {
    const input = document.getElementById('zng-input');
    const text = input.value.trim();
    if (!text || sending) return;

    document.getElementById('zng-welcome').style.display = 'none';
    input.value = ''; input.style.height = 'auto';
    sending = true;
    document.getElementById('zng-send').disabled = true;

    appendMsg(text, 'user');
    showTyping(true);

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, source: 'widget' })
      });
      const data = await res.json();
      showTyping(false);
      const reply = data.reply || 'متأسفم، مشکلی پیش آمد.';
      appendMsg(reply, 'bot');
      history = data.history || [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }];
      saveHistory();
    } catch {
      showTyping(false);
      appendMsg('متأسفم، خطایی رخ داد.', 'bot');
    }

    sending = false;
    document.getElementById('zng-send').disabled = false;
    input.focus();
  }

  /* ── Events ── */
  document.getElementById('zng-bubble').addEventListener('click', () => {
    open = !open;
    document.getElementById('zng-panel').classList.toggle('open', open);
    if (open) { loadHistoryOnce(); document.getElementById('zng-input').focus(); }
  });
  document.getElementById('zng-close').addEventListener('click', () => {
    open = false;
    document.getElementById('zng-panel').classList.remove('open');
  });
  document.getElementById('zng-send').addEventListener('click', send);
  document.getElementById('zng-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  document.getElementById('zng-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  let historyLoaded = false;
  function loadHistoryOnce() { if (!historyLoaded) { historyLoaded = true; loadHistory(); } }
})();
