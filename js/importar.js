/* Importação de cadastros por arquivo: Excel/CSV/ODS, Word (.docx) e PDF com tabela.
   Destinos: veículos, lista de alerta e agendados. O usuário confere as colunas antes de gravar. */
"use strict";
const VINC = ['Cadete', 'Oficial', 'Praça', 'Servidor civil', 'Prestador de serviço', 'Visitante', 'Outro'];

const IMP_ALVOS = {
  veiculos: {
    nome: 'Veículos autorizados',
    campos: [
      ['placa', 'Placa', ['placa', 'placas', 'placa do veiculo', 'placa veiculo']],
      ['nome', 'Nome / proprietário', ['nome', 'proprietario', 'responsavel', 'condutor', 'militar', 'nome completo', 'nome de guerra', 'titular', 'servidor', 'aluno', 'cadete']],
      ['postoGrad', 'Posto / grad.', ['posto', 'graduacao', 'posto/grad', 'posto/graduacao', 'p/g', 'pg', 'post/grad']],
      ['vinculo', 'Vínculo', ['vinculo', 'categoria', 'situacao funcional', 'tipo de vinculo']],
      ['marcaModelo', 'Marca + modelo', ['marca/modelo', 'marca e modelo', 'marca modelo']],
      ['marca', 'Marca', ['marca', 'fabricante', 'montadora']],
      ['modelo', 'Modelo', ['modelo', 'veiculo', 'carro', 'moto']],
      ['cor', 'Cor', ['cor', 'cores']],
      ['setor', 'Setor / pelotão', ['setor', 'pelotao', 'turma', 'companhia', 'cia', 'unidade', 'secao', 'lotacao', 'curso']],
      ['telefone', 'Telefone', ['telefone', 'celular', 'fone', 'contato', 'whatsapp', 'tel']],
      ['validade', 'Validade', ['validade', 'vencimento', 'valido ate', 'valida ate', 'data limite']],
      ['status', 'Situação', ['situacao', 'status', 'bloqueado']],
      ['obs', 'Observação', ['obs', 'observacao', 'observacoes', 'anotacoes']],
      ['foto', 'Foto', ['foto', 'imagem', 'fotografia', 'retrato']],
    ],
    valido: (o) => validPlate(normPlate(o.placa)),
    chave: (o) => normPlate(o.placa),
    montar(o, old) {
      const nv = { ...(old || { status: 'ativo', criadoEm: Date.now() }), placa: normPlate(o.placa), atualizadoEm: Date.now() };
      delete nv.exemplo;
      for (const k of ['nome', 'postoGrad', 'marca', 'modelo', 'cor', 'setor', 'telefone', 'obs']) if (o[k]) nv[k] = o[k];
      if (o.validade) { const d = parseDate(o.validade); if (d) nv.validade = d; }
      if (o.status) nv.status = /bloq|nao|não|proib|suspen/i.test(o.status) ? 'bloqueado' : 'ativo';
      if (o.vinculo) { const m = VINC.find((x) => norm(o.vinculo).startsWith(norm(x).slice(0, 5))); nv.vinculo = m || o.vinculo; }
      return nv;
    },
  },
  viaturas: {
    nome: 'Viaturas da APMG',
    campos: [
      ['prefixo', 'Prefixo', ['prefixo', 'vtr', 'viatura', 'prefixo vtr', 'n vtr', 'numero vtr', 'numero']],
      ['placa', 'Placa', ['placa', 'placas']],
      ['tipo', 'Tipo', ['tipo', 'especie', 'categoria']],
      ['marcaModelo', 'Marca + modelo', ['marca/modelo', 'marca e modelo', 'marca modelo']],
      ['marca', 'Marca', ['marca', 'fabricante']],
      ['modelo', 'Modelo', ['modelo', 'veiculo']],
      ['cor', 'Cor / caracterização', ['cor', 'caracterizacao']],
      ['km', 'KM atual', ['km', 'km atual', 'quilometragem', 'odometro', 'hodometro']],
      ['obs', 'Observação', ['obs', 'observacao', 'observacoes', 'situacao']],
    ],
    valido: (o) => !!(String(o.prefixo || '').trim() || validPlate(normPlate(o.placa))),
    chave: (o) => idViatura(String(o.prefixo || '').trim(), validPlate(normPlate(o.placa)) ? o.placa : ''),
    montar(o, old) {
      const placa = validPlate(normPlate(o.placa)) ? normPlate(o.placa) : '';
      const nv = { ...(old || { ativo: true, criadoEm: Date.now() }), prefixo: String(o.prefixo || '').trim().toUpperCase(), placa, atualizadoEm: Date.now() };
      nv.id = idViatura(nv.prefixo, placa); delete nv.exemplo;
      for (const k of ['marca', 'modelo', 'cor', 'obs']) if (o[k]) nv[k] = o[k];
      if (o.tipo) nv.tipo = TIPOS_VTR.find((x) => norm(o.tipo).startsWith(norm(x).slice(0, 4))) || o.tipo;
      const km = parseKm(o.km); if (!isNaN(km)) nv.kmAtual = km;
      return nv;
    },
  },
  alertas: {
    nome: 'Lista de alerta',
    campos: [
      ['placa', 'Placa', ['placa', 'placas', 'placa do veiculo']],
      ['motivo', 'Motivo', ['motivo', 'natureza', 'situacao', 'ocorrencia', 'restricao', 'alerta']],
      ['fonte', 'Origem / fonte', ['fonte', 'origem', 'solicitante', 'determinacao', 'boletim', 'bo']],
      ['marcaModelo', 'Marca + modelo', ['marca/modelo', 'marca e modelo', 'veiculo', 'modelo']],
      ['cor', 'Cor', ['cor']],
      ['validade', 'Válido até', ['validade', 'valido ate', 'vencimento']],
      ['obs', 'Observação', ['obs', 'observacao', 'observacoes']],
    ],
    valido: (o) => validPlate(normPlate(o.placa)),
    chave: (o) => normPlate(o.placa),
    montar(o, old) {
      const nv = { ...(old || { criadoEm: Date.now() }), placa: normPlate(o.placa), ativo: true, atualizadoEm: Date.now() };
      for (const k of ['motivo', 'fonte', 'cor', 'obs']) if (o[k]) nv[k] = o[k];
      if (o.marcaModelo) nv.veiculo = o.marcaModelo;
      if (o.validade) { const d = parseDate(o.validade); if (d) nv.validade = d; }
      if (!nv.motivo) nv.motivo = 'Veículo de interesse';
      return nv;
    },
  },
  agendados: {
    nome: 'Visitas e prestadores agendados',
    campos: [
      ['nome', 'Nome', ['nome', 'visitante', 'prestador', 'responsavel', 'nome completo', 'condutor']],
      ['documento', 'Documento', ['documento', 'doc', 'rg', 'cpf', 'identidade']],
      ['placa', 'Placa', ['placa', 'placas']],
      ['marcaModelo', 'Veículo', ['veiculo', 'marca/modelo', 'marca e modelo', 'modelo', 'carro']],
      ['cor', 'Cor', ['cor']],
      ['destino', 'Destino / motivo', ['destino', 'motivo', 'setor', 'secao', 'finalidade', 'local', 'empresa']],
      ['autorizadoPor', 'Autorizado por', ['autorizado por', 'autorizacao', 'autorizante', 'solicitante']],
      ['data', 'Data', ['data', 'dia', 'data inicio', 'inicio']],
      ['dataFim', 'Até a data', ['ate', 'data fim', 'termino', 'data final']],
      ['dias', 'Dias (frequente: seg a sex)', ['dias', 'dias da semana', 'frequencia', 'recorrencia', 'dias permitidos']],
      ['horario', 'Horário (ex.: 14h às 17h)', ['horario', 'hora', 'periodo', 'turno']],
      ['horaIni', 'Hora de início', ['hora inicio', 'entrada', 'hora entrada', 'das']],
      ['horaFim', 'Hora de fim', ['hora fim', 'saida', 'hora saida', 'ate as']],
      ['obs', 'Observação', ['obs', 'observacao', 'observacoes']],
    ],
    valido: (o) => !!(o.nome || validPlate(normPlate(o.placa))),
    chave: () => '',
    montar(o, old, extra) {
      const nv = { ...(old || { criadoEm: Date.now() }), atualizadoEm: Date.now() };
      for (const k of ['nome', 'documento', 'cor', 'destino', 'autorizadoPor', 'obs']) if (o[k]) nv[k] = o[k];
      if (o.placa && validPlate(normPlate(o.placa))) nv.placa = normPlate(o.placa);
      if (o.marcaModelo) nv.veiculo = o.marcaModelo;
      nv.data = parseDate(o.data) || extra.dataPadrao;
      const df = parseDate(o.dataFim); if (df && df >= nv.data) nv.dataFim = df;
      const h = parseHorario(o.horario);
      nv.horaIni = fmtHora(o.horaIni) || h.ini || ''; nv.horaFim = fmtHora(o.horaFim) || h.fim || '';
      const dias = parseDias(o.dias);
      if (dias.length) { nv.recorrente = true; nv.dias = dias; if (!nv.dataFim) { const d = new Date(diaMs(nv.data)); d.setMonth(d.getMonth() + 3); nv.dataFim = isoOf(d); } }
      return nv;
    },
  },
};

