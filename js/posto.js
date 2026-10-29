/* Rotina do posto: ocorrências, rondas com QR Code, viaturas de outras unidades
   (pelo prefixo), vagas do pátio e painel do comando. */
"use strict";
const CAT_OC = ['Ronda / patrulha', 'Defeito / manutenção', 'Energia / água', 'Pessoa ou veículo suspeito', 'Visita de autoridade', 'Acidente / dano', 'Outros'];
const QR_PREFIXO = 'APMG-RONDA:';
const LIBS_QR = {
  gerar: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  ler: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
};

/* ---------- ocorrências do posto ---------- */
function abrirOcorrencia() {
  let cat = '', fotos = [];
  openSheet('Nova ocorrência', `<form class="view" id="ocForm" autocomplete="off">
    <div class="f"><span>Tipo *</span>${chipsHTML('ocCat', CAT_OC, '')}</div>
    <label class="f" for="ocTxt">O que aconteceu *<textarea id="ocTxt" rows="4" placeholder="Ex.: 02h10 — lâmpada do poste da entrada queimada; comunicado ao Of. de Dia."></textarea></label>
    <div class="btnrow"><label class="btn" for="ocFoto">Anexar foto (até 3)</label><input type="file" id="ocFoto" accept="image/*" capture="environment" hidden><span class="count" id="ocFotoN"></span></div>
    <button class="btn primary big" type="submit">Registrar ocorrência</button>
    <p class="count">Fica no livro e entra na passagem de serviço.</p></form>`);
  ligarChips('ocCat', (v) => (cat = v));
  $('#ocFoto').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (fotos.length >= 3) { toast('Limite de 3 fotos'); return; }
    const d = await resizeImg(await fileToDataURL(f), 720, .72); if (d) fotos.push(d); $('#ocFotoN').textContent = fotos.length + (fotos.length === 1 ? ' foto' : ' fotos');
  };
  $('#ocForm').onsubmit = async (e) => {
    e.preventDefault(); const txt = $('#ocTxt').value.trim();
    if (!cat) { toast('Escolha o tipo da ocorrência'); return; } if (!txt) { toast('Descreva a ocorrência'); $('#ocTxt').focus(); return; }
    try { await registrar({ kind: 'ocorrencia', chave: 'OC:' + novoId(), tipo: 'ocorrencia', resultado: 'oc', categoria: cat, nome: cat, obs: txt, fotos: fotos.length ? fotos : undefined, origem: 'posto' }); closeSheet(); }
    catch (err) { /* sem sentinela ou somente leitura */ }
  };
}
function verOcorrencia(k) {
  const r = Dados.R.find((x) => x.chave === k); if (!r) return;
  openSheet('Ocorrência', `<div class="setrow"><span class="oc-cat" style="align-self:flex-start">${esc(r.categoria || 'Ocorrência')}</span>
    <p style="color:var(--fg);white-space:pre-wrap">${esc(r.obs || '')}</p><p>${fmtDT(r.ts)}${r.sentinela ? ' · ' + esc(r.sentinela) : ''}</p></div>
    ${(r.fotos || []).map((f) => `<img src="${f}" alt="Foto da ocorrência" style="border-radius:12px">`).join('')}`);
}

