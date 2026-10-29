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
async function impLerArquivo(file, alvo, aviso = () => {}) {
  const ext = file.name.split('.').pop().toLowerCase(); let rows = [], imgs = [], texto = null, ocr = false;
  const ehImagem = /^image\//.test(file.type) || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext);
  if (ehImagem) {
    aviso('Lendo o texto da imagem… (na 1ª vez baixa o leitor)');
    const src = await fileToDataURL(file); const im = await loadImg(src);
    const s = Math.min(1, 2400 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    texto = await ocrTexto(c); ocr = true; rows = linhasEmLinhas(texto);
  } else if (ext === 'csv' || ext === 'tsv') rows = parseCSV((await file.text()).replace(/^﻿/, ''));
  else if (ext === 'txt' || ext === 'md') { texto = (await file.text()).replace(/^﻿/, ''); rows = /[;\t]/.test(texto.split('\n')[0] || '') ? parseCSV(texto) : linhasEmLinhas(texto); }
  else if (ext === 'rtf') { texto = rtfParaTexto(await file.text()); rows = linhasEmLinhas(texto); }
  else if (ext === 'html' || ext === 'htm') rows = htmlParaLinhas(await file.text());
  else if (ext === 'odt') rows = await odtParaLinhas(await file.arrayBuffer());
  else if (ext === 'doc') { texto = docAntigoParaTexto(await file.arrayBuffer()); rows = linhasEmLinhas(texto); }
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
    let temTexto = false;
    for (let pn = 1; pn <= pdf.numPages; pn++) {
      const page = await pdf.getPage(pn); const tc = await page.getTextContent(); const byY = [];
      for (const it of tc.items) {
        const s = it.str; if (!s || !s.trim()) continue; temTexto = true; const x = it.transform[4], y = it.transform[5];
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
    if (!temTexto) { texto = await pdfEscaneado(pdf, aviso); ocr = true; return { rows: linhasEmLinhas(texto), imgs, texto, ocr }; }
    texto = lines.map((c) => c.map((x) => x.t).join('  ')).join('\n');
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
  } else throw new Error('Formato não reconhecido. Use planilha (Excel, ODS, CSV), Word (.docx, .doc, .odt, .rtf), PDF, imagem ou texto.');
  rows = rows.map((r) => r.map((c) => String(c ?? '').trim()));
  if (texto == null) texto = rows.map((r) => r.join('  ')).join('\n');
  return { rows, imgs, texto, ocr };
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
      <b>Escolher arquivo</b><small>Planilha (Excel, ODS, CSV), Word (.docx, .doc), ODT, RTF, PDF (inclusive escaneado), foto de uma lista ou texto</small></label>
    <input type="file" id="impFile" accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.md,.docx,.doc,.odt,.rtf,.html,.htm,.pdf,image/*" hidden>
    <details class="setrow" id="impColarBox"><summary style="cursor:pointer;font-weight:600">Colar texto (WhatsApp, e-mail, ofício…)</summary>
      <textarea id="impColar" rows="6" placeholder="Cole aqui uma lista com placas ou prefixos, uma por linha. Ex.:&#10;BRA2E19 — Cad. Fulano — Gol prata&#10;VTR 13-1234 Hilux"></textarea>
      <button class="btn" id="impColarGo" type="button">Procurar placas e prefixos</button></details>
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
  $('#impAlvo').onchange = (e) => { IMP.alvo = e.target.value; dica(); if (IMP.solta) impSoltaRender(); else if (IMP.rows) impPreparar(IMP.rows, IMP.imgs, IMP.nomeArq); };
  $('#impColarGo').onclick = () => {
    const t = $('#impColar').value; if (!t.trim()) { toast('Cole o texto primeiro'); return; }
    Object.assign(IMP, { rows: null, imgs: [], nomeArq: 'texto colado', texto: t }); impSolta(t, false);
  };
  $('#impFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const st = $('#impStage'); st.hidden = false; st.innerHTML = `<p class="count"><span class="spin"></span> Lendo ${esc(f.name)}…</p>`;
    try {
      const aviso = (t) => { st.innerHTML = `<p class="count"><span class="spin"></span> ${esc(t)}</p>`; };
      const { rows, imgs, texto, ocr } = await impLerArquivo(f, IMP.alvo, aviso);
      if (!rows.length && !(texto || '').trim()) throw new Error('Não encontrei texto no arquivo.');
      IMP.texto = texto; IMP.ocr = ocr; IMP.solta = null;
      if (ocr) { Object.assign(IMP, { rows, imgs, nomeArq: f.name }); impSolta(texto, true); } // foto/escaneado: sempre como lista
      else impPreparar(rows, imgs, f.name);
    } catch (err) { st.innerHTML = `<div class="note"><b>Não foi possível ler o arquivo.</b> ${esc(err.message)}</div>`; }
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
function impPreparar(rows, imgs, nomeArq, forcarTabela) {
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
  // sem cabeçalho e sem coluna de placa/prefixo: é texto corrido — procura placas e prefixos linha a linha
  if (!forcarTabela && alvo !== 'agendados' && hi < 0 && !map.includes('placa') && !map.includes('prefixo')) { impSolta(IMP.texto || rows.map((r) => r.join('  ')).join('\n'), IMP.ocr); return; }
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
    <div class="btnrow"><button class="btn ghost" id="impCancel" type="button">Cancelar</button>${IMP.alvo !== 'agendados' ? '<button class="btn" id="impSoltaBtn" type="button">Ler como lista solta</button>' : ''}<button class="btn primary" id="impGo" type="button" ${ok ? '' : 'disabled'}>Importar ${ok} itens</button></div>`;
  $$('#impStage select[data-col]').forEach((s) => (s.onchange = () => { IMP.map[+s.dataset.col] = s.value; impRender(); }));
  const m = $('#impModo'); if (m) m.onchange = (e) => (IMP.modo = e.target.value);
  const d = $('#impData'); if (d) d.onchange = (e) => (IMP.dataPadrao = e.target.value || hojeISO());
  $('#impCancel').onclick = () => { st.hidden = true; st.innerHTML = ''; IMP.rows = null; };
  const sb = $('#impSoltaBtn'); if (sb) sb.onclick = () => impSolta(IMP.texto || IMP.rows.map((r) => r.join('  ')).join('\n'), IMP.ocr);
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

/* ---------- formatos extras: imagem/foto, PDF escaneado, .doc, .odt, .rtf, .html, texto ---------- */
const LIB_JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const linhasEmLinhas = (txt) => String(txt || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\t|;|\s{2,}|\s[|]\s/).map((s) => s.trim()));
let ocrDoc = null;
/** Leitor de texto para documentos (português, página inteira) — separado do leitor de placas da câmera. */
async function ocrTexto(fonte, progresso) {
  await loadScript(LIBS.tess);
  if (!ocrDoc) ocrDoc = await Tesseract.createWorker('por', 1);
  if (progresso) progresso();
  const { data } = await ocrDoc.recognize(fonte);
  return data.text || '';
}
function rtfParaTexto(rtf) {
  return rtf.replace(/\\'([0-9a-f]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(par|line|row)d?\b/g, '\n').replace(/\\cell\b/g, '\t')
    .replace(/\{\\\*[^{}]*\}/g, '').replace(/\\[a-zA-Z]+-?\d* ?/g, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n');
}
/** Word 97-2003 (.doc): não há leitor no navegador; extrai o texto bruto (basta para achar placas e prefixos). */
function docAntigoParaTexto(buf) {
  const b = new Uint8Array(buf);
  const latin = new TextDecoder('windows-1252').decode(b).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]+/g, '\n');
  const utf16 = new TextDecoder('utf-16le').decode(b.subarray(0, b.length - (b.length % 2))).replace(/[^\x20-\x7EÀ-ÿ\n\r\t]+/g, '\n');
  const conta = (t) => (t.toUpperCase().match(/\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/g) || []).length + (t.match(/[a-zà-ú]{4,}/gi) || []).length / 50;
  const t = conta(utf16) > conta(latin) ? utf16 : latin;
  return t.split('\n').map((l) => l.trim()).filter((l) => l.length >= 3).join('\n');
}
async function odtParaLinhas(buf) {
  await loadScript(LIB_JSZIP);
  const zip = await JSZip.loadAsync(buf); const xml = await zip.file('content.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml'); const NS = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';
  const trs = [...doc.getElementsByTagNameNS(NS, 'table-row')];
  if (trs.length) return trs.map((tr) => [...tr.getElementsByTagNameNS(NS, 'table-cell')].map((c) => c.textContent.trim()));
  const P = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  return linhasEmLinhas([...doc.getElementsByTagNameNS(P, 'p')].map((p) => p.textContent).join('\n'));
}
function htmlParaLinhas(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'); const trs = [...doc.querySelectorAll('tr')];
  if (trs.length) return trs.map((tr) => [...tr.children].map((td) => td.textContent.replace(/\s+/g, ' ').trim()));
  return linhasEmLinhas(doc.body ? doc.body.innerText || doc.body.textContent : '');
}
/** PDF escaneado: desenha as páginas e passa pelo leitor de texto. */
async function pdfEscaneado(pdf, aviso) {
  let txt = ''; const n = Math.min(pdf.numPages, 15);
  for (let pn = 1; pn <= n; pn++) {
    aviso(`Lendo página ${pn} de ${n} (PDF escaneado)…`);
    const page = await pdf.getPage(pn); const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    txt += (await ocrTexto(c)) + '\n';
  }
  return txt;
}

/* ---------- lista solta: acha placas e prefixos em qualquer texto ---------- */
const RE_PREFIXO = /\b(?:VTR|VIATURA|PREF(?:IXO)?)\.?\s*(?:N[º°O.]?\s*)?[:\-–]?\s*([A-Z]{0,3}[\s-]?\d{1,3}[\s.\-\/]?\d{2,5}|\d{3,6})\b|(?<![\/\d])\b(\d{1,3}-\d{3,5})\b(?![\/\d])/i;
/** Itens {placa, prefixo, texto} de cada linha. ocr=true aceita correções de letra/número (foto ou escaneado). */
function extrairItens(texto, ocr) {
  const out = [], vistos = new Set();
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, ' ').trim(); if (linha.length < 3) continue;
    const up = linha.toUpperCase();
    // placas (com ou sem hífen/espaço)
    // procura em todas as posições (sem "engolir" a placa vizinha), com limite de palavra dos dois lados
    const placas = [], brutos = [];
    for (const m of up.matchAll(/(?<![A-Z0-9])(?=([A-Z0-9]{3}[\s-]?[A-Z0-9]{2}[\s-]?[A-Z0-9]{2})(?![A-Z0-9]))/g)) {
      const raw = m[1], w = raw.replace(/[\s-]/g, ''); if (w.length !== 7 || /^VTR/.test(w)) continue;
      const r = fixWin(w); if (r && (r.c === 0 || (ocr && r.c <= 1)) && !placas.includes(r.p)) { placas.push(r.p); brutos.push(linha.substr(m.index, raw.length)); }
    }
    const mp = linha.match(RE_PREFIXO);
    let prefixo = mp ? (mp[1] || mp[2] || '').toUpperCase().replace(/\s+/g, '') : '';
    if (prefixo && placas.some((p) => normDoc(prefixo) === p)) prefixo = '';
    if (!placas.length && !prefixo) continue;
    let resto = linha;
    for (const b of brutos) resto = resto.replace(b, ' ');
    if (mp) resto = resto.replace(mp[0], ' ');
    resto = resto.replace(/\b(placas?|prefixos?|vtrs?|viaturas?)\b:?/gi, ' ').replace(/^[\s\d.)\-–—:|]+/, '').replace(/[\s;,|–—-]+$/, '').replace(/\s{2,}/g, ' ').trim();
    const lista = placas.length ? placas : [''];
    lista.forEach((placa, i) => {
      const chave = (placa || '') + '|' + (i === 0 ? prefixo : '');
      if (vistos.has(chave)) return; vistos.add(chave);
      out.push({ placa, prefixo: i === 0 ? prefixo : '', texto: resto, ok: true });
    });
  }
  return out;
}
function impSolta(texto, ocr) {
  IMP.solta = extrairItens(texto, ocr); IMP.soltaTexto = texto; IMP.soltaOcr = !!ocr;
  impSoltaRender();
}
function impSoltaRender() {
  const st = $('#impStage'); st.hidden = false; const it = IMP.solta, alvo = IMP.alvo;
  const usos = { veiculos: [['nome', 'Nome do responsável'], ['modelo', 'Marca e modelo'], ['obs', 'Observação'], ['', 'Ignorar']],
    viaturas: [['modelo', 'Marca e modelo'], ['obs', 'Observação'], ['', 'Ignorar']], alertas: [['motivo', 'Motivo'], ['obs', 'Observação'], ['', 'Ignorar']],
    agendados: [['nome', 'Nome'], ['destino', 'Destino / motivo'], ['', 'Ignorar']] }[alvo];
  if (IMP.soltaUsoAlvo !== alvo) { IMP.soltaUso = usos[0][0]; IMP.soltaUsoAlvo = alvo; } // padrão muda com o destino
  const validos = (x) => x.ok && (alvo === 'viaturas' ? !!(x.placa || x.prefixo) : !!x.placa);
  const n = it.filter(validos).length;
  st.innerHTML = `<h3 class="sec">Lista encontrada — ${esc(IMP.nomeArq || 'texto colado')}</h3>
    <p class="count">${it.length ? `${it.length} ${it.length === 1 ? 'item encontrado' : 'itens encontrados'}${IMP.soltaOcr ? ' por leitura de imagem — confira cada placa' : ''}. Desmarque o que não for importar.` : 'Nenhuma placa ou prefixo encontrado neste texto.'}${alvo !== 'viaturas' ? ' Itens só com prefixo entram apenas em Viaturas.' : ''}</p>
    ${it.length ? `<div class="tablewrap"><table><thead><tr><th></th><th>Placa</th><th>Prefixo</th><th>Texto da linha</th></tr></thead><tbody>
      ${it.map((x, i) => `<tr class="${validos({ ...x, ok: true }) ? '' : 'bad'}"><td><input type="checkbox" data-si="${i}" ${x.ok ? 'checked' : ''} aria-label="Importar linha ${i + 1}"></td>
        <td><input data-sp="${i}" value="${esc(x.placa)}" maxlength="8" style="min-height:34px;width:96px;text-transform:uppercase;font-weight:600"></td>
        <td><input data-sx="${i}" value="${esc(x.prefixo)}" style="min-height:34px;width:90px;text-transform:uppercase"></td><td>${esc(x.texto)}</td></tr>`).join('')}</tbody></table></div>
    <div class="grid2"><label class="f" for="soUso">O texto ao lado é<select id="soUso">${usos.map(([k, l]) => `<option value="${k}" ${k === IMP.soltaUso ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${alvo === 'veiculos' ? `<label class="f" for="soVinc">Vínculo de todos<select id="soVinc">${VINC.map((v) => `<option ${v === (IMP.soltaVinc || 'Cadete') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : ''}
      ${alvo === 'alertas' ? `<label class="f" for="soMot">Motivo padrão<input id="soMot" value="${esc(IMP.soltaMot || 'Veículo de interesse')}"></label>` : ''}
      ${alvo === 'agendados' ? `<label class="f" for="impData">Data<input type="date" id="impData" value="${IMP.dataPadrao}"></label>` : ''}</div>
    ${alvo !== 'agendados' ? `<label class="f" for="impModo">Placas/prefixos que já existem<select id="impModo"><option value="atualizar" ${IMP.modo === 'atualizar' ? 'selected' : ''}>Atualizar</option><option value="pular" ${IMP.modo === 'pular' ? 'selected' : ''}>Manter como estão (pular)</option></select></label>` : ''}` : ''}
    <div class="btnrow"><button class="btn ghost" id="impCancel" type="button">Cancelar</button>${IMP.rows && IMP.rows.length && IMP.rows[0].length > 1 ? '<button class="btn" id="soTabela" type="button">Ler como tabela</button>' : ''}<button class="btn primary" id="soGo" type="button" ${n ? '' : 'disabled'}>Importar ${n} itens</button></div>`;
  const sync = () => { const b = $('#soGo'); const k = it.filter(validos).length; b.disabled = !k; b.textContent = `Importar ${k} itens`; };
  $$('[data-si]', st).forEach((c) => (c.onchange = () => { it[+c.dataset.si].ok = c.checked; sync(); }));
  $$('[data-sp]', st).forEach((c) => (c.onchange = () => { const p = normPlate(c.value); it[+c.dataset.sp].placa = validPlate(p) ? p : ''; c.value = it[+c.dataset.sp].placa; c.closest('tr').classList.toggle('bad', !validos({ ...it[+c.dataset.sp], ok: true })); sync(); }));
  $$('[data-sx]', st).forEach((c) => (c.onchange = () => { it[+c.dataset.sx].prefixo = c.value.trim().toUpperCase(); c.closest('tr').classList.toggle('bad', !validos({ ...it[+c.dataset.sx], ok: true })); sync(); }));
  const u = $('#soUso'); if (u) u.onchange = (e) => (IMP.soltaUso = e.target.value);
  const v = $('#soVinc'); if (v) v.onchange = (e) => (IMP.soltaVinc = e.target.value);
  const mo = $('#soMot'); if (mo) mo.onchange = (e) => (IMP.soltaMot = e.target.value);
  const d = $('#impData'); if (d) d.onchange = (e) => (IMP.dataPadrao = e.target.value || hojeISO());
  const m = $('#impModo'); if (m) m.onchange = (e) => (IMP.modo = e.target.value);
  $('#impCancel').onclick = () => { st.hidden = true; st.innerHTML = ''; IMP.rows = null; IMP.solta = null; };
  const tb = $('#soTabela'); if (tb) tb.onclick = () => { IMP.solta = null; impPreparar(IMP.rows, IMP.imgs, IMP.nomeArq, true); };
  const go = $('#soGo'); if (go) go.onclick = () => impSoltaGravar(validos);
}
async function impSoltaGravar(validos) {
  const alvo = IMP.alvo, A = IMP_ALVOS[alvo], mapa = Dados.mapa(alvo), uso = IMP.soltaUso;
  const btn = $('#soGo'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Importando…';
  let novos = 0, atual = 0, pul = 0; const out = [];
  for (const x of IMP.solta.filter(validos)) {
    const o = { placa: x.placa, prefixo: x.prefixo };
    if (uso && x.texto) { if (uso === 'modelo') o.marcaModelo = x.texto; else o[uso] = x.texto; }
    if (o.marcaModelo && alvo !== 'agendados') { const p = o.marcaModelo.split(/\s*[\/\-–]\s*|\s+/); o.marca = p[0]; o.modelo = p.slice(1).join(' '); if (alvo === 'alertas') o.marcaModelo = x.texto; }
    if (!A.valido(o)) continue;
    const k = A.chave(o); const old = k ? mapa.get(k) : null;
    if (alvo === 'veiculos' && !old) o.vinculo = IMP.soltaVinc || 'Cadete'; // não troca o vínculo de quem já existe
    if (alvo === 'alertas' && !o.motivo && !(old && old.motivo)) o.motivo = IMP.soltaMot || 'Veículo de interesse';
    if (old && IMP.modo === 'pular') { pul++; continue; }
    out.push(A.montar(o, old, IMP)); old ? atual++ : novos++;
  }
  try {
    await Dados.salvarVarios(alvo, out);
    $('#impStage').innerHTML = `<div class="setrow"><h3>Importação concluída</h3><p><b>${novos}</b> novos · <b>${atual}</b> atualizados${pul ? ` · ${pul} mantidos` : ''}.</p><button class="btn" id="impVer" type="button">Ver ${esc(A.nome.toLowerCase())}</button></div>`;
    $('#impVer').onclick = () => { closeSheet(); irCadastro(alvo); };
  } catch (e) { $('#impStage').innerHTML = `<div class="note"><b>Falhou.</b> ${esc(mensagemErro(e))}</div>`; }
}
