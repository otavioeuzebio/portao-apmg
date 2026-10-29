/* Placas: normalização, correção de leitura (OCR) e votação entre quadros.
   Sem dependências — também é carregado pelos testes no Node. */
"use strict";
const PL_L2D = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
const PL_D2L = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'T', '4': 'A' };

/** Só letras e números, maiúsculas. */
function normPlate(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
/** Padrão antigo (ABC1234) ou Mercosul (ABC1D23). */
function validPlate(p) { return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p); }

/** Corrige uma janela de 7 caracteres trocando letra↔número parecidos. c = nº de trocas. */
function fixWin(w) {
  let c = 0, o = '';
  for (let i = 0; i < 7; i++) {
    let ch = w[i];
    const needL = i < 3, needD = i === 3 || i > 4;
    if (needL && /\d/.test(ch)) { if (PL_D2L[ch]) { ch = PL_D2L[ch]; c++; } else return null; }
    else if (needD && /[A-Z]/.test(ch)) { if (PL_L2D[ch]) { ch = PL_L2D[ch]; c++; } else return null; }
    o += ch;
  }
  return validPlate(o) ? { p: o, c } : null;
}

/** Todas as placas plausíveis num texto lido, das mais limpas para as mais corrigidas. */
function extractPlates(text) {
  const t = String(text || '').toUpperCase()
    .replace(/BRASIL|BRAZIL|MERCOSUL|MERCOSUR|\bBR\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '');
  const out = [], seen = new Set();
  for (let i = 0; i + 7 <= t.length; i++) {
    const r = fixWin(t.slice(i, i + 7));
    if (r && r.c <= 2 && !seen.has(r.p)) { seen.add(r.p); out.push(r); }
  }
  return out.sort((a, b) => a.c - b.c);
}

/** Mesma placa no outro padrão: ABC1234 ↔ ABC1C34. */
function altPlate(p) {
  if (!validPlate(p)) return '';
  const c = p[4];
  if (/\d/.test(c)) return p.slice(0, 4) + 'ABCDEFGHIJ'[+c] + p.slice(5);
  const i = 'ABCDEFGHIJ'.indexOf(c);
  return i >= 0 ? p.slice(0, 4) + i + p.slice(5) : '';
}

/** Letra↔número que se confundem na 5ª posição (a única que aceita os dois): I/1, O/0, B/8, S/5… */
const PL_PARECIDOS = { I: ['1'], L: ['1'], O: ['0'], Q: ['0'], D: ['0'], U: ['0'], B: ['8'], S: ['5'], Z: ['2'], G: ['6'], T: ['7'], A: ['4'],
  '1': ['I', 'L'], '0': ['O', 'Q', 'D'], '8': ['B'], '5': ['S'], '2': ['Z'], '6': ['G'], '7': ['T'], '4': ['A'] };
/** Placas que podem ser a mesma, digitadas com letra no lugar de número (ou o contrário) na 5ª posição. */
function placasParecidas(p) {
  if (!validPlate(p)) return [];
  return (PL_PARECIDOS[p[4]] || []).map((c) => p.slice(0, 4) + c + p.slice(5)).filter(validPlate);
}
/** Quantos caracteres diferem (placas de 7). */
function plateDist(a, b) {
  if (a.length !== b.length) return 99;
  let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/**
 * Votação entre quadros da câmera. Cada leitura soma pontos para a placa;
 * a placa é aceita quando passa do limite (menor para placas conhecidas).
 */
class VotacaoPlacas {
  constructor({ janelaMs = 5000, limite = 2.6, limiteConhecida = 1.5 } = {}) {
    this.janelaMs = janelaMs; this.limite = limite; this.limiteConhecida = limiteConhecida; this.l = [];
  }
  reset() { this.l = []; }
  /** cands: [{p,c}] de uma leitura; conf: 0..100 do OCR; agora: ms. */
  add(cands, conf = 70, agora = Date.now()) {
    this.l = this.l.filter((x) => agora - x.t <= this.janelaMs);
    const peso = Math.max(0.35, Math.min(1, conf / 85));
    cands.slice(0, 2).forEach((c, i) => {
      this.l.push({ p: c.p, t: agora, w: peso * (c.c === 0 ? 1 : c.c === 1 ? 0.7 : 0.45) * (i === 0 ? 1 : 0.5) });
    });
  }
  placar() {
    const m = new Map();
    for (const x of this.l) m.set(x.p, (m.get(x.p) || 0) + x.w);
    return [...m].map(([p, s]) => ({ p, s })).sort((a, b) => b.s - a.s);
  }
  /** Devolve {p, s, ok} da melhor placa; ok = aceita. conhecida(p) → true para cadastradas/alerta/agendadas. */
  melhor(conhecida = () => false) {
    const pl = this.placar();
    if (!pl.length) return null;
    const known = pl.find((x) => conhecida(x.p) && x.s >= this.limiteConhecida);
    if (known) return { ...known, ok: true };
    const b = pl[0];
    return { ...b, ok: b.s >= this.limite };
  }
}

if (typeof module !== 'undefined') module.exports = { normPlate, validPlate, fixWin, extractPlates, altPlate, plateDist, placasParecidas, VotacaoPlacas };