/** "seg a sex", "seg, qua, sex", "todos" → [1..5] etc. (0 = domingo). */
function parseDias(txt) {
  const t = norm(txt); if (!t) return [];
  if (/todos|diari|todo dia/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const achados = [...t.matchAll(/dom|seg|ter|qua|qui|sex|sab/g)].map((m) => nomes.indexOf(m[0]));
  if (achados.length === 2 && /\s(a|ate|-)\s/.test(t)) { const out = []; for (let d = achados[0]; ; d = (d + 1) % 7) { out.push(d); if (d === achados[1] || out.length > 7) break; } return out; }
  return [...new Set(achados)];
}
function impGuess(alvo, h) {
  const n = norm(h).replace(/[.:º°]/g, '').trim(); if (!n || n.length > 40) return '';
  const C = IMP_ALVOS[alvo].campos;
  if (n.includes('marca') && n.includes('modelo') && C.some((c) => c[0] === 'marcaModelo')) return 'marcaModelo';
  for (const [k, , syn] of C) if (syn.includes(n)) return k;
  for (const [k, , syn] of C) if (syn.some((s) => s.length > 3 && n.startsWith(s))) return k;
  for (const [k, , syn] of C) if (syn.some((s) => s.length > 4 && n.includes(s))) return k;
  return '';
}
function parseCSV(txt) {
  const first = txt.split(/\r?\n/)[0] || ''; const cnt = (c) => first.split(c).length;
  const sep = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function impLerArquivo(file, alvo) {
  const ext = file.name.split('.').pop().toLowerCase(); let rows = [], imgs = [];
  if (ext === 'csv' || ext === 'txt') rows = parseCSV((await file.text()).replace(/^﻿/, ''));
  else if (['xlsx', 'xls', 'ods'].includes(ext)) {
    await loadScript(LIBS.xlsx); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    for (const n of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }); if (r.some((x) => x.some((c) => String(c).trim()))) { rows = r; break; } }
  } else if (ext === 'docx') {
    await loadScript(LIBS.mammoth);
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const doc = new DOMParser().parseFromString(value, 'text/html'); const trs = [...doc.querySelectorAll('table tr')];
    if (trs.length) {
      for (const tr of trs) { if (tr.querySelector('table')) continue; rows.push([...tr.children].map((td) => td.textContent.replace(/\s+/g, ' ').trim())); const im = tr.querySelector('img'); imgs[rows.length - 1] = im ? im.getAttribute('src') : null; }
    } else for (const p of doc.querySelectorAll('p,li')) { const t = p.textContent.trim(); if (t) rows.push(t.split(/\t|;|\s{2,}|\s[-–—|]\s/).map((s) => s.trim())); }
  } else if (ext === 'pdf') {
    await loadScript(LIBS.pdf); pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfw;
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; const lines = [];
    for (let pn = 1; pn <= pdf.numPages; pn++) {
      const page = await pdf.getPage(pn); const tc = await page.getTextContent(); const byY = [];
      for (const it of tc.items) {
        const s = it.str; if (!s || !s.trim()) continue; const x = it.transform[4], y = it.transform[5];
        let ln = byY.find((l) => Math.abs(l.y - y) < 3.5); if (!ln) { ln = { y, items: [] }; byY.push(ln); }
        ln.items.push({ t: s, x, end: x + (it.width || s.length * 5) });
      }
      byY.sort((a, b) => b.y - a.y);
      for (const l of byY) {
        l.items.sort((a, b) => a.x - b.x); const cells = [];
        for (const it of l.items) { const last = cells[cells.length - 1]; if (last && it.x - last.end < 6) { last.t += (it.x - last.end > 1.5 ? ' ' : '') + it.t; last.end = it.end; } else cells.push({ ...it }); }
        lines.push(cells);
      }
    }
    let hi = -1, best = 1;
    lines.slice(0, 40).forEach((c, i) => { const s = c.filter((x) => impGuess(alvo, x.t)).length; if (s > best) { best = s; hi = i; } });
    if (hi >= 0) {
      const cols = lines[hi].map((c) => c.x); rows.push(lines[hi].map((c) => c.t.trim()));
      for (const cells of lines.slice(hi + 1)) {
        const r = new Array(cols.length).fill('');
        for (const c of cells) { let k = 0; for (let j = 0; j < cols.length; j++) if (c.x >= cols[j] - 12) k = j; r[k] = (r[k] ? r[k] + ' ' : '') + c.t.trim(); }
        rows.push(r);
      }
    } else rows = lines.map((c) => c.map((x) => x.t.trim()));
  } else throw new Error('Formato não suportado. Use Excel, CSV, Word (.docx) ou PDF.');
  return { rows: rows.map((r) => r.map((c) => String(c ?? '').trim())), imgs };
}

