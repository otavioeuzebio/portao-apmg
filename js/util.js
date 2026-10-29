/* Utilidades gerais: DOM, datas, arquivos, avisos, folha de tela cheia, modal e som. */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hojeISO = () => isoOf(new Date());
const fmtD = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const fmtH = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtDT = (ts) => { const d = new Date(ts); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + fmtH(ts); };
const fmtDur = (ms) => { const m = Math.round(ms / 60000); if (m < 60) return m + ' min'; const h = Math.floor(m / 60); return h + ' h' + (m % 60 ? ' ' + pad(m % 60) : ''); };
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normDoc = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** Início do dia (ms) de uma data ISO no fuso do aparelho. */
const diaMs = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
/** "HH:MM" → minutos. */
const horaMin = (h) => { const m = String(h || '').match(/(\d{1,2})\D?(\d{2})?/); return m ? (+m[1]) * 60 + (+(m[2] || 0)) : null; };

let toastT;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }

const LIBS = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
};
const _ls = {};
function loadScript(u) {
  return _ls[u] || (_ls[u] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = u; s.onload = res;
    s.onerror = () => { delete _ls[u]; s.remove(); rej(new Error('Sem internet para carregar este recurso. Conecte-se e tente de novo.')); };
    document.head.appendChild(s);
  }));
}

const fileToDataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
/** Reduz a imagem (lado maior = max px) e devolve JPEG em data URL. */
async function resizeImg(src, max = 360, q = 0.78) {
  try {
    const im = await loadImg(src); const s = Math.min(1, max / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
  } catch (e) { return null; }
}
function download(name, content, type) {
  const b = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function csvCell(s) { s = String(s ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
/** Datas de planilha/texto → ISO (aceita 10/12/2027, 2027-12-10 e número de série do Excel). */
function parseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + pad(m[2]) + '-' + pad(m[1]); }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  if (/^\d{5}$/.test(s)) { const d = new Date(Math.round((+s - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  return '';
}
/** "14h", "14:30", "14h às 17h" → {ini, fim} em "HH:MM". */
function parseHorario(s) {
  const hs = [...String(s || '').matchAll(/(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)/g)].map((m) => pad(+m[1]) + ':' + pad(+(m[2] || 0)));
  return { ini: hs[0] || '', fim: hs[1] || '' };
}
const fmtHora = (s) => { const m = horaMin(s); return m == null ? '' : pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };

/* ---------- folha (tela cheia) ---------- */
let sheetOnClose = null;
function openSheet(title, html, onClose) {
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html;
  $('#sheet').hidden = false; $('#sheet').scrollTop = 0; document.body.style.overflow = 'hidden';
  if (onClose) sheetOnClose = onClose;
}
function closeSheet() {
  $('#sheet').hidden = true; document.body.style.overflow = '';
  const f = sheetOnClose; sheetOnClose = null; if (f) f();
}

/* ---------- modal de confirmação (o navegador do app não mostra confirm/prompt) ---------- */
function ask({ title, msg = '', ok = 'Confirmar', danger = false, input = null }) {
  return new Promise((res) => {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${msg ? `<p>${msg}</p>` : ''}
      ${input ? `<input id="askIn" type="${input.type || 'text'}" inputmode="${input.mode || 'text'}" placeholder="${esc(input.ph || '')}" autocomplete="off">` : ''}
      <div class="btnrow"><button class="btn ghost" id="askNo" type="button">Cancelar</button><button class="btn ${danger ? 'bad' : 'primary'}" id="askOk" type="button">${esc(ok)}</button></div></div>`;
    m.hidden = false; const inp = $('#askIn'); if (inp) setTimeout(() => inp.focus(), 50);
    const done = (v) => { m.hidden = true; m.innerHTML = ''; res(v); };
    $('#askNo').onclick = () => done(null);
    $('#askOk').onclick = () => done(input ? inp.value : true);
    if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') done(inp.value); };
  });
}

/* ---------- som e vibração ---------- */
let actx;
function alertFx(kind, comSom = true) {
  if (comSom && kind !== 'disc') {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = kind === 'bad' ? [[880, .18], [0, .08], [880, .18], [0, .08], [880, .35]]
        : kind === 'warn' ? [[660, .14], [0, .06], [520, .22]] : [[1046, .1], [0, .03], [1318, .12]];
      let t = actx.currentTime;
      for (const [f, d] of seq) {
        if (f) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.value = .07; o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d); }
        t += d;
      }
    } catch (e) { /* sem áudio */ }
  }
  try {
    const pat = { bad: [300, 100, 300, 100, 600], warn: [150, 80, 150], disc: [700, 250, 700, 250, 700], ok: 60 }[kind] || 60;
    if (comSom || kind === 'disc') navigator.vibrate && navigator.vibrate(pat);
  } catch (e) { /* sem vibração */ }
}

/* ---------- placa desenhada e avatar ---------- */
const plateHTML = (p, cls = '') => `<div class="plate ${cls}"><div class="plate-band">BRASIL</div><div class="plate-num">${esc(p)}</div></div>`;
function avatar(v) {
  if (v && v.foto) return v.foto;
  const ini = (v && v.nome || '?').replace(/^exemplo\s*[—-]\s*/i, '').replace(/^(cad|sd|cb|sgt|ten|cap|maj|cel|st|asp)\.?\s+/i, '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125"><rect width="100" height="125" fill="#2a3d52"/><circle cx="50" cy="48" r="22" fill="#3a5068"/><path d="M14 125c4-26 18-38 36-38s32 12 36 38z" fill="#3a5068"/><text x="50" y="56" font-family="Arial" font-weight="700" font-size="20" fill="#c9d6e2" text-anchor="middle">${esc(ini)}</text></svg>`);
}