/* ---------- viaturas de outras unidades (pelo prefixo) ---------- */
const chavePfx = (p) => 'PFX:' + normDoc(p);
function abrirVtrExterna(pre = {}) {
  openSheet('Viatura de outra unidade', `<form class="view" id="veForm" autocomplete="off">
    <div class="grid2"><label class="f" for="vePref">Prefixo *<input id="vePref" value="${esc(pre.prefixo || '')}" autocapitalize="characters" style="font:600 22px var(--display);letter-spacing:.06em"></label>
      <label class="f" for="veUnid">Unidade / OPM *<input id="veUnid" list="dlOpm" placeholder="Ex.: 13º BPM"></label></div>
    <datalist id="dlOpm">${['12º BPM', '13º BPM', '20º BPM', '23º BPM', '33º BPM', '17º BPM', '22º BPM', '29º BPM', '34º BPM', 'BPTran', 'BPChoque', 'BOPE', 'ROTAM', 'BPMOA', 'CPU'].map((x) => `<option value="${x}"></option>`).join('')}</datalist>
    <label class="f" for="vePlaca">Placa (se tiver)<input id="vePlaca" value="${esc(pre.placa || '')}" maxlength="8" autocapitalize="characters" style="text-transform:uppercase"></label>
    <label class="f" for="veMot">Motorista ou comandante da equipe *<input id="veMot" placeholder="Ex.: Sgt. Fulano"></label>
    <label class="f" for="veDest">Motivo / destino<input id="veDest" placeholder="Ex.: apoio à formatura, entrega de documentos"></label>
    <label class="f" for="veObs">Observação<input id="veObs" placeholder="Ex.: 4 policiais na equipe"></label>
    <button class="btn ok big" type="submit">Registrar entrada</button></form>`);
  setTimeout(() => { const el = pre.prefixo ? $('#veUnid') : $('#vePref'); if (el) el.focus(); }, 80);
  $('#veForm').onsubmit = async (e) => {
    e.preventDefault();
    const pref = $('#vePref').value.trim().toUpperCase(), unid = $('#veUnid').value.trim(), mot = $('#veMot').value.trim(), placa = normPlate($('#vePlaca').value);
    if (!pref) { toast('Informe o prefixo'); return; } if (!unid) { toast('Informe a unidade'); return; } if (!mot) { toast('Informe o motorista ou comandante'); return; }
    if (placa && !validPlate(placa)) { toast('Placa inválida — deixe em branco se não tiver'); return; }
    if (isInside(chavePfx(pref))) { toast('Esta viatura já consta dentro. Registre a saída antes.', 4000); return; }
    try {
      await registrar({ kind: 'veiculo', chave: chavePfx(pref), prefixo: pref, placa: placa || '', tipo: 'entrada', resultado: 'vtrext', nome: mot, empresa: unid,
        veiculo: 'Viatura ' + unid, destino: $('#veDest').value.trim(), obs: $('#veObs').value.trim(), origem: 'prefixo' });
      closeSheet();
    } catch (err) { /* sem sentinela */ }
  };
}
function verVtrExterna(k) {
  const regs = Dados.R.filter((r) => r.chave === k).sort((a, b) => b.ts - a.ts); const r = regs[0]; if (!r) return;
  const dentro = isInside(k);
  openSheet('VTR ' + (r.prefixo || ''), `<div class="verdict ${dentro ? 'info' : 'ok'}"><span class="vtr ext xl">${esc(r.prefixo)}</span>${r.placa ? plateHTML(r.placa) : ''}<h3>${dentro ? 'Na unidade' : 'Saiu'}</h3><p>${esc(r.empresa || '')}</p></div>
    <dl class="kv"><dt>Motorista</dt><dd>${esc(r.nome || '—')}</dd>${r.destino ? `<dt>Motivo</dt><dd>${esc(r.destino)}</dd>` : ''}<dt>${dentro ? 'Entrou' : 'Último registro'}</dt><dd>${fmtDT(r.ts)}</dd></dl>
    <div class="btnrow">${dentro ? '<button class="btn primary big" id="veSai" type="button">Registrar saída</button>' : '<button class="btn ok big" id="veEnt" type="button">Nova entrada</button>'}<button class="btn ghost" id="veHist" type="button">Histórico</button></div>`);
  const s = $('#veSai'); if (s) s.onclick = async () => { try { await saidaDe(k); closeSheet(); } catch (e) { /* sem sentinela */ } };
  const en = $('#veEnt'); if (en) en.onclick = () => abrirVtrExterna({ prefixo: r.prefixo, placa: r.placa });
  $('#veHist').onclick = () => showHistory(k);
}
/** Placa ou prefixo digitado no portão. */
function consultarTexto(txt) {
  const p = normPlate(txt);
  if (validPlate(p)) { const vt = viaturaPorPlaca(p); if (vt && !alertaDe(p)) abrirViatura(vt.id); else showResult(p, 'digitada'); return; }
  const t = viaturaPorTexto(txt); if (t) { abrirViatura(t.id); return; }
  const k = chavePfx(txt); if (Dados.R.some((r) => r.chave === k)) { verVtrExterna(k); return; }
  abrirVtrExterna({ prefixo: txt.trim().toUpperCase() });
}