/* ---------- tela de importação (folha) ---------- */
let IMP = null;
function abrirImportar(alvo = 'veiculos') {
  IMP = { alvo, modo: 'atualizar', dataPadrao: hojeISO() };
  openSheet('Importar arquivo', `
    <label class="f" for="impAlvo">Importar para
      <select id="impAlvo">${Object.entries(IMP_ALVOS).map(([k, v]) => `<option value="${k}" ${k === alvo ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label>
    <label class="drop" for="impFile">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/></svg>
      <b>Escolher arquivo</b><small>Excel (.xlsx, .xls), CSV, ODS, Word (.docx) ou PDF com tabela</small></label>
    <input type="file" id="impFile" accept=".xlsx,.xls,.ods,.csv,.txt,.docx,.pdf" hidden>
    <div id="impStage" class="view" hidden></div>
    <div class="note" id="impDica"></div>
    <div class="btnrow"><button class="btn" id="impModelo" type="button">Baixar planilha modelo</button></div>
    ${alvo === 'veiculos' ? `<div class="setrow"><h3>Fotos em lote</h3><p>Nomeie cada foto com a placa (ex.: <b>BRA2E19.jpg</b>) e selecione todas de uma vez.</p>
      <label class="btn" for="fotoLote">Selecionar fotos</label><input type="file" id="fotoLote" accept="image/*" multiple hidden></div>` : ''}`);
  const dica = () => {
    const C = IMP_ALVOS[IMP.alvo].campos.map((c) => c[1]).join(', ');
    $('#impDica').innerHTML = `Colunas reconhecidas: <b>${esc(C)}</b>.` + (IMP.alvo === 'agendados' ? ' Linhas sem data entram na data que você escolher na conferência.' : '') + (IMP.alvo === 'veiculos' ? ' Fotos dentro de tabelas do Word também são importadas.' : '');
  };
  dica();
  $('#impAlvo').onchange = (e) => { IMP.alvo = e.target.value; dica(); if (IMP.rows) impPreparar(IMP.rows, IMP.imgs, IMP.nomeArq); };
  $('#impFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const st = $('#impStage'); st.hidden = false; st.innerHTML = `<p class="count"><span class="spin"></span> Lendo ${esc(f.name)}…</p>`;
    try {
      const { rows, imgs } = await impLerArquivo(f, IMP.alvo);
      if (!rows.length) throw new Error('Não encontrei linhas no arquivo.');
      impPreparar(rows, imgs, f.name);
    } catch (err) { st.innerHTML = `<div class="note"><b>Não foi possível ler o arquivo.</b> ${esc(err.message)} Se for um PDF escaneado (foto do papel), converta para Excel ou Word antes.</div>`; }
  };
  $('#impModelo').onclick = () => {
    const mod = {
      veiculos: ['Placa;Nome;Posto/Grad;Vínculo;Marca;Modelo;Cor;Setor/Pelotão;Telefone;Validade;Situação;Observação', 'BRA2E19;Fulano de Tal;Cad. PM;Cadete;Volkswagen;Gol;Prata;Pelotão Alfa;(41) 99999-0000;10/12/2027;Ativo;'],
      viaturas: ['Prefixo;Placa;Tipo;Marca;Modelo;Cor;KM atual;Observação', '13-1234;PMP1R23;Caminhonete;Toyota;Hilux;Caracterizada;48210;'],
      alertas: ['Placa;Motivo;Fonte;Marca/Modelo;Cor;Válido até;Observação', 'ABC1D23;Veículo de interesse;Determinação do Comando;Fiat Uno;Branco;31/12/2026;'],
      agendados: ['Nome;Documento;Placa;Veículo;Cor;Destino;Autorizado por;Data;Até a data;Horário;Observação', 'Fulano de Tal;RG 12.345.678-9;BRA2E19;Fiat Strada;Branca;Seção de Logística — manutenção;Cap. Fulano;05/11/2026;;08h às 12h;'],
    }[IMP.alvo];
    download('modelo-' + IMP.alvo + '.csv', '﻿' + mod.join('\r\n'), 'text/csv');
  };
  const fl = $('#fotoLote');
  if (fl) fl.onchange = async (e) => {
    const fs = [...e.target.files]; e.target.value = ''; if (!fs.length) return;
    toast('Processando ' + fs.length + ' fotos…', 9000); const upd = []; let miss = 0;
    for (const f of fs) {
      const nm = f.name.replace(/\.[^.]+$/, '').toUpperCase(); const p = normPlate((nm.match(/[A-Z]{3}[\s-]?\d[A-Z0-9]\d{2}/) || [''])[0]);
      const v = p && (Dados.V.get(p) || Dados.V.get(altPlate(p)));
      if (!v) { miss++; continue; }
      const foto = await resizeImg(await fileToDataURL(f)); if (foto) upd.push({ ...v, foto, atualizadoEm: Date.now() });
    }
    await Dados.salvarVarios('veiculos', upd);
    toast(upd.length + ' fotos ligadas' + (miss ? ' · ' + miss + ' sem placa cadastrada' : ''), 5000);
  };
}
function impPreparar(rows, imgs, nomeArq) {
  const alvo = IMP.alvo;
  let hi = -1, best = 1;
  rows.slice(0, 15).forEach((r, i) => { const s = r.filter((c) => impGuess(alvo, c)).length; if (s > best) { best = s; hi = i; } });
  const ncol = Math.max(...rows.map((r) => r.length), 0); let map;
  if (hi >= 0) map = Array.from({ length: ncol }, (_, i) => impGuess(alvo, rows[hi][i] || ''));
  else map = new Array(ncol).fill('');
  if (!map.includes('placa')) {
    let bc = -1, bn = 0;
    for (let c = 0; c < ncol; c++) { if (map[c]) continue; const n = rows.filter((r) => validPlate(normPlate(r[c]))).length; if (n > bn) { bn = n; bc = c; } }
    if (bc >= 0 && bn > rows.length * 0.3) map[bc] = 'placa';
  }
  const data = []; rows.forEach((r, i) => { if (i <= hi || !r.some(Boolean)) return; data.push({ r, img: (imgs || [])[i] || null }); });
  Object.assign(IMP, { rows, imgs, nomeArq, head: hi >= 0 ? rows[hi] : null, map, data, ncol });
  impRender();
}
function impObj(row) {
  const o = {};
  IMP.map.forEach((f, ci) => {
    if (!f) return; const val = (row.r[ci] || '').trim(); if (!val) return;
    if (f === 'marcaModelo' && (IMP.alvo === 'veiculos' || IMP.alvo === 'viaturas')) { const p = val.split(/\s*[\/\-–]\s*|\s+/); o.marca = o.marca || p[0]; o.modelo = o.modelo || p.slice(1).join(' '); }
    else if (f === 'placa') { if (!o.placa || !validPlate(normPlate(o.placa))) o.placa = val; }
    else o[f] = o[f] ? o[f] + ' ' + val : val;
  });
  if (IMP.alvo !== 'agendados' && !validPlate(normPlate(o.placa))) {
    for (const c of row.r) { const m = String(c).toUpperCase().match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/); if (m) { o.placa = m[0]; break; } }
  }
  return o;
}
function impRender() {
  const A = IMP_ALVOS[IMP.alvo], st = $('#impStage'); st.hidden = false;
  const opts = (f) => `<option value="">— ignorar —</option>` + A.campos.map(([k, l]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${l}</option>`).join('');
  const objs = IMP.data.map(impObj); const ok = objs.filter(A.valido).length;
  const mapa = Dados.mapa(IMP.alvo); const exist = IMP.alvo === 'agendados' ? 0 : objs.filter((o) => A.valido(o) && mapa.has(A.chave(o))).length;
  const nimg = IMP.alvo === 'veiculos' ? IMP.data.filter((d) => d.img).length : 0;
  const prev = IMP.data.slice(0, 8);
  st.innerHTML = `<h3 class="sec">Conferir — ${esc(IMP.nomeArq)}</h3>
    <p class="count">${IMP.data.length} linhas · <b>${ok}</b> válidas${exist ? ' · ' + exist + ' já cadastradas' : ''}${nimg ? ' · ' + nimg + ' fotos' : ''}. Ajuste o que cada coluna significa:</p>
    <div class="tablewrap"><table><thead><tr>${nimg ? '<th>Foto</th>' : ''}${Array.from({ length: IMP.ncol }, (_, i) => `<th><div style="font-size:11px;color:var(--muted);margin-bottom:4px">${esc(IMP.head ? IMP.head[i] || 'Coluna ' + (i + 1) : 'Coluna ' + (i + 1))}</div><select data-col="${i}" aria-label="Campo da coluna ${i + 1}">${opts(IMP.map[i])}</select></th>`).join('')}</tr></thead>
    <tbody>${prev.map((d, j) => `<tr class="${A.valido(objs[j]) ? '' : 'bad'}">${nimg ? `<td>${d.img ? `<img src="${esc(d.img)}" alt="">` : ''}</td>` : ''}${Array.from({ length: IMP.ncol }, (_, i) => `<td>${esc(d.r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${IMP.data.length > 8 ? `<p class="count">Mostrando 8 de ${IMP.data.length} linhas. Linhas riscadas serão ignoradas.</p>` : ''}
    ${IMP.alvo === 'agendados' ? `<label class="f" for="impData">Data para linhas sem data<input type="date" id="impData" value="${IMP.dataPadrao}"></label>`
      : `<label class="f" for="impModo">Placas que já existem<select id="impModo"><option value="atualizar" ${IMP.modo === 'atualizar' ? 'selected' : ''}>Atualizar com os dados do arquivo</option><option value="pular" ${IMP.modo === 'pular' ? 'selected' : ''}>Manter como estão (pular)</option></select></label>`}
    <div class="btnrow"><button class="btn ghost" id="impCancel" type="button">Cancelar</button><button class="btn primary" id="impGo" type="button" ${ok ? '' : 'disabled'}>Importar ${ok} itens</button></div>`;
  $$('#impStage select[data-col]').forEach((s) => (s.onchange = () => { IMP.map[+s.dataset.col] = s.value; impRender(); }));
  const m = $('#impModo'); if (m) m.onchange = (e) => (IMP.modo = e.target.value);
  const d = $('#impData'); if (d) d.onchange = (e) => (IMP.dataPadrao = e.target.value || hojeISO());
  $('#impCancel').onclick = () => { st.hidden = true; st.innerHTML = ''; IMP.rows = null; };
  $('#impGo').onclick = impGravar;
}
async function impGravar() {
  const btn = $('#impGo'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Importando…';
  const A = IMP_ALVOS[IMP.alvo], mapa = Dados.mapa(IMP.alvo);
  let novos = 0, atual = 0, pul = 0, ign = 0; const out = [];
  for (const d of IMP.data) {
    const o = impObj(d); if (!A.valido(o)) { ign++; continue; }
    const k = A.chave(o); const old = k ? mapa.get(k) : null;
    if (old && IMP.modo === 'pular') { pul++; continue; }
    const nv = A.montar(o, old, IMP);
    if (IMP.alvo === 'veiculos' && d.img) { const f = await resizeImg(d.img); if (f) nv.foto = f; }
    out.push(nv); old ? atual++ : novos++;
  }
  try {
    await Dados.salvarVarios(IMP.alvo, out);
    $('#impStage').innerHTML = `<div class="setrow"><h3>Importação concluída</h3><p><b>${novos}</b> novos · <b>${atual}</b> atualizados${pul ? ` · ${pul} mantidos` : ''}${ign ? ` · ${ign} linhas ignoradas` : ''}.</p>
      <button class="btn" id="impVer" type="button">Ver ${esc(A.nome.toLowerCase())}</button></div>`;
    $('#impVer').onclick = () => { closeSheet(); irCadastro(IMP.alvo); };
  } catch (e) { $('#impStage').innerHTML = `<div class="note"><b>Falhou.</b> ${esc(mensagemErro(e))}</div>`; }
}