/* ---------- pátio ---------- */
function ocupacao() {
  const vagas = +Dados.C.vagasVisitantes || 0;
  const n = insideList().filter((r) => r.kind === 'veiculo' && (visitante(r) || r.resultado === 'vtrext')).length;
  return { vagas, n, cheio: vagas > 0 && n >= vagas };
}
function meterHTML() {
  const o = ocupacao(); if (!o.vagas) return '';
  const pct = Math.min(100, Math.round((o.n / o.vagas) * 100)), cls = o.cheio ? 'bad' : pct >= 80 ? 'warn' : '';
  return `<div class="setrow" style="gap:6px;padding:10px 14px"><div class="switch"><span>Vagas de visitantes</span><b>${o.n} / ${o.vagas}${o.cheio ? ' — lotado' : ''}</b></div><div class="meter ${cls}"><i style="width:${pct}%"></i></div></div>`;
}
/** Antes de registrar a entrada de um visitante de carro: confirma se o pátio está cheio. */
async function confirmaVaga(rec) {
  if (rec.tipo !== 'entrada' || rec.kind !== 'veiculo' || !(visitante(rec) || rec.resultado === 'vtrext')) return true;
  const o = ocupacao(); if (!o.cheio) return true;
  alertFx('warn', CFG.som);
  return !!(await ask({ title: 'Pátio de visitantes lotado', msg: `${o.n} de ${o.vagas} vagas ocupadas. Registrar a entrada mesmo assim?`, ok: 'Registrar' }));
}

/* ---------- rondas com QR Code ---------- */
const pontosAtivos = () => [...Dados.P.values()].filter((p) => p.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
function ultimaPassagem(id) { let u = null; for (const r of Dados.R) if (r.kind === 'ronda' && r.pontoId === id && (!u || r.ts > u.ts)) u = r; return u; }
function rondasAtrasadas(now = Date.now()) {
  const lim = (+Dados.C.rondaMin || 0) * 6e4; if (!lim) return [];
  return pontosAtivos().map((p) => ({ p, u: ultimaPassagem(p.id) })).filter((x) => !x.u || now - x.u.ts > lim);
}
let qrStream = null, qrLoop = 0;
function pararQR() { qrLoop++; if (qrStream) { qrStream.getTracks().forEach((t) => t.stop()); qrStream = null; } }
async function abrirRonda() {
  if (Cam.stream) Cam.stop();
  const pts = pontosAtivos();
  if (!pts.length) { toast(podeGerir() ? 'Cadastre os pontos de ronda em Mais → Rondas.' : 'Nenhum ponto de ronda cadastrado. Peça a um gestor.', 4500); return; }
  const inicio = Date.now();
  const lista = () => pontosAtivos().map((p) => {
    const u = ultimaPassagem(p.id), nesta = u && u.ts >= inicio;
    return `<li class="litem"><span class="t ${nesta ? 'ronda-ok' : ''}">${nesta ? '✓' : u ? fmtH(u.ts) : '—'}</span><div class="who"><b>${esc(p.nome)}</b><small>${u ? 'Última passagem ' + fmtDT(u.ts) + (u.origem === 'manual' ? ' (sem QR)' : '') : 'Nenhuma passagem registrada'}</small></div>
      ${nesta ? '<span></span>' : `<button class="btn sm ghost" type="button" data-semqr="${esc(p.id)}">Sem QR</button>`}</li>`;
  }).join('');
  openSheet('Ronda', `<div class="qrcam"><video id="qrVideo" playsinline muted></video><div class="alvo"></div></div>
    <p class="count" id="qrStatus">Aponte a câmera para o QR Code do ponto.</p>
    <ul class="loglist" id="qrLista">${lista()}</ul>`, () => pararQR());
  const marcar = async (p, origem, obs) => {
    const u = ultimaPassagem(p.id); if (u && Date.now() - u.ts < 120000) { $('#qrStatus').textContent = p.nome + ' já registrado agora há pouco.'; return; }
    try {
      await registrar({ kind: 'ronda', chave: 'RD:' + p.id, tipo: 'ronda', resultado: 'ronda', pontoId: p.id, nome: p.nome, origem, obs: obs || '' });
      alertFx('ok', CFG.som); $('#qrStatus').textContent = '✓ ' + p.nome + ' às ' + fmtH(Date.now());
      const l = $('#qrLista'); if (l) l.innerHTML = lista();
      if (pontosAtivos().every((x) => { const v = ultimaPassagem(x.id); return v && v.ts >= inicio; })) { toast('Ronda completa: todos os pontos registrados', 4500); }
    } catch (e) { /* sem sentinela */ }
  };
  $('#qrLista').onclick = async (e) => {
    const b = e.target.closest('[data-semqr]'); if (!b) return; const p = Dados.P.get(b.dataset.semqr);
    const mot = await ask({ title: 'Registrar ' + p.nome + ' sem QR?', msg: 'Informe o motivo (QR danificado, sem acesso…).', ok: 'Registrar', input: { ph: 'Motivo' } });
    if (mot === null) return; await marcar(p, 'manual', 'Sem QR: ' + (mot.trim() || 'sem motivo'));
  };
  try { qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
  catch (e) { $('#qrStatus').textContent = 'Câmera bloqueada. Use "Sem QR" ou permita a câmera.'; return; }
  const v = $('#qrVideo'); v.srcObject = qrStream; await v.play().catch(() => {});
  let detector = null;
  if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; } }
  if (!detector) { try { await loadScript(LIBS_QR.ler); } catch (e) { $('#qrStatus').textContent = e.message; return; } }
  const meu = ++qrLoop, c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
  let ultimo = '', ultimoEm = 0;
  const tick = async () => {
    if (meu !== qrLoop || !qrStream) return;
    try {
      let txt = null;
      if (detector) { const r = await detector.detect(v); if (r.length) txt = r[0].rawValue; }
      else if (v.videoWidth) {
        c.width = Math.min(640, v.videoWidth); c.height = Math.round(c.width * v.videoHeight / v.videoWidth); ctx.drawImage(v, 0, 0, c.width, c.height);
        const r = window.jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height); if (r) txt = r.data;
      }
      if (txt && !(txt === ultimo && Date.now() - ultimoEm < 4000)) {
        ultimo = txt; ultimoEm = Date.now();
        const p = txt.startsWith(QR_PREFIXO) ? Dados.P.get(txt.slice(QR_PREFIXO.length)) : null;
        if (p && p.ativo !== false) await marcar(p, 'qr'); else { $('#qrStatus').textContent = 'QR Code não é de um ponto de ronda cadastrado.'; alertFx('warn', CFG.som); }
      }
    } catch (e) { /* quadro perdido */ }
    setTimeout(tick, 250);
  };
  tick();
}
/* gestão dos pontos (Mais → Rondas) */
function renderRondasCfg() {
  const box = $('#rondaBox'); if (!box) return;
  const pts = [...Dados.P.values()].sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome));
  const gerir = podeGerir() && Dados.papel !== 'comando';
  box.innerHTML = `<h3>Rondas</h3><p>Cole um QR Code em cada ponto. A sentinela registra a passagem escaneando pelo botão Ronda, no Portão. ${+Dados.C.rondaMin ? `O app avisa quando um ponto fica mais de ${Dados.C.rondaMin} min sem passagem.` : 'Aviso de atraso desligado.'}</p>
    ${pts.length ? pts.map((p) => { const u = ultimaPassagem(p.id); return `<div class="acc"><span><b>${esc(p.nome)}</b>${p.ativo === false ? ' <span class="pill mut">Inativo</span>' : ''}<br><small class="count">${u ? 'Última passagem ' + fmtDT(u.ts) : 'Sem passagem registrada'}</small></span>${gerir ? `<button class="btn sm" type="button" data-pt="${esc(p.id)}">Editar</button>` : ''}</div>`; }).join('') : '<p class="count">Nenhum ponto cadastrado.</p>'}
    ${gerir ? `<div class="grid2"><label class="f" for="cfgRonda">Avisar se um ponto passar de (min, 0 = desliga)<input type="number" id="cfgRonda" min="0" max="1440" step="15" value="${esc(Dados.C.rondaMin)}"></label>
      <label class="f" for="cfgVagas">Vagas de visitantes no pátio (0 = sem controle)<input type="number" id="cfgVagas" min="0" max="999" value="${esc(Dados.C.vagasVisitantes)}"></label></div>
      <div class="btnrow"><button class="btn" id="ptNovo" type="button">+ Ponto de ronda</button><button class="btn primary" id="ptPdf" type="button" ${pts.length ? '' : 'disabled'}>Baixar QR Codes (PDF)</button></div>` : ''}`;
  if (!gerir) return;
  $('#cfgRonda').onchange = (e) => Dados.salvarConf({ rondaMin: Math.max(0, +e.target.value || 0) });
  $('#cfgVagas').onchange = (e) => Dados.salvarConf({ vagasVisitantes: Math.max(0, +e.target.value || 0) });
  $('#ptNovo').onclick = () => editPonto(null);
  $('#ptPdf').onclick = pdfQR;
  $$('[data-pt]', box).forEach((b) => (b.onclick = () => editPonto(b.dataset.pt)));
}
async function editPonto(id) {
  const p = id ? Dados.P.get(id) : null;
  openSheet(id ? 'Ponto de ronda' : 'Novo ponto de ronda', `<label class="f" for="ptNome">Nome do ponto *<input id="ptNome" value="${esc(p ? p.nome : '')}" placeholder="Ex.: Muro dos fundos — guarita 2"></label>
    <div class="grid2"><label class="f" for="ptOrdem">Ordem na ronda<input type="number" id="ptOrdem" value="${esc(p ? p.ordem || 0 : Dados.P.size + 1)}"></label>
    <label class="f" for="ptAtivo">Situação<select id="ptAtivo"><option value="1" ${!p || p.ativo !== false ? 'selected' : ''}>Ativo</option><option value="0" ${p && p.ativo === false ? 'selected' : ''}>Inativo</option></select></label></div>
    <button class="btn primary big" id="ptSave" type="button">Salvar</button>${id ? '<button class="btn bad" id="ptDel" type="button">Excluir ponto</button>' : ''}
    <p class="count">Ao trocar o nome, o QR Code continua valendo. Ao excluir e criar de novo, imprima o QR novo.</p>`);
  $('#ptSave').onclick = async () => {
    const nome = $('#ptNome').value.trim(); if (!nome) { toast('Informe o nome do ponto'); return; }
    await Dados.salvar('pontos', { ...(p || { criadoEm: Date.now() }), id: id || undefined, nome, ordem: +$('#ptOrdem').value || 0, ativo: $('#ptAtivo').value === '1', atualizadoEm: Date.now() });
    closeSheet(); toast('Ponto salvo');
  };
  if (id) $('#ptDel').onclick = async () => { if (!await ask({ title: 'Excluir ' + p.nome + '?', msg: 'O QR Code impresso deixa de valer.', ok: 'Excluir', danger: true })) return; await Dados.apagar('pontos', id); closeSheet(); };
}
async function pdfQR() {
  toast('Gerando QR Codes…', 6000);
  try { await loadScript(LIBS_QR.gerar); await loadScript(LIBS.jspdf); } catch (e) { toast(e.message, 4000); return; }
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const pts = pontosAtivos();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], pos = i % 4; if (i && !pos) doc.addPage();
    const x = 15 + (pos % 2) * 95, y = 15 + Math.floor(pos / 2) * 135;
    const q = window.qrcode(0, 'M'); q.addData(QR_PREFIXO + p.id); q.make();
    const im = await loadImg(q.createDataURL(8, 2)); const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(im, 0, 0);
    doc.setDrawColor(180); doc.roundedRect(x, y, 85, 125, 3, 3);
    doc.addImage(cv.toDataURL('image/png'), 'PNG', x + 10, y + 18, 65, 65);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('PORTÃO APMG — PONTO DE RONDA', x + 42.5, y + 10, { align: 'center' });
    doc.setFontSize(14); doc.text(doc.splitTextToSize(p.nome, 75), x + 42.5, y + 95, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Escaneie pelo app: Portão > Ronda', x + 42.5, y + 118, { align: 'center' });
  }
  doc.save('qr-rondas-portao-apmg.pdf'); $('#toast').hidden = true;
}

/* ---------- painel do comando ---------- */
function renderPainel() {
  const box = $('#painelBox'); if (!box) return;
  const hoje = diaMs(hojeISO()), now = Date.now(), ins = insideList();
  const regsHoje = Dados.R.filter((r) => r.ts >= hoje);
  const ultimo = [...Dados.R].filter((r) => r.sentinela).sort((a, b) => b.ts - a.ts)[0];
  const vtrFora = [...Dados.T.values()].filter((t) => t.fora).sort((a, b) => (a.foraDesde || 0) - (b.foraDesde || 0));
  const alertas = regsHoje.filter((r) => r.alerta || r.resultado === 'bloq');
  const at = atrasados(), rd = rondasAtrasadas(), ocs = regsHoje.filter((r) => r.kind === 'ocorrencia').sort((a, b) => b.ts - a.ts);
  const esp = agendadosHoje().filter((g) => !Dados.R.some((r) => r.agendadoId === g.id && r.tipo === 'entrada' && r.ts >= hoje) && agJanela(g) !== 'depois');
  const ultRonda = [...Dados.R].filter((r) => r.kind === 'ronda').sort((a, b) => b.ts - a.ts)[0];
  const sec = (t, html) => `<div class="painel-sec"><h3 class="sec">${t}</h3>${html}</div>`;
  const li = (arr, f, vazio) => (arr.length ? `<ul class="loglist">${arr.map(f).join('')}</ul>` : `<p class="empty">${vazio}</p>`);
  box.innerHTML = `
    <div class="setrow" style="gap:4px"><p>Sentinela de serviço</p><b style="font:600 22px/1.1 var(--display)">${esc(ultimo ? ultimo.sentinela : 'Não informado')}</b>
      <p>${ultimo ? 'Último registro às ' + fmtH(ultimo.ts) + ' (' + fmtDur(now - ultimo.ts) + ' atrás)' : 'Sem registros'}${naNuvem() ? ' · ' + (Dados.online ? 'sincronizado' : 'sem conexão') : ''}</p></div>
    <div class="stats">
      <div class="stat"><b>${ins.filter((r) => r.kind === 'veiculo').length}</b><span>Veículos no local</span></div>
      <div class="stat"><b>${ins.filter((r) => r.kind === 'pessoa').length}</b><span>Pedestres no local</span></div>
      <div class="stat ${vtrFora.length ? 'warn' : ''}"><b>${vtrFora.length}</b><span>Viaturas fora</span></div>
      <div class="stat ${alertas.length ? 'bad' : ''}"><b>${alertas.length}</b><span>Bloqueios e alertas hoje</span></div>
    </div>
    ${meterHTML()}
    ${sec('Alertas de hoje', li(alertas.sort((a, b) => b.ts - a.ts), (r) => logItem(r), 'Nenhum bloqueio ou consulta especial hoje.'))}
    ${sec('Permanência vencida', li(at, (x) => `<li class="litem late" data-k="${esc(x.r.chave || x.r.placa)}"><span class="t">${fmtH(x.r.ts)}</span><div class="who"><b>${esc(x.r.placa || x.r.prefixo || x.r.nome)}</b><small>${esc(x.r.nome || '')}</small></div><span class="pill warn">+${fmtDur(x.exc)}</span></li>`, 'Ninguém passou do tempo.'))}
    ${sec('Viaturas fora', li(vtrFora, (t) => `<li class="litem" data-vtr="${esc(t.id)}"><span class="t">${t.foraDesde ? fmtH(t.foraDesde) : '—'}</span><div class="who"><div class="vtop">${vtrBadge(t)}</div><b>${esc(t.motoristaAtual || '—')}</b><small>${esc([t.destinoAtual, 'há ' + (t.foraDesde ? fmtDur(now - t.foraDesde) : '—')].filter(Boolean).join(' · '))}</small></div><span></span></li>`, 'Todas as viaturas na unidade.'))}
    ${sec('Rondas', pontosAtivos().length ? `<p class="count">${ultRonda ? 'Última passagem: ' + esc(ultRonda.nome) + ' às ' + fmtH(ultRonda.ts) + (ultRonda.sentinela ? ' (' + esc(ultRonda.sentinela) + ')' : '') : 'Nenhuma ronda registrada.'}</p>
      ${rd.length ? `<p class="ronda-late"><b>${rd.length} ${rd.length === 1 ? 'ponto atrasado' : 'pontos atrasados'}:</b> ${esc(rd.map((x) => x.p.nome).join(', '))}</p>` : '<p class="ronda-ok">Rondas em dia.</p>'}` : '<p class="empty">Pontos de ronda não cadastrados.</p>')}
    ${sec('Ocorrências de hoje', li(ocs, (r) => logItem(r), 'Sem ocorrências hoje.'))}
    ${sec('Agendados que ainda não chegaram', li(esp, (g) => `<li class="litem"><span class="t">${esc(g.horaIni || '—')}</span><div class="who"><b>${esc(g.nome)}</b><small>${esc([g.placa, g.destino].filter(Boolean).join(' · '))}</small></div><span></span></li>`, 'Nenhum pendente.'))}`;
}
