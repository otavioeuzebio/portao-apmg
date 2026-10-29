/* Portão APMG — telas e regras do posto. */
"use strict";
let CFG = { modo: null, sentinela: '', pin: '', theme: '', som: true, auto: false, seeded: false, seededVtr: false, limVisit: 4, limGeral: 12, limRapido: 30, deviceId: '' };
let unlocked = false, cur = 'portao', modoPortao = 'veiculo', cadSub = 'veiculos', cadFilter = 'todos', livroFiltro = 'todos', pesFoto = null;
async function saveCfg() { try { await Dados.cfgSet(CFG); } catch (e) { /* sem armazenamento */ } }

/* ---------- permissões ---------- */
const naNuvem = () => Dados.modo === 'nuvem';
const podeGerir = () => !naNuvem() || ['admin', 'gestor'].includes(Dados.papel);
async function needPin() {
  if (!CFG.pin || unlocked) return true;
  const v = await ask({ title: 'PIN do administrador', msg: 'Digite o PIN para alterar o cadastro.', ok: 'Entrar', input: { type: 'password', mode: 'numeric', ph: 'PIN' } });
  if (v === null) return false;
  if (v === CFG.pin) { unlocked = true; return true; }
  toast('PIN incorreto'); return false;
}
async function needGestor() {
  if (naNuvem()) { if (podeGerir()) return true; toast('Só gestores alteram o cadastro. Peça ao administrador para mudar seu papel.', 4500); return false; }
  return needPin();
}
const ehAdminNuvem = () => naNuvem() && Dados.papel === 'admin';

/* ---------- consultas ---------- */
const findVehicle = (p) => Dados.V.get(p) || Dados.V.get(altPlate(p)) || null;
function alertaDe(p) {
  const a = Dados.A.get(p) || Dados.A.get(altPlate(p));
  if (!a || a.ativo === false) return null;
  if (a.validade && a.validade < hojeISO()) return null;
  return a;
}
function statusOf(v) { if (!v) return 'nao'; if (v.status === 'bloqueado') return 'bloq'; if (v.validade && v.validade < hojeISO()) return 'venc'; return 'ok'; }
/** Situação do agendamento agora: null (não é hoje), 'antes', 'agora', 'depois'. */
const DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function agJanela(g, now = Date.now()) {
  const hoje = isoOf(new Date(now)), ini = g.data, fim = g.dataFim || g.data;
  if (!ini || hoje < ini || hoje > fim) return null;
  // visitante frequente: só nos dias da semana marcados
  if (g.recorrente && (g.dias || []).length && !g.dias.includes(new Date(now).getDay())) return null;
  const d = new Date(now), min = d.getHours() * 60 + d.getMinutes(), hi = horaMin(g.horaIni), hf = horaMin(g.horaFim);
  if (hi != null && min < hi - 30) return 'antes';
  if (hf != null && min > hf) return 'depois';
  return 'agora';
}
const agendadosHoje = () => [...Dados.G.values()].filter((g) => agJanela(g) !== null).sort((a, b) => (horaMin(a.horaIni) ?? 0) - (horaMin(b.horaIni) ?? 0));
function agendadoVeiculo(p) { const alt = altPlate(p); return agendadosHoje().find((g) => g.placa && (g.placa === p || g.placa === alt)) || null; }
function agendadoPessoa(doc, nome) { const d = normDoc(doc), n = norm(nome); return agendadosHoje().find((g) => (d && normDoc(g.documento) === d) || (n && norm(g.nome) === n)) || null; }
window.placaConhecida = (p) => !!(findVehicle(p) || alertaDe(p) || agendadoVeiculo(p) || viaturaPorPlaca(p));
function avaliar(p) {
  const v = findVehicle(p), al = alertaDe(p), ag = v ? null : agendadoVeiculo(p), key = v ? v.placa : p;
  let st = 'nao';
  if (v) st = statusOf(v); else if (ag) st = agJanela(ag) === 'agora' ? 'agend' : 'agendfora';
  return { v, al, ag, st, key };
}
const ST = { vtrext: ['info', 'VTR externa'], oc: ['warn', 'Ocorrência'], ronda: ['ok', 'Ronda'], ok: ['ok', 'Autorizado'], bloq: ['bad', 'Bloqueado'], venc: ['warn', 'Vencido'], nao: ['warn', 'Não cadastrado'], agend: ['info', 'Agendado'], agendfora: ['warn', 'Fora do horário'], pessoa: ['info', 'Pedestre'],
  app: ['info', 'Uber / app'], entrega: ['info', 'Entrega'], vtr: ['ok', 'Viatura'] };
const visitante = (r) => r.kind === 'pessoa' || ['nao', 'agend', 'agendfora', 'app', 'entrega'].includes(r.resultado);
const quem = (r) => (r.prefixo ? 'VTR ' + r.prefixo : r.placa || r.nome || '');
const rapido = (r) => ['app', 'entrega'].includes(r.resultado);
function similar(p) { const out = []; for (const k of Dados.V.keys()) if (plateDist(k, p) === 1) out.push(Dados.V.get(k)); return out.slice(0, 3); }

/* ---------- livro ---------- */
function insideList() {
  const last = new Map();
  for (const r of Dados.R) { if (r.kind === 'viatura' || r.kind === 'ocorrencia' || r.kind === 'ronda') continue; const k = r.chave || r.placa; const p = last.get(k); if (!p || r.ts > p.ts) last.set(k, r); }
  return [...last.values()].filter((r) => r.tipo === 'entrada').sort((a, b) => b.ts - a.ts);
}
const isInside = (k) => insideList().some((r) => (r.chave || r.placa) === k);
async function garantirSentinela() {
  if (!Dados.geral || CFG.sentinela) return true;
  const n = await ask({ title: 'Quem está de serviço?', msg: 'Este celular usa a conta geral da guarda. Informe o sentinela para constar nos registros.', ok: 'Salvar', input: { ph: 'Ex.: Cad. Euzebio — 1051' } });
  if (!n || !n.trim()) { toast('Informe o sentinela para registrar.'); return false; }
  CFG.sentinela = n.trim(); CFG.sentinelaEm = Date.now(); await saveCfg(); renderHeader(); return true;
}
async function registrar(rec) {
  if (Dados.papel === 'comando') { toast('Seu acesso é só de consulta (comando).'); throw new Error('somente leitura'); }
  if (!await garantirSentinela()) throw new Error('sem sentinela');
  if (!await confirmaVaga(rec)) throw new Error('pátio lotado');
  rec = { ...rec, ts: Date.now(), sentinela: CFG.sentinela || '' };
  await Dados.addRegistro(rec);
  const quem = rec.prefixo ? 'VTR ' + rec.prefixo : rec.placa || rec.nome;
  toast(rec.kind === 'ocorrencia' ? 'Ocorrência registrada às ' + fmtH(rec.ts) : rec.kind === 'ronda' ? 'Ronda: ' + rec.nome + ' às ' + fmtH(rec.ts)
    : (rec.kind === 'viatura' ? (rec.tipo === 'entrada' ? 'Retorno' : 'Saída') : rec.tipo === 'entrada' ? 'Entrada' : 'Saída') + ' de ' + quem + ' registrada às ' + fmtH(rec.ts));
}
async function regVeiculo(placa, tipo, extra = {}) {
  const av = avaliar(placa), v = av.v, ag = av.ag;
  await registrar({
    kind: 'veiculo', chave: av.key, placa: av.key, tipo, resultado: av.st, alerta: !!av.al,
    nome: v ? v.nome || '' : ag ? ag.nome || '' : extra.nome || '',
    veiculo: v ? [v.marca, v.modelo, v.cor].filter(Boolean).join(' ') : ag ? [ag.veiculo, ag.cor].filter(Boolean).join(' ') : '',
    agendadoId: ag ? ag.id : undefined, destino: ag ? ag.destino : undefined, obs: extra.obs || '', origem: extra.origem || '',
  });
}
/** Quem passou do tempo de permanência. */
function atrasados(now = Date.now()) {
  return insideList().map((r) => {
    let lim = null, mot = '';
    const ag = r.agendadoId && Dados.G.get(r.agendadoId);
    if (ag && ag.horaFim) { lim = diaMs(ag.dataFim || ag.data) + (horaMin(ag.horaFim) + 30) * 6e4; mot = 'agendado até ' + ag.horaFim; }
    else if (rapido(r) && +CFG.limRapido > 0) { lim = r.ts + CFG.limRapido * 6e4; mot = 'limite de Uber/entrega (' + CFG.limRapido + ' min)'; }
    else if (visitante(r) && +CFG.limVisit > 0) { lim = r.ts + CFG.limVisit * 36e5; mot = 'limite de visitante (' + CFG.limVisit + ' h)'; }
    else if (+CFG.limGeral > 0) { lim = r.ts + CFG.limGeral * 36e5; mot = 'limite geral (' + CFG.limGeral + ' h)'; }
    return lim && now > lim ? { r, exc: now - lim, mot } : null;
  }).filter(Boolean);
}
const avisados = new Set(); let permPronto = false;
function checarPermanencia() {
  const at = atrasados(); const ids = new Set(at.map((x) => String(x.r.id)));
  const novos = at.filter((x) => !avisados.has(String(x.r.id)));
  novos.forEach((x) => avisados.add(String(x.r.id)));
  [...avisados].forEach((id) => { if (!ids.has(id)) avisados.delete(id); });
  // ao abrir o app, quem já estava atrasado aparece na faixa sem tocar alarme
  const silencioso = !permPronto; if (Dados.prontoR) permPronto = true;
  if (novos.length && Dados.prontoR && !silencioso) { alertFx('warn', CFG.som); toast(novos.length === 1 ? `Permanência vencida: ${novos[0].r.placa || novos[0].r.nome}` : `${novos.length} permanências vencidas`, 5000); }
  const b = $('#permBanner'); b.hidden = !at.length;
  b.innerHTML = at.length ? `<span>${at.length === 1 ? '1 permanência vencida' : at.length + ' permanências vencidas'} — ${esc(at.slice(0, 2).map((x) => x.r.placa || x.r.nome).join(', '))}${at.length > 2 ? '…' : ''}</span><span>Ver</span>` : '';
  const d = $('#livroDot'); d.hidden = !at.length; d.textContent = at.length;
  return at;
}

/* ---------- RESULTADO DA CONSULTA DE PLACA ---------- */
window.onPlacaLida = (p, recorte, origem) => { const vt = viaturaPorPlaca(p); if (vt && !alertaDe(p)) abrirViatura(vt.id, recorte); else showResult(p, origem, recorte); };
function showResult(raw, origem = 'manual', recorte = null) {
  const p = normPlate(raw); if (!validPlate(p)) { toast('Placa inválida. Use o formato ABC1D23 ou ABC1234.'); return; }
  const { v, al, ag, st, key } = avaliar(p), dentro = isInside(key);
  let cls = ST[st][0];
  const head = { ok: 'Acesso autorizado', bloq: 'Bloqueado — não liberar', venc: 'Cadastro vencido', nao: 'Não cadastrado', agend: 'Visita agendada', agendfora: 'Agendado — fora do horário' }[st];
  const sub = {
    ok: dentro ? 'Veículo consta como dentro da unidade.' : 'Veículo cadastrado.',
    bloq: 'Retenha o veículo e comunique o Oficial de Dia.',
    venc: 'Validade expirou em ' + fmtD(v && v.validade) + '. Confirme com o Oficial de Dia.',
    nao: 'Identifique o condutor antes de liberar.',
    agend: ag ? `Autorizado ${ag.horaIni ? 'das ' + ag.horaIni : ''}${ag.horaFim ? ' às ' + ag.horaFim : ''}${ag.autorizadoPor ? ' por ' + ag.autorizadoPor : ''}.` : '',
    agendfora: ag ? `O agendamento é ${ag.horaIni ? 'das ' + ag.horaIni : ''}${ag.horaFim ? ' às ' + ag.horaFim : ''}. Confirme com o Oficial de Dia.` : '',
  }[st];
  const alt = v && v.placa !== p ? `<p>Lida como ${esc(p)} (mesma placa no padrão ${/\d/.test(p[4]) ? 'antigo' : 'Mercosul'})</p>` : '';
  let html = '';
  if (al) {
    // alerta discreto: sem som, sem vermelho; a tela não denuncia o alerta para o condutor
    cls = 'disc';
    html += `<div class="verdict disc">${plateHTML(key, 'xl')}<h3>Consulta especial</h3><p>Mantenha a postura normal. Leia as instruções abaixo.</p></div>
      <div class="discbox"><b>Veículo na lista de alerta</b><p><strong>Motivo:</strong> ${esc(al.motivo || '—')}</p>
      ${al.fonte ? `<p><strong>Origem:</strong> ${esc(al.fonte)}</p>` : ''}${al.veiculo || al.cor ? `<p><strong>Descrição:</strong> ${esc([al.veiculo, al.cor].filter(Boolean).join(' '))}</p>` : ''}${al.obs ? `<p>${esc(al.obs)}</p>` : ''}
      <p><strong>Procedimento:</strong> não aborde sozinho e não demonstre reação. Retarde a liberação com naturalidade e acione o Oficial de Dia.</p></div>`;
    if (st !== 'ok') html += `<p class="count">Situação no cadastro: ${esc(ST[st][1])}</p>`;
  } else html += `<div class="verdict ${cls}">${plateHTML(key, 'xl')}<h3>${head}</h3><p>${esc(sub)}</p>${alt}</div>`;
  if (recorte) html += `<div class="crop"><img src="${recorte}" alt="Recorte da placa lida"><span>Imagem lida pela câmera. Confira com a placa do veículo.</span></div>`;
  if (v) {
    html += `<div class="person"><img src="${avatar(v)}" alt="Foto de ${esc(v.nome || 'responsável')}">
      <div style="min-width:0"><div class="rank">${esc([v.postoGrad, v.vinculo].filter(Boolean).join(' · '))}</div><h4>${esc(v.nome || 'Sem nome')}</h4>
      <dl class="kv"><dt>Veículo</dt><dd>${esc([v.marca, v.modelo].filter(Boolean).join(' ') || '—')}</dd><dt>Cor</dt><dd>${esc(v.cor || '—')}</dd>
      ${v.setor ? `<dt>Setor</dt><dd>${esc(v.setor)}</dd>` : ''}${v.telefone ? `<dt>Telefone</dt><dd>${esc(v.telefone)}</dd>` : ''}
      ${v.validade ? `<dt>Validade</dt><dd>${fmtD(v.validade)}</dd>` : ''}${v.obs ? `<dt>Obs.</dt><dd>${esc(v.obs)}</dd>` : ''}</dl></div></div>`;
  } else if (ag) {
    html += `<div class="person"><img src="${avatar(ag)}" alt=""><div style="min-width:0"><div class="rank">Agendado${ag.autorizadoPor ? ' · autorizado por ' + esc(ag.autorizadoPor) : ''}</div><h4>${esc(ag.nome || 'Sem nome')}</h4>
      <dl class="kv">${ag.documento ? `<dt>Documento</dt><dd>${esc(ag.documento)}</dd>` : ''}<dt>Veículo</dt><dd>${esc([ag.veiculo, ag.cor].filter(Boolean).join(' ') || '—')}</dd>
      ${ag.destino ? `<dt>Destino</dt><dd>${esc(ag.destino)}</dd>` : ''}<dt>Horário</dt><dd>${esc([ag.horaIni, ag.horaFim].filter(Boolean).join(' às ') || 'dia todo')}</dd>${ag.obs ? `<dt>Obs.</dt><dd>${esc(ag.obs)}</dd>` : ''}</dl></div></div>`;
  } else {
    const sim = similar(p);
    if (sim.length) html += `<div class="suggest"><h3 class="sec">A leitura pode ter errado um caractere. Seria algum destes?</h3>${sim.map((s) => `<button class="vitem" type="button" data-sim="${esc(s.placa)}"><img src="${avatar(s)}" alt=""><div class="vinfo"><div class="vtop">${plateHTML(s.placa, 'sm')}</div><b>${esc(s.nome || '')}</b><small>${esc([s.marca, s.modelo, s.cor].filter(Boolean).join(' '))}</small></div></button>`).join('')}</div>`;
    html += `<div class="setrow" id="visForm" hidden><h3>Visitante rápido</h3><p>Fica cadastrado até o fim de hoje.</p>
      <div class="grid2"><label class="f" for="visNome">Nome do condutor *<input id="visNome"></label><label class="f" for="visDoc">Documento<input id="visDoc"></label></div>
      <div class="grid2"><label class="f" for="visVeic">Marca e modelo<input id="visVeic" placeholder="Ex.: Fiat Argo"></label><label class="f" for="visCor">Cor<input id="visCor"></label></div>
      <label class="f" for="visDest">Destino / motivo<input id="visDest" placeholder="Ex.: Seção de Ensino — entrega"></label>
      <button class="btn ok big" id="visSave" type="button">Registrar entrada do visitante</button></div>`;
  }
  html += `<label class="f" for="resObs">Observação do registro (opcional)<input id="resObs" placeholder="Ex.: com 2 passageiros, autorizado pelo Of. de Dia"></label>`;
  const first = dentro ? 'saida' : 'entrada';
  const corMain = al ? 'primary' : st === 'bloq' ? 'bad' : first === 'entrada' && (st === 'ok' || st === 'agend') ? 'ok' : 'primary';
  html += `<div class="btnrow"><button class="btn big ${corMain}" id="resMain" type="button">Registrar ${first === 'entrada' ? 'entrada' : 'saída'}</button>
    <button class="btn" id="resOther" type="button">Registrar ${first === 'entrada' ? 'saída' : 'entrada'}</button></div>
    <div class="btnrow">${v ? `<button class="btn" id="resEdit" type="button">Editar cadastro</button>` : `${ag ? '' : `<button class="btn primary" id="resVis" type="button">Visitante rápido</button><button class="btn" id="resApp" type="button">Uber / app</button><button class="btn" id="resEnt" type="button">Entrega</button>`}<button class="btn" id="resCad" type="button">Cadastrar veículo</button>`}<button class="btn ghost" id="resHist" type="button">Histórico desta placa</button></div>`;
  openSheet('Consulta de placa', html);
  alertFx(cls === 'disc' ? 'disc' : cls === 'info' ? 'ok' : cls, CFG.som);
  const obs = () => $('#resObs').value.trim();
  $('#resMain').onclick = async () => { await regVeiculo(key, first, { obs: obs(), origem }); closeSheet(); };
  $('#resOther').onclick = async () => { await regVeiculo(key, first === 'entrada' ? 'saida' : 'entrada', { obs: obs(), origem }); closeSheet(); };
  $('#resHist').onclick = () => showHistory(key);
  if (v) $('#resEdit').onclick = async () => { if (await needGestor()) editVehicle(v.placa); };
  else {
    $('#resCad').onclick = async () => { if (await needGestor()) editVehicle(null, { placa: key }); };
    const rv = $('#resVis'); if (rv) rv.onclick = () => { $('#visForm').hidden = false; $('#visNome').focus(); };
    const ra = $('#resApp'); if (ra) ra.onclick = () => { closeSheet(); abrirRapido('app', { placa: key }); };
    const re = $('#resEnt'); if (re) re.onclick = () => { closeSheet(); abrirRapido('entrega', { placa: key }); };
    const vs = $('#visSave');
    if (vs) vs.onclick = async () => {
      const nome = $('#visNome').value.trim(); if (!nome) { toast('Informe o nome do condutor'); return; }
      const mm = $('#visVeic').value.trim().split(/\s+/);
      const nv = { placa: key, nome, vinculo: 'Visitante', marca: mm[0] || '', modelo: mm.slice(1).join(' '), cor: $('#visCor').value.trim(), setor: $('#visDest').value.trim(),
        obs: $('#visDoc').value.trim() ? 'Documento: ' + $('#visDoc').value.trim() : '', validade: hojeISO(), status: 'ativo', criadoEm: Date.now() };
      await Dados.salvar('veiculos', nv);
      await regVeiculo(key, 'entrada', { obs: [$('#visDest').value.trim(), obs()].filter(Boolean).join(' — '), origem });
      closeSheet();
    };
    $$('[data-sim]').forEach((b) => (b.onclick = () => { closeSheet(); showResult(b.dataset.sim, origem); }));
  }
  if (CFG.auto && !al && st === 'ok' && first === 'entrada' && origem === 'camera') {
    regVeiculo(key, 'entrada', { origem: 'camera (automático)' }).then(() => { const b = $('#resMain'); if (b) { b.textContent = 'Entrada registrada ✓'; b.disabled = true; } });
  }
}
async function showHistory(chave) {
  const rows = (await Dados.registrosPeriodo(0, Date.now() + 864e5)).filter((r) => (r.chave || r.placa) === chave).sort((a, b) => b.ts - a.ts).slice(0, 80);
  openSheet('Histórico — ' + (chave.startsWith('P:') ? (rows[0] && rows[0].nome) || 'pedestre' : chave.startsWith('VTR:') ? (rows[0] && rows[0].prefixo ? 'VTR ' + rows[0].prefixo : chave.slice(4)) : chave), rows.length ? `<ul class="loglist">${rows.map((r) => logItem(r, true)).join('')}</ul>` : '<p class="empty">Nenhum registro.</p>');
}

/* ---------- PEDESTRES ---------- */
function ultimaPessoa(doc) {
  const d = normDoc(doc); if (d.length < 4) return null;
  return [...Dados.R].filter((r) => r.kind === 'pessoa' && normDoc(r.documento) === d).sort((a, b) => b.ts - a.ts)[0] || null;
}
function pesHint() {
  const doc = $('#pesDoc').value, nome = $('#pesNome').value, h = $('#pesHint');
  const ag = agendadoPessoa(doc, nome); const ult = ultimaPessoa(doc);
  if (ult && !$('#pesNome').value) $('#pesNome').value = ult.nome || '';
  const t = [];
  if (ag) t.push(`Agendado: ${ag.nome}${ag.destino ? ' — ' + ag.destino : ''} (${[ag.horaIni, ag.horaFim].filter(Boolean).join(' às ') || 'dia todo'}${agJanela(ag) !== 'agora' ? ', fora do horário' : ''})`);
  if (ult) t.push(`Última visita: ${fmtDT(ult.ts)}${ult.destino ? ' — ' + ult.destino : ''}`);
  h.hidden = !t.length; h.textContent = t.join(' · ');
  if (ag && !$('#pesDest').value) $('#pesDest').value = ag.destino || '';
}
async function pessoaEntrada(e) {
  e.preventDefault();
  const nome = $('#pesNome').value.trim(), doc = $('#pesDoc').value.trim();
  if (!nome) { toast('Informe o nome do pedestre'); $('#pesNome').focus(); return; }
  const chave = 'P:' + (normDoc(doc) || norm(nome));
  if (isInside(chave)) { toast('Esta pessoa já consta dentro da unidade. Registre a saída antes.', 4000); return; }
  const ag = agendadoPessoa(doc, nome); const jan = ag ? agJanela(ag) : null;
  await registrar({ kind: 'pessoa', chave, tipo: 'entrada', resultado: ag ? (jan === 'agora' ? 'agend' : 'agendfora') : 'pessoa', nome, documento: doc,
    destino: $('#pesDest').value.trim(), obs: $('#pesObs').value.trim(), foto: pesFoto || undefined, agendadoId: ag ? ag.id : undefined, origem: 'pedestre' });
  if (ag && jan !== 'agora') alertFx('warn', CFG.som);
  $('#pesForm').reset(); pesFoto = null; $('#pesFotoImg').hidden = true; $('#pesHint').hidden = true;
}
const pedTag = (r) => `<span class="ped">${r.resultado === 'entrega' ? 'ENTREGA' + (r.empresa ? ' · ' + esc(r.empresa).toUpperCase() : '') : 'PEDESTRE'}</span>`;
function pessoaItem(r) {
  return `<li class="litem" data-reg="${esc(r.id)}"><span class="t">${fmtH(r.ts)}</span><div class="who"><div class="vtop">${pedTag(r)}</div><b>${esc(r.nome)}</b><small>${esc([r.documento, r.destino].filter(Boolean).join(' · '))}</small></div><button class="btn sm" type="button" data-out="${esc(r.chave)}">Saída</button></li>`;
}
async function saidaDe(chave) {
  const r = insideList().find((x) => (x.chave || x.placa) === chave); if (!r) return;
  await registrar({ kind: r.kind || 'veiculo', chave, placa: r.placa, nome: r.nome, documento: r.documento, veiculo: r.veiculo, tipo: 'saida', resultado: r.resultado, alerta: !!r.alerta, agendadoId: r.agendadoId, origem: 'lista no local' });
}

/* ---------- tela PORTÃO ---------- */
function renderPortao() {
  $$('#portaoSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === modoPortao));
  $('#modoVeiculo').hidden = modoPortao !== 'veiculo'; $('#modoPessoa').hidden = modoPortao !== 'pessoa'; $('#modoViatura').hidden = modoPortao !== 'viatura';
  $('#vagasBox').innerHTML = meterHTML();
  if (modoPortao === 'viatura') renderViaturasPortao();
  const ins = insideList().filter((r) => r.kind === 'pessoa');
  $('#pesInside').innerHTML = ins.length ? ins.map(pessoaItem).join('') : '<li class="empty">Nenhum pedestre dentro da unidade.</li>';
  const esp = agendadosHoje(); $('#espTit').hidden = !esp.length; $('#esperados').hidden = !esp.length;
  $('#esperados').innerHTML = esp.map((g) => {
    const regs = Dados.R.filter((r) => r.agendadoId === g.id && r.ts >= diaMs(hojeISO()));
    const ent = regs.some((r) => r.tipo === 'entrada'), dentro = insideList().some((r) => r.agendadoId === g.id);
    const jan = agJanela(g);
    const pill = dentro ? '<span class="pill ok">No local</span>' : ent ? '<span class="pill mut">Saiu</span>' : jan === 'agora' ? '<span class="pill info">Aguardando</span>' : jan === 'antes' ? '<span class="pill mut">Mais tarde</span>' : '<span class="pill warn">Não veio</span>';
    return `<li class="litem" data-ag="${esc(g.id)}"><span class="t">${esc(g.horaIni || '—')}</span><div class="who"><div class="vtop">${g.placa ? plateHTML(g.placa, 'sm') : '<span class="ped">PEDESTRE</span>'}</div><b>${esc(g.nome || 'Sem nome')}</b><small>${esc([g.destino, g.horaFim ? 'até ' + g.horaFim : ''].filter(Boolean).join(' · '))}</small></div>${pill}</li>`;
  }).join('');
  const r = [...Dados.R].sort((a, b) => b.ts - a.ts).slice(0, 5);
  $('#recent').innerHTML = r.length ? r.map((x) => logItem(x, true)).join('') : '<li class="empty">Nenhum registro ainda. Consulte uma placa para começar.</li>';
}
$('#portaoSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; modoPortao = b.dataset.m; if (modoPortao !== 'veiculo' && Cam.stream) Cam.stop(); renderPortao(); };
$('#btnApp').onclick = () => abrirRapido('app');
$('#btnVtrExt').onclick = () => abrirVtrExterna();
$('#btnRonda').onclick = () => abrirRonda();
$('#btnOcorr').onclick = () => abrirOcorrencia();
$('#btnPainel').onclick = () => go('painel');
$('#rondaBanner').onclick = () => abrirRonda();
$('#btnEnt').onclick = () => abrirRapido('entrega');
$('#vtrBusca').onsubmit = (e) => {
  e.preventDefault(); const q = $('#vtrIn').value.trim(); if (!q) return;
  const t = viaturaPorTexto(q);
  if (t) { $('#vtrIn').value = ''; $('#vtrIn').blur(); abrirViatura(t.id); }
  else { $('#vtrIn').value = ''; consultarTexto(q); } // prefixo de outra unidade: registra pelo prefixo
};
$('#btnCam').onclick = () => Cam.start();
$('#btnStop').onclick = () => Cam.stop();
$('#btnTorch').onclick = () => Cam.setTorch();
$('#zoomIn').oninput = (e) => Cam.setZoom(e.target.value);
$('#camStatus').onclick = () => Cam.tocarStatus();
$('#photoIn').onchange = (e) => { Cam.lerFoto(e.target.files[0]); e.target.value = ''; };
$('#manualForm').onsubmit = (e) => { e.preventDefault(); const v = $('#manualIn').value.trim(); if (!v) return; $('#manualIn').value = ''; $('#manualIn').blur(); consultarTexto(v); };
$('#manualIn').oninput = (e) => { const c = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(c, c); } catch (_) { /* campo sem cursor */ } };
$('#pesForm').onsubmit = pessoaEntrada;
$('#pesDoc').onchange = pesHint; $('#pesNome').onchange = pesHint;
$('#pesFoto').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; pesFoto = await resizeImg(await fileToDataURL(f), 280, .75); const i = $('#pesFotoImg'); i.src = pesFoto || ''; i.hidden = !pesFoto; };
$('#v-portao').addEventListener('click', async (e) => {
  const out = e.target.closest('[data-out]'); if (out) { e.stopPropagation(); await saidaDe(out.dataset.out); return; }
  const vt = e.target.closest('[data-vtr]'); if (vt) { abrirViatura(vt.dataset.vtr); return; }
  const ag = e.target.closest('[data-ag]');
  if (ag) {
    const g = Dados.G.get(ag.dataset.ag); if (!g) return;
    if (g.placa) showResult(g.placa, 'agendado');
    else { modoPortao = 'pessoa'; renderPortao(); $('#pesNome').value = g.nome || ''; $('#pesDoc').value = g.documento || ''; $('#pesDest').value = g.destino || ''; pesHint(); $('#pesForm').scrollIntoView({ behavior: 'smooth' }); }
    return;
  }
  const li = e.target.closest('.litem[data-k]'); if (li) abrirRegistro(li.dataset.k);
});
$('#permBanner').onclick = () => go('livro');
$('#hdrSent').onclick = async () => {
  const n = await ask({ title: 'Sentinela de serviço', msg: 'Nome que aparece nos registros deste celular.', ok: 'Salvar', input: { ph: 'Ex.: Cad. Euzebio — 1051' } });
  if (n === null) return; CFG.sentinela = n.trim(); CFG.sentinelaEm = Date.now(); await saveCfg(); renderHeader(); toast(CFG.sentinela ? 'Sentinela: ' + CFG.sentinela : 'Sentinela apagado');
};

/* ---------- CADASTRO ---------- */
function irCadastro(sub) { cadSub = sub; cadFilter = 'todos'; go('cadastro'); }
const CAD_FILTROS = {
  veiculos: [['todos', 'Todos'], ['ok', 'Ativos'], ['bloq', 'Bloqueados'], ['venc', 'Vencidos'], ['visit', 'Visitantes'], ['semfoto', 'Sem foto']],
  viaturas: [['todos', 'Todas'], ['fora', 'Fora'], ['dentro', 'Na unidade'], ['baixadas', 'Baixadas']],
  agendados: [['todos', 'Próximos'], ['hoje', 'Hoje'], ['freq', 'Frequentes'], ['antigos', 'Encerrados']],
  alertas: [['todos', 'Ativos'], ['inativos', 'Vencidos / inativos']],
};
function renderCadastro() {
  $$('#cadSeg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === cadSub));
  $('#cadFilter').innerHTML = CAD_FILTROS[cadSub].map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === cadFilter}">${l}</button>`).join('');
  $('#cadSearch').placeholder = { veiculos: 'Buscar placa, nome ou modelo', viaturas: 'Buscar prefixo, placa ou modelo', agendados: 'Buscar nome, placa ou destino', alertas: 'Buscar placa ou motivo' }[cadSub];
  $('#btnNovo').hidden = !podeGerir() && cadSub !== 'veiculos';
  $('#btnImportar').hidden = !podeGerir();
  const q = norm($('#cadSearch').value), qp = normPlate($('#cadSearch').value), hoje = hojeISO();
  const note = $('#cadNote'); note.hidden = true;
  let html = '', total = 0, n = 0;
  if (cadSub === 'veiculos') {
    let arr = [...Dados.V.values()]; total = arr.length;
    arr = arr.filter((v) => {
      const st = statusOf(v);
      if (cadFilter === 'ok' && st !== 'ok') return false; if (cadFilter === 'bloq' && st !== 'bloq') return false; if (cadFilter === 'venc' && st !== 'venc') return false;
      if (cadFilter === 'visit' && v.vinculo !== 'Visitante') return false; if (cadFilter === 'semfoto' && v.foto) return false;
      return !q || norm([v.placa, v.nome, v.postoGrad, v.marca, v.modelo, v.cor, v.setor, v.vinculo].join(' ')).includes(q) || (qp && v.placa.includes(qp));
    }).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    n = arr.length;
    if ([Dados.V, Dados.T, Dados.G, Dados.A, Dados.P].some((m) => [...m.values()].some((v) => v.exemplo))) { note.hidden = false; note.innerHTML = 'Há <b>cadastros de exemplo</b> para você testar. <button class="btn sm" id="btnDelEx" type="button">Apagar exemplos</button>'; }
    html = arr.map((v) => { const [c, l] = ST[statusOf(v)]; return `<li class="vitem" data-p="${esc(v.placa)}" tabindex="0"><img src="${avatar(v)}" alt="" loading="lazy"><div class="vinfo"><div class="vtop">${plateHTML(v.placa, 'sm')}<span class="pill ${c}">${l}</span>${alertaDe(v.placa) ? '<span class="pill disc">Alerta</span>' : ''}${v.exemplo ? '<span class="pill mut">Exemplo</span>' : ''}</div><b>${esc((v.postoGrad ? v.postoGrad + ' ' : '') + (v.nome || 'Sem nome'))}</b><small>${esc([v.vinculo, [v.marca, v.modelo].filter(Boolean).join(' '), v.cor].filter(Boolean).join(' · '))}</small></div></li>`; }).join('');
  } else if (cadSub === 'viaturas') {
    let arr = [...Dados.T.values()]; total = arr.length;
    arr = arr.filter((t) => {
      if (cadFilter === 'todos' && t.ativo === false) return false; if (cadFilter === 'fora' && !t.fora) return false;
      if (cadFilter === 'dentro' && (t.fora || t.ativo === false)) return false; if (cadFilter === 'baixadas' && t.ativo !== false) return false;
      return !q || norm([t.prefixo, t.placa, t.marca, t.modelo, t.tipo, t.motoristaAtual].join(' ')).includes(q) || (qp && normDoc(t.prefixo + t.placa).includes(qp));
    }).sort((a, b) => vtrNome(a).localeCompare(vtrNome(b), 'pt-BR', { numeric: true }));
    n = arr.length;
    if (!total) { note.hidden = false; note.innerHTML = 'Cadastre as viaturas da APMG pelo <b>prefixo</b>, pela <b>placa</b> ou pelos dois. Na saída e no retorno, o app exige motorista e KM.'; }
    html = arr.map((t) => `<li class="vitem" data-t="${esc(t.id)}" tabindex="0"><div class="vinfo"><div class="vtop">${vtrBadge(t)}${t.placa ? plateHTML(t.placa, 'sm') : ''}${t.ativo === false ? '<span class="pill mut">Baixada</span>' : t.fora ? '<span class="pill info">Fora</span>' : '<span class="pill ok">Na unidade</span>'}${t.exemplo ? '<span class="pill mut">Exemplo</span>' : ''}</div>
      <b>${esc([t.tipo, t.marca, t.modelo].filter(Boolean).join(' ') || 'Viatura')}</b><small>${esc(['KM ' + fmtKm(t.kmAtual), t.fora ? 'com ' + (t.motoristaAtual || '—') : '', t.cor].filter(Boolean).join(' · '))}</small></div></li>`).join('');
  } else if (cadSub === 'agendados') {
    let arr = [...Dados.G.values()]; total = arr.length;
    arr = arr.filter((g) => {
      const fim = g.dataFim || g.data;
      if (cadFilter === 'todos' && fim < hoje) return false; if (cadFilter === 'hoje' && agJanela(g) === null) return false; if (cadFilter === 'freq' && (!g.recorrente || fim < hoje)) return false; if (cadFilter === 'antigos' && fim >= hoje) return false;
      return !q || norm([g.nome, g.documento, g.placa, g.destino, g.autorizadoPor, g.veiculo].join(' ')).includes(q) || (qp && (g.placa || '').includes(qp));
    }).sort((a, b) => (cadFilter === 'antigos' ? -1 : 1) * ((a.data + (a.horaIni || '')).localeCompare(b.data + (b.horaIni || ''))));
    n = arr.length;
    if (!total) { note.hidden = false; note.innerHTML = 'Cadastre aqui visitas, prestadores e entregas com dia e horário. Eles aparecem em <b>Esperados hoje</b> e são reconhecidos na leitura da placa ou na entrada de pedestre.'; }
    html = arr.map((g) => {
      const jan = agJanela(g), fim = g.dataFim || g.data;
      const pill = (g.recorrente && fim >= hoje ? `<span class="pill ok">Frequente · ${esc((g.dias || []).map((d) => DIAS_SEM[d]).join(' ') || 'todo dia')}</span>` : '')
        + (jan ? '<span class="pill info">Hoje</span>' : fim < hoje ? '<span class="pill mut">Encerrado</span>' : g.recorrente ? '' : '<span class="pill ok">Agendado</span>');
      return `<li class="vitem" data-g="${esc(g.id)}" tabindex="0"><div class="vinfo"><div class="vtop">${g.placa ? plateHTML(g.placa, 'sm') : '<span class="ped">PEDESTRE</span>'}${pill}</div><b>${esc(g.nome || 'Sem nome')}</b><small>${esc([fmtD(g.data) + (g.dataFim ? ' a ' + fmtD(g.dataFim) : ''), [g.horaIni, g.horaFim].filter(Boolean).join('–'), g.destino].filter(Boolean).join(' · '))}</small></div></li>`;
    }).join('');
  } else {
    let arr = [...Dados.A.values()]; total = arr.length;
    arr = arr.filter((a) => {
      const ativo = !!alertaDe(a.placa);
      if (cadFilter === 'todos' && !ativo) return false; if (cadFilter === 'inativos' && ativo) return false;
      return !q || norm([a.placa, a.motivo, a.fonte, a.veiculo, a.obs].join(' ')).includes(q) || (qp && a.placa.includes(qp));
    }).sort((a, b) => a.placa.localeCompare(b.placa));
    n = arr.length;
    note.hidden = false;
    note.innerHTML = 'Placas de interesse (furto/roubo, determinação do comando). Na leitura, o app mostra uma <b>consulta especial</b> sem som e sem tela vermelha, para não alertar o condutor.';
    html = arr.map((a) => `<li class="vitem" data-a="${esc(a.placa)}" tabindex="0"><div class="vinfo"><div class="vtop">${plateHTML(a.placa, 'sm')}${alertaDe(a.placa) ? '<span class="pill disc">Ativo</span>' : '<span class="pill mut">Inativo</span>'}</div><b>${esc(a.motivo || 'Veículo de interesse')}</b><small>${esc([a.fonte, a.veiculo, a.validade ? 'até ' + fmtD(a.validade) : ''].filter(Boolean).join(' · '))}</small></div></li>`).join('');
  }
  $('#cadCount').textContent = `${n} de ${total}`;
  $('#cadList').innerHTML = html || '<li class="empty">Nada encontrado.</li>';
  const de = $('#btnDelEx'); if (de) de.onclick = async () => { if (!await needGestor()) return; for (const [col, k] of [['veiculos', 'placa'], ['viaturas', 'id'], ['agendados', 'id'], ['alertas', 'placa'], ['pontos', 'id']]) await Dados.apagarVarios(col, [...Dados.mapa(col).values()].filter((v) => v.exemplo).map((v) => v[k])); toast('Exemplos apagados'); };
}
$('#cadSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; cadSub = b.dataset.c; cadFilter = 'todos'; $('#cadSearch').value = ''; renderCadastro(); };
$('#cadSearch').oninput = renderCadastro;
$('#cadFilter').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; cadFilter = b.dataset.f; renderCadastro(); };
$('#cadList').onclick = async (e) => {
  const li = e.target.closest('.vitem'); if (!li) return;
  if (li.dataset.p) { if (podeGerir() && await needGestor()) editVehicle(li.dataset.p); else showResult(li.dataset.p, 'cadastro'); }
  else if (li.dataset.t) { if (podeGerir() && await needGestor()) editViatura(li.dataset.t); else abrirViatura(li.dataset.t); }
  else if (li.dataset.g) { if (podeGerir() && await needGestor()) editAgendado(li.dataset.g); else verAgendado(li.dataset.g); }
  else if (li.dataset.a) { if (podeGerir() && await needGestor()) editAlerta(li.dataset.a); else showResult(li.dataset.a, 'cadastro'); }
};
$('#cadList').onkeydown = (e) => { if (e.key === 'Enter') e.target.click(); };
$('#btnNovo').onclick = async () => {
  if (cadSub === 'veiculos') { if (await needGestor()) editVehicle(null); }
  else if (await needGestor()) ({ viaturas: () => editViatura(null), agendados: () => editAgendado(null), alertas: () => editAlerta(null) })[cadSub]();
};
$('#btnImportar').onclick = async () => { if (await needGestor()) abrirImportar(cadSub); };

function editVehicle(placa, preset = {}) {
  const v = placa ? { ...Dados.V.get(placa) } : { status: 'ativo', vinculo: 'Cadete', ...preset }; let foto = v.foto || null;
  const opt = (arr, sel) => arr.map((o) => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');
  openSheet(placa ? 'Editar veículo' : 'Novo veículo', `<div class="photo-edit"><img id="edFotoImg" src="${avatar(v)}" alt="Foto do responsável"><div class="btnrow">
      <label class="btn" for="edFotoCam">Tirar foto</label><input type="file" id="edFotoCam" accept="image/*" capture="user" hidden>
      <label class="btn" for="edFotoGal">Escolher da galeria</label><input type="file" id="edFotoGal" accept="image/*" hidden>
      <button class="btn ghost sm" id="edFotoDel" type="button" ${foto ? '' : 'hidden'}>Remover foto</button></div></div>
    <div class="grid2"><label class="f" for="edPlaca">Placa *<input id="edPlaca" value="${esc(v.placa || '')}" maxlength="8" autocapitalize="characters" style="font:600 22px var(--display);letter-spacing:.1em;text-transform:uppercase"></label>
      <label class="f" for="edStatus">Situação<select id="edStatus"><option value="ativo" ${v.status !== 'bloqueado' ? 'selected' : ''}>Ativo — liberar</option><option value="bloqueado" ${v.status === 'bloqueado' ? 'selected' : ''}>Bloqueado — não liberar</option></select></label></div>
    <label class="f" for="edNome">Nome do proprietário / responsável<input id="edNome" value="${esc(v.nome || '')}"></label>
    <div class="grid2"><label class="f" for="edPG">Posto / graduação<input id="edPG" value="${esc(v.postoGrad || '')}" placeholder="Ex.: Cad. PM, 2º Ten."></label>
      <label class="f" for="edVinc">Vínculo<select id="edVinc">${opt(VINC.includes(v.vinculo) || !v.vinculo ? VINC : [...VINC, v.vinculo], v.vinculo)}</select></label></div>
    <div class="grid2"><label class="f" for="edMarca">Marca<input id="edMarca" value="${esc(v.marca || '')}"></label><label class="f" for="edModelo">Modelo<input id="edModelo" value="${esc(v.modelo || '')}"></label></div>
    <div class="grid2"><label class="f" for="edCor">Cor<input id="edCor" value="${esc(v.cor || '')}"></label><label class="f" for="edSetor">Setor / pelotão<input id="edSetor" value="${esc(v.setor || '')}"></label></div>
    <div class="grid2"><label class="f" for="edTel">Telefone<input id="edTel" type="tel" value="${esc(v.telefone || '')}"></label><label class="f" for="edVal">Válido até (vazio = sem prazo)<input id="edVal" type="date" value="${esc(v.validade || '')}"></label></div>
    <label class="f" for="edObs">Observações (motivo de bloqueio, autorizações…)<textarea id="edObs">${esc(v.obs || '')}</textarea></label>
    <button class="btn primary big" id="edSave" type="button">Salvar</button>
    ${placa ? `<div class="btnrow"><button class="btn" id="edHist" type="button">Histórico</button><button class="btn bad" id="edDel" type="button">Excluir veículo</button></div>` : ''}`);
  const setFoto = async (f) => { if (!f) return; foto = await resizeImg(await fileToDataURL(f)); $('#edFotoImg').src = foto || avatar(v); $('#edFotoDel').hidden = !foto; };
  $('#edFotoCam').onchange = (e) => setFoto(e.target.files[0]); $('#edFotoGal').onchange = (e) => setFoto(e.target.files[0]);
  $('#edFotoDel').onclick = () => { foto = null; $('#edFotoImg').src = avatar({ nome: $('#edNome').value }); $('#edFotoDel').hidden = true; };
  $('#edSave').onclick = async () => {
    const p = normPlate($('#edPlaca').value); if (!validPlate(p)) { toast('Placa inválida. Use ABC1D23 ou ABC1234.'); return; }
    if (p !== placa && Dados.V.has(p)) { toast('A placa ' + p + ' já está cadastrada.'); return; }
    const nv = { ...v, placa: p, status: $('#edStatus').value, nome: $('#edNome').value.trim(), postoGrad: $('#edPG').value.trim(), vinculo: $('#edVinc').value, marca: $('#edMarca').value.trim(),
      modelo: $('#edModelo').value.trim(), cor: $('#edCor').value.trim(), setor: $('#edSetor').value.trim(), telefone: $('#edTel').value.trim(), validade: $('#edVal').value, obs: $('#edObs').value.trim(), foto, atualizadoEm: Date.now() };
    if (!nv.criadoEm) nv.criadoEm = Date.now(); delete nv.exemplo;
    if (placa && placa !== p) await Dados.apagar('veiculos', placa);
    await Dados.salvar('veiculos', nv); closeSheet(); toast('Veículo ' + p + ' salvo');
  };
  if (placa) {
    $('#edHist').onclick = () => showHistory(placa);
    $('#edDel').onclick = async () => {
      if (!await ask({ title: 'Excluir ' + placa + '?', msg: 'O cadastro e a foto serão apagados. Os registros de entrada e saída continuam no livro.', ok: 'Excluir', danger: true })) return;
      await Dados.apagar('veiculos', placa); closeSheet(); toast('Veículo excluído');
    };
  }
}
function verAgendado(id) {
  const g = Dados.G.get(id); if (!g) return;
  openSheet('Agendamento', `<div class="person"><img src="${avatar(g)}" alt=""><div style="min-width:0"><div class="rank">${esc(fmtD(g.data) + (g.dataFim ? ' a ' + fmtD(g.dataFim) : ''))}</div><h4>${esc(g.nome || 'Sem nome')}</h4>
    <dl class="kv">${g.documento ? `<dt>Documento</dt><dd>${esc(g.documento)}</dd>` : ''}${g.placa ? `<dt>Placa</dt><dd>${esc(g.placa)}</dd>` : ''}${g.veiculo ? `<dt>Veículo</dt><dd>${esc([g.veiculo, g.cor].filter(Boolean).join(' '))}</dd>` : ''}
    <dt>Horário</dt><dd>${esc([g.horaIni, g.horaFim].filter(Boolean).join(' às ') || 'dia todo')}</dd>${g.destino ? `<dt>Destino</dt><dd>${esc(g.destino)}</dd>` : ''}${g.autorizadoPor ? `<dt>Autorizado por</dt><dd>${esc(g.autorizadoPor)}</dd>` : ''}${g.obs ? `<dt>Obs.</dt><dd>${esc(g.obs)}</dd>` : ''}</dl></div></div>`);
}
function editAgendado(id) {
  const g = id ? { ...Dados.G.get(id) } : { data: hojeISO() };
  openSheet(id ? 'Editar agendamento' : 'Novo agendamento', `
    <div class="grid2"><label class="f" for="agNome">Nome *<input id="agNome" value="${esc(g.nome || '')}"></label><label class="f" for="agDoc">Documento (RG/CPF)<input id="agDoc" value="${esc(g.documento || '')}"></label></div>
    <div class="grid2"><label class="f" for="agPlaca">Placa (se vier de carro)<input id="agPlaca" value="${esc(g.placa || '')}" maxlength="8" autocapitalize="characters" style="text-transform:uppercase"></label><label class="f" for="agVeic">Veículo e cor<input id="agVeic" value="${esc([g.veiculo, g.cor].filter(Boolean).join(' '))}" placeholder="Ex.: Fiat Strada branca"></label></div>
    <label class="f" for="agDest">Destino / motivo<input id="agDest" value="${esc(g.destino || '')}" placeholder="Ex.: Seção de Logística — manutenção"></label>
    <label class="f" for="agAut">Autorizado por<input id="agAut" value="${esc(g.autorizadoPor || '')}" placeholder="Ex.: Cap. Fulano — Of. de Dia"></label>
    <label class="switch" for="agRec">Visitante frequente (repete nos dias da semana marcados) <input type="checkbox" id="agRec" ${g.recorrente ? 'checked' : ''}></label>
    <div id="agDiasBox" ${g.recorrente ? '' : 'hidden'}><div class="f"><span>Dias permitidos</span><div class="chips" id="agDias">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip" type="button" data-d="${d}" aria-pressed="${(g.dias || [1, 2, 3, 4, 5]).includes(d)}">${DIAS_SEM[d]}</button>`).join('')}</div></div></div>
    <div class="grid2"><label class="f" for="agData">Data *<input type="date" id="agData" value="${esc(g.data || '')}"></label><label class="f" for="agDataFim">Até a data (vários dias)<input type="date" id="agDataFim" value="${esc(g.dataFim || '')}"></label></div>
    <div class="grid2"><label class="f" for="agIni">Hora de início<input type="time" id="agIni" value="${esc(g.horaIni || '')}"></label><label class="f" for="agFim">Hora de fim<input type="time" id="agFim" value="${esc(g.horaFim || '')}"></label></div>
    <label class="f" for="agObs">Observações<textarea id="agObs">${esc(g.obs || '')}</textarea></label>
    <button class="btn primary big" id="agSave" type="button">Salvar</button>
    ${id ? '<button class="btn bad" id="agDel" type="button">Excluir agendamento</button>' : ''}`);
  $('#agRec').onchange = (e) => { $('#agDiasBox').hidden = !e.target.checked; if (e.target.checked && !$('#agDataFim').value) { const d = new Date(); d.setMonth(d.getMonth() + 3); $('#agDataFim').value = isoOf(d); } };
  $('#agDias').onclick = (e) => { const b = e.target.closest('.chip'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'); };
  $('#agSave').onclick = async () => {
    const nome = $('#agNome').value.trim(), placa = normPlate($('#agPlaca').value), data = $('#agData').value;
    if (!nome) { toast('Informe o nome'); return; } if (!data) { toast('Informe a data'); return; }
    if (placa && !validPlate(placa)) { toast('Placa inválida'); return; }
    const fim = $('#agDataFim').value;
    const nv = { ...g, nome, documento: $('#agDoc').value.trim(), placa: placa || '', veiculo: $('#agVeic').value.trim(), cor: '', destino: $('#agDest').value.trim(), autorizadoPor: $('#agAut').value.trim(),
      recorrente: $('#agRec').checked, dias: $('#agRec').checked ? $$('#agDias .chip').filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => +c.dataset.d) : [],
      data, dataFim: fim && fim > data ? fim : '', horaIni: $('#agIni').value, horaFim: $('#agFim').value, obs: $('#agObs').value.trim(), atualizadoEm: Date.now() };
    if (!nv.criadoEm) nv.criadoEm = Date.now();
    await Dados.salvar('agendados', nv); closeSheet(); toast('Agendamento salvo');
  };
  if (id) $('#agDel').onclick = async () => { if (!await ask({ title: 'Excluir agendamento?', ok: 'Excluir', danger: true })) return; await Dados.apagar('agendados', id); closeSheet(); toast('Agendamento excluído'); };
}
function editAlerta(placa) {
  const a = placa ? { ...Dados.A.get(placa) } : { ativo: true };
  openSheet(placa ? 'Editar alerta' : 'Novo alerta', `
    <div class="grid2"><label class="f" for="alPlaca">Placa *<input id="alPlaca" value="${esc(a.placa || '')}" maxlength="8" autocapitalize="characters" style="font:600 22px var(--display);letter-spacing:.1em;text-transform:uppercase"></label>
      <label class="f" for="alAtivo">Situação<select id="alAtivo"><option value="1" ${a.ativo !== false ? 'selected' : ''}>Ativo</option><option value="0" ${a.ativo === false ? 'selected' : ''}>Inativo</option></select></label></div>
    <label class="f" for="alMot">Motivo *<input id="alMot" value="${esc(a.motivo || '')}" placeholder="Ex.: Furto/roubo — consulta, determinação do comando"></label>
    <label class="f" for="alFonte">Origem da informação<input id="alFonte" value="${esc(a.fonte || '')}" placeholder="Ex.: Of. de Dia, BO nº…"></label>
    <div class="grid2"><label class="f" for="alVeic">Veículo e cor<input id="alVeic" value="${esc([a.veiculo, a.cor].filter(Boolean).join(' '))}"></label><label class="f" for="alVal">Válido até (vazio = sem prazo)<input type="date" id="alVal" value="${esc(a.validade || '')}"></label></div>
    <label class="f" for="alObs">Observações / procedimento<textarea id="alObs">${esc(a.obs || '')}</textarea></label>
    <button class="btn primary big" id="alSave" type="button">Salvar</button>
    ${placa ? '<button class="btn bad" id="alDel" type="button">Excluir da lista</button>' : ''}`);
  $('#alSave').onclick = async () => {
    const p = normPlate($('#alPlaca').value); if (!validPlate(p)) { toast('Placa inválida'); return; }
    if (!$('#alMot').value.trim()) { toast('Informe o motivo'); return; }
    const nv = { ...a, placa: p, ativo: $('#alAtivo').value === '1', motivo: $('#alMot').value.trim(), fonte: $('#alFonte').value.trim(), veiculo: $('#alVeic').value.trim(), cor: '',
      validade: $('#alVal').value, obs: $('#alObs').value.trim(), atualizadoEm: Date.now() };
    if (!nv.criadoEm) nv.criadoEm = Date.now();
    if (placa && placa !== p) await Dados.apagar('alertas', placa);
    await Dados.salvar('alertas', nv); closeSheet(); toast('Alerta salvo');
  };
  if (placa) $('#alDel').onclick = async () => { if (!await ask({ title: 'Excluir ' + placa + ' da lista de alerta?', ok: 'Excluir', danger: true })) return; await Dados.apagar('alertas', placa); closeSheet(); toast('Removido da lista'); };
}

/* ---------- LIVRO ---------- */
function logItem(r, showDate) {
  const [c, l] = ST[r.resultado] || ST.ok;
  const ident = r.kind === 'ocorrencia' ? `<span class="oc-cat">${esc(r.categoria || 'Ocorrência')}</span>` : r.kind === 'ronda' ? '<span class="ped">RONDA</span>'
    : r.resultado === 'vtrext' ? `<span class="vtr ext">${esc(r.prefixo || 'VTR')}</span>${r.placa ? plateHTML(r.placa, 'sm') : ''}`
    : r.kind === 'viatura' ? `<span class="vtr">${esc(r.prefixo || 'VTR')}</span>${r.placa ? plateHTML(r.placa, 'sm') : ''}` : r.kind === 'pessoa' ? '<span class="ped">' + (r.resultado === 'entrega' ? 'ENTREGA' : 'PEDESTRE') + '</span>' : plateHTML(r.placa, 'sm');
  const pill = r.alerta ? '<span class="pill disc">Alerta</span>' : (r.fotos || []).length ? '<span class="pill mut">Foto</span>' : !['ok', 'pessoa', 'vtr', 'oc', 'ronda'].includes(r.resultado) ? `<span class="pill ${c}">${r.empresa ? esc(r.empresa) : l}</span>` : '<span></span>';
  const det = r.kind === 'ocorrencia' ? [] : r.kind === 'ronda' ? [r.origem === 'manual' ? 'registrada sem QR' : 'QR Code']
    : r.kind === 'viatura' ? ['KM ' + fmtKm(r.km) + (r.kmRodados != null ? ' (' + fmtKm(r.kmRodados) + ' km)' : ''), r.combustivel ? 'comb. ' + r.combustivel : '', (r.faltando || []).length ? 'faltando ' + r.faltando.length : '', r.destino]
    : [r.kind === 'pessoa' ? r.documento : r.veiculo, r.destino];
  return `<li class="litem" data-k="${esc(r.chave || r.placa)}"><span class="t">${showDate ? fmtDT(r.ts) : fmtH(r.ts)}</span>
    <div class="who"><div class="vtop">${ident}${r.kind === 'ocorrencia' || r.kind === 'ronda' ? '' : `<span class="tag ${r.tipo === 'entrada' ? 'e' : 's'}">${r.kind === 'viatura' ? (r.tipo === 'entrada' ? 'RETORNO' : 'SAÍDA') : r.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span>`}</div><b>${esc(r.kind === 'ocorrencia' ? (r.obs || '').split('\n')[0].slice(0, 80) : r.nome || 'Não identificado')}</b><small>${esc([...det, r.sentinela ? 'Sent.: ' + r.sentinela : ''].filter(Boolean).join(' · '))}</small></div>
    ${pill}${r.obs && r.kind !== 'ocorrencia' ? `<div class="obs">${esc(r.obs)}</div>` : ''}</li>`;
}
function abrirRegistro(k) {
  if (k.startsWith('OC:')) { verOcorrencia(k); return; }
  if (k.startsWith('RD:')) { showHistory(k); return; }
  if (k.startsWith('PFX:')) { verVtrExterna(k); return; }
  if (k.startsWith('VTR:')) { if (Dados.T.has(k.slice(4))) abrirViatura(k.slice(4)); else showHistory(k); return; }
  if (!k.startsWith('P:')) { showResult(k, 'livro'); return; }
  const regs = Dados.R.filter((r) => r.chave === k).sort((a, b) => b.ts - a.ts); const r = regs[0]; if (!r) return;
  const foto = regs.find((x) => x.foto);
  const dentro = isInside(k);
  openSheet('Pedestre', `<div class="person"><img src="${foto ? foto.foto : avatar(r)}" alt=""><div style="min-width:0"><div class="rank">${dentro ? 'No local desde ' + fmtDT(r.ts) : 'Fora da unidade'}</div><h4>${esc(r.nome)}</h4>
    <dl class="kv">${r.documento ? `<dt>Documento</dt><dd>${esc(r.documento)}</dd>` : ''}${r.destino ? `<dt>Destino</dt><dd>${esc(r.destino)}</dd>` : ''}<dt>Visitas</dt><dd>${regs.filter((x) => x.tipo === 'entrada').length} (últimos ${JANELA_DIAS} dias)</dd></dl></div></div>
    <div class="btnrow">${dentro ? '<button class="btn primary big" id="pSai" type="button">Registrar saída</button>' : '<button class="btn ok big" id="pEnt" type="button">Nova entrada</button>'}<button class="btn" id="pHist" type="button">Histórico</button></div>`);
  const s = $('#pSai'); if (s) s.onclick = async () => { await saidaDe(k); closeSheet(); };
  const en = $('#pEnt'); if (en) en.onclick = () => { closeSheet(); go('portao'); modoPortao = 'pessoa'; renderPortao(); $('#pesNome').value = r.nome || ''; $('#pesDoc').value = r.documento || ''; pesHint(); };
  $('#pHist').onclick = () => showHistory(k);
}
async function renderLivro() {
  const iso = $('#livroDate').value || hojeISO(); const a = diaMs(iso), b = a + 864e5; const q = norm($('#livroSearch').value);
  $$('#livroFiltro .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.f === livroFiltro));
  const ins = insideList(), late = new Map(atrasados().map((x) => [String(x.r.id), x]));
  $('#insideList').innerHTML = ins.length ? ins.map((r) => {
    const lt = late.get(String(r.id));
    return `<li class="litem ${lt ? 'late' : ''}" data-k="${esc(r.chave || r.placa)}"><span class="t">${fmtDT(r.ts)}</span><div class="who"><div class="vtop">${r.kind === 'pessoa' ? pedTag(r) : plateHTML(r.placa, 'sm')}${visitante(r) ? '<span class="pill info">Visitante</span>' : ''}</div><b>${esc(r.nome || 'Não identificado')}</b><small>${esc([r.kind === 'pessoa' ? r.documento : r.veiculo, r.destino].filter(Boolean).join(' · '))}</small></div>
      <button class="btn sm" type="button" data-out="${esc(r.chave || r.placa)}">Saída</button>${lt ? `<div class="late-t">Passou ${fmtDur(lt.exc)} do ${esc(lt.mot)}</div>` : ''}</li>`;
  }).join('') : '<li class="empty">Ninguém registrado dentro da unidade.</li>';
  let day;
  try { day = (await Dados.registrosPeriodo(a, b)).sort((x, y) => y.ts - x.ts); } catch (e) { $('#livroList').innerHTML = `<li class="empty">${esc(mensagemErro(e))}</li>`; return; }
  const entV = day.filter((r) => r.tipo === 'entrada' && (!r.kind || r.kind === 'veiculo')).length, entP = day.filter((r) => r.tipo === 'entrada' && r.kind === 'pessoa').length;
  const nao = day.filter((r) => r.tipo === 'entrada' && r.resultado === 'nao').length, oc = day.filter((r) => r.alerta || r.resultado === 'bloq').length;
  $('#livroStats').innerHTML = `<div class="stat"><b>${entV}</b><span>Entradas de veículos</span></div><div class="stat"><b>${entP}</b><span>Pedestres</span></div>
    <div class="stat ${nao ? 'warn' : ''}"><b>${nao}</b><span>Não cadastrados</span></div><div class="stat ${oc ? 'bad' : ''}"><b>${oc}</b><span>Bloqueios e alertas</span></div>`;
  const rows = day.filter((r) => {
    if (livroFiltro === 'veiculo' && !(!r.kind || r.kind === 'veiculo')) return false; if (livroFiltro === 'pessoa' && r.kind !== 'pessoa') return false;
    if (livroFiltro === 'viatura' && r.kind !== 'viatura') return false; if (livroFiltro === 'rapido' && !rapido(r)) return false;
    if (livroFiltro === 'posto' && r.kind !== 'ocorrencia') return false; if (livroFiltro === 'ronda' && r.kind !== 'ronda') return false;
    if (livroFiltro === 'ocorr' && !(r.alerta || ['bloq', 'venc', 'agendfora', 'nao'].includes(r.resultado))) return false;
    return !q || norm([r.placa, r.prefixo, r.nome, r.documento, r.obs, r.destino, r.empresa].join(' ')).includes(q);
  });
  $('#livroList').innerHTML = rows.length ? rows.map((r) => logItem(r)).join('') : `<li class="empty">Nenhum registro em ${fmtD(iso)}.</li>`;
}
$('#livroDate').onchange = renderLivro; $('#livroSearch').oninput = renderLivro;
$('#livroFiltro').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; livroFiltro = b.dataset.f; renderLivro(); };
$('#v-livro').addEventListener('click', async (e) => {
  const out = e.target.closest('[data-out]'); if (out) { e.stopPropagation(); await saidaDe(out.dataset.out); return; }
  const li = e.target.closest('.litem[data-k]'); if (li) abrirRegistro(li.dataset.k);
});
$('#btnCsv').onclick = async () => {
  const iso = $('#livroDate').value || hojeISO(); const a = diaMs(iso);
  const rows = (await Dados.registrosPeriodo(a, a + 864e5)).sort((x, y) => x.ts - y.ts);
  if (!rows.length) { toast('Nenhum registro neste dia'); return; }
  const lines = [RPT_COLS.join(';')].concat(rptLinhas({ rows }).map((l) => l.map(csvCell).join(';')));
  download('livro-portao-' + iso + '.csv', '﻿' + lines.join('\r\n'), 'text/csv');
};
$('#btnPassagem').onclick = () => passagem(12);
$('#btnOcorr2').onclick = () => abrirOcorrencia();
$('#v-painel').addEventListener('click', (e) => { const vt = e.target.closest('[data-vtr]'); if (vt) { abrirViatura(vt.dataset.vtr); return; } const li = e.target.closest('.litem[data-k]'); if (li) abrirRegistro(li.dataset.k); });
function passagem(h) {
  const now = Date.now(), from = now - h * 36e5; const rows = Dados.R.filter((r) => r.ts >= from).sort((a, b) => a.ts - b.ts); const ins = insideList();
  const ent = rows.filter((r) => r.tipo === 'entrada'), sai = rows.filter((r) => r.tipo === 'saida');
  const entV = ent.filter((r) => (!r.kind || r.kind === 'veiculo')), entP = ent.filter((r) => r.kind === 'pessoa');
  const vtrMov = rows.filter((r) => r.kind === 'viatura'), vtrFora = [...Dados.T.values()].filter((t) => t.fora);
  const vtrKm = vtrMov.reduce((s, r) => s + (+r.kmRodados || 0), 0);
  const vis = [...new Set(entV.filter(visitante).map((r) => r.placa + (r.nome ? ' (' + r.nome + ')' : '')))];
  const bl = [...new Set(rows.filter((r) => r.resultado === 'bloq').map((r) => r.placa))];
  const al = [...new Set(rows.filter((r) => r.alerta).map((r) => r.placa))];
  const at = atrasados(); const obs = rows.filter((r) => r.obs && r.kind !== 'ocorrencia');
  const ocs = rows.filter((r) => r.kind === 'ocorrencia'), rds = rows.filter((r) => r.kind === 'ronda'), rdAt = rondasAtrasadas();
  const vtrProb = rows.filter((r) => r.kind === 'viatura' && r.tipo === 'entrada' && ((r.sumiu || []).length || r.avarias));
  const pend = agendadosHoje().filter((g) => !Dados.R.some((r) => r.agendadoId === g.id && r.tipo === 'entrada' && r.ts >= diaMs(hojeISO())) && agJanela(g) !== 'depois');
  const L = (arr, f) => (arr.length ? '\n' + arr.map((x) => '  • ' + f(x)).join('\n') : '');
  let t = `PASSAGEM DE SERVIÇO — PORTÃO APMG\n${fmtDT(from)} até ${fmtDT(now)} (últimas ${h} h)\nSentinela: ${CFG.sentinela || 'não informado'}\n\n`;
  t += `Veículos: ${entV.length} entradas, ${sai.filter((r) => (!r.kind || r.kind === 'veiculo')).length} saídas\nPedestres: ${entP.length} entradas, ${sai.filter((r) => r.kind === 'pessoa').length} saídas\n`;
  const rap = ent.filter(rapido); if (rap.length) t += `Uber/app e entregas: ${rap.length}\n`;
  t += `Viaturas: ${vtrMov.filter((r) => r.tipo === 'saida').length} saídas, ${vtrMov.filter((r) => r.tipo === 'entrada').length} retornos${vtrKm ? ', ' + fmtKm(vtrKm) + ' km rodados' : ''}\n`;
  if (vtrFora.length) t += `Viaturas fora agora:${L(vtrFora, (v) => `${vtrNome(v)} — ${v.motoristaAtual || 'motorista não informado'} — saiu ${v.foraDesde ? fmtDT(v.foraDesde) : ''} com KM ${fmtKm(v.kmSaida)}${v.destinoAtual ? ' — ' + v.destinoAtual : ''}`)}\n`;
  t += `Visitantes / não cadastrados (veículos): ${vis.length}${L(vis, (x) => x)}\n`;
  t += `Alertas de veículo bloqueado: ${bl.length}${L(bl, (x) => x)}\n`;
  if (al.length) t += `Consultas especiais (lista de alerta): ${al.length}${L(al, (x) => x)}\n`;
  t += `\nNo local agora (${ins.length}):${ins.length ? L(ins, (r) => `${r.kind === 'pessoa' ? (r.resultado === 'entrega' ? 'Entrega' + (r.empresa ? ' ' + r.empresa : '') : 'Pedestre') : quem(r)} — ${r.nome || 'não identificado'}${r.kind === 'pessoa' ? (r.destino ? ' — ' + r.destino : '') : r.veiculo ? ' — ' + r.veiculo : ''} (entrou ${fmtDT(r.ts)})`) : '\n  ninguém'}\n`;
  if (at.length) t += `\nPermanência vencida:${L(at, (x) => `${x.r.placa || x.r.nome} — passou ${fmtDur(x.exc)} do ${x.mot}`)}\n`;
  if (pend.length) t += `\nAgendados que ainda não chegaram:${L(pend, (g) => `${g.nome}${g.placa ? ' (' + g.placa + ')' : ''} — ${[g.horaIni, g.horaFim].filter(Boolean).join(' às ') || 'dia todo'}${g.destino ? ' — ' + g.destino : ''}`)}\n`;
  if (ocs.length) t += `\nOcorrências do posto (${ocs.length}):${L(ocs, (r) => `${fmtH(r.ts)} [${r.categoria}] ${r.obs}`)}\n`;
  if (pontosAtivos().length) t += `\nRondas: ${rds.length} passagens registradas${rds.filter((r) => r.origem === 'manual').length ? ' (' + rds.filter((r) => r.origem === 'manual').length + ' sem QR)' : ''}${rdAt.length ? '\n  • Pontos atrasados: ' + rdAt.map((x) => x.p.nome).join(', ') : ''}\n`;
  if (vtrProb.length) t += `\nAlterações em viaturas:${L(vtrProb, (r) => `VTR ${r.prefixo || r.placa}: ${[(r.sumiu || []).length ? 'voltou sem ' + r.sumiu.join(', ') : '', r.avarias].filter(Boolean).join('; ')}`)}\n`;
  if (obs.length) t += `\nObservações:${L(obs, (r) => `${fmtH(r.ts)} ${quem(r)}: ${r.obs}`)}\n`;
  t += `\nSem outras alterações.`;
  openSheet('Passagem de serviço', `<div class="chips"><button class="chip" type="button" data-h="12" aria-pressed="${h === 12}">Últimas 12 h</button><button class="chip" type="button" data-h="24" aria-pressed="${h === 24}">Últimas 24 h</button></div>
    <pre class="passagem" id="passTxt">${esc(t)}</pre><div class="btnrow"><button class="btn primary" id="passCopy" type="button">Copiar texto</button>${navigator.share ? '<button class="btn" id="passShare" type="button">Enviar (WhatsApp…)</button>' : ''}</div>`);
  $$('[data-h]').forEach((b) => (b.onclick = () => passagem(+b.dataset.h)));
  $('#passCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(t); toast('Texto copiado'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#passTxt')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto selecionado — use Copiar'); }
  };
  if (navigator.share) $('#passShare').onclick = () => navigator.share({ title: 'Passagem de serviço', text: t }).catch(() => {});
}

/* ---------- RELATÓRIOS ---------- */
$('#rptPer').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; RPT.per = b.dataset.p; if (RPT.per === 'custom' && !$('#rptA').value) { $('#rptA').value = isoOf(new Date(Date.now() - 6 * 864e5)); $('#rptB').value = hojeISO(); } renderRelatorios(); };
$('#rptA').onchange = renderRelatorios; $('#rptB').onchange = renderRelatorios;

/* ---------- MAIS ---------- */
function applyTheme() {
  if (CFG.theme) document.documentElement.setAttribute('data-theme', CFG.theme); else document.documentElement.removeAttribute('data-theme');
  const dark = CFG.theme ? CFG.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
  $('meta[name="theme-color"]').content = dark ? '#142130' : '#ffffff';
}
const PAPEL_TXT = { comando: 'Comando (painel e relatórios, só consulta)', admin: 'Administrador', gestor: 'Gestor (edita o cadastro)', sentinela: 'Sentinela (consulta e registra)', local: 'Modo local' };
function renderMais() {
  $('#cfgSent').value = CFG.sentinela || ''; $('#cfgSom').checked = !!CFG.som; $('#cfgAuto').checked = !!CFG.auto; $('#cfgTheme').value = CFG.theme || '';
  $('#cfgLimVis').value = CFG.limVisit; $('#cfgLimGer').value = CFG.limGeral; $('#cfgLimRap').value = CFG.limRapido;
  const cb = $('#contaBox');
  if (naNuvem()) {
    cb.innerHTML = `<h3>Conta e sincronização</h3><p><b>${esc(Dados.user.email)}</b><br>${esc(PAPEL_TXT[Dados.papel] || Dados.papel)}${Dados.geral ? ' · conta geral da guarda' : ''}</p>
      <p>Código deste celular: <b>${esc(codigoAparelho())}</b></p>
      <p>${Dados.pendente ? 'Há registros esperando internet para subir.' : Dados.online ? 'Sincronizado com os outros celulares da guarda.' : 'Sem conexão com a nuvem. O app continua funcionando e envia tudo quando a internet voltar.'}</p>
      <div class="btnrow"><button class="btn" id="btnSair" type="button">Sair da conta</button><button class="btn ghost" id="btnModoLocal" type="button">Usar só neste aparelho</button></div>`;
    $('#btnSair').onclick = async () => { if (!await ask({ title: 'Sair da conta?', msg: 'Para usar de novo, entre com e-mail e senha.', ok: 'Sair' })) return; Dados.parar(); const { auth, a } = Dados.fb; await auth.signOut(a); };
    $('#btnModoLocal').onclick = async () => { if (!await ask({ title: 'Usar só neste aparelho?', msg: 'O app deixa de sincronizar. O cadastro da nuvem não vem junto.', ok: 'Mudar' })) return; CFG.modo = 'local'; await saveCfg(); location.reload(); };
  } else {
    cb.innerHTML = `<h3>Modo de uso</h3><p><b>Só neste aparelho.</b> Cadastro e livro ficam neste celular.</p>
      ${Dados.configurado() ? '<p>Na nuvem, todos os celulares da guarda veem o mesmo cadastro, agendados, lista de alerta e livro.</p><button class="btn primary" id="btnModoNuvem" type="button">Sincronizar com a guarda (entrar com conta)</button>' : ''}`;
    const bn = $('#btnModoNuvem'); if (bn) bn.onclick = async () => { CFG.modo = 'nuvem'; await saveCfg(); location.reload(); };
  }
  $('#acessosBox').hidden = !ehAdminNuvem(); if (ehAdminNuvem()) renderAcessos();
  renderRondasCfg();
  $('#pinBox').hidden = naNuvem();
  $('#pinState').textContent = CFG.pin ? 'PIN ativo: editar cadastro, importar e apagar exigem o PIN.' : 'Sem PIN: qualquer pessoa com o celular pode editar o cadastro.';
  $('#btnPin').textContent = CFG.pin ? 'Trocar PIN' : 'Definir PIN'; $('#btnPinOff').hidden = !CFG.pin;
  $('#dadosTxt').textContent = naNuvem() ? 'Backup baixa uma cópia do cadastro e do livro recente. Restaurar envia para a nuvem (gestores).' : 'Os dados ficam só neste celular. Faça backup para não perder nada se trocar de aparelho.';
  $('#btnOldLogs').hidden = naNuvem() && !ehAdminNuvem();
  $('#btnWipe').hidden = naNuvem();
  $('#btnMigrar').hidden = true;
  if (naNuvem() && podeGerir()) Dados.contarLocal().then((l) => { const n = l.veiculos.length + l.alertas.length + l.agendados.length + l.viaturas.length + l.pontos.length; const b = $('#btnMigrar'); b.hidden = !n; b.textContent = `Enviar para a nuvem o cadastro deste aparelho (${n})`; }).catch(() => {});
  const fotos = [...Dados.V.values()].filter((v) => v.foto).length;
  $('#dbInfo').textContent = `${Dados.V.size} veículos (${fotos} com foto) · ${Dados.T.size} viaturas · ${Dados.G.size} agendamentos · ${Dados.A.size} na lista de alerta · ${Dados.R.length} registros recentes`;
}
/** Código fixo deste celular (para autorizar a conta geral da guarda). */
function codigoAparelho() { const c = CFG.deviceId || ''; return c.slice(0, 4) + '-' + c.slice(4); }
function novoCodigoAparelho() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; const r = crypto.getRandomValues(new Uint8Array(8)); for (const x of r) c += A[x % A.length]; return c; }
async function renderAcessos() {
  const box = $('#acessosBox'); box.innerHTML = '<h3>Acessos ao Portão</h3><p class="count"><span class="spin"></span> Carregando…</p>';
  try {
    const { pendentes, contas } = await Dados.listarAcessos();
    const papelSel = (c) => `<select data-papel="${esc(c.email)}" aria-label="Papel de ${esc(c.email)}"><option value="sentinela" ${c.papel === 'sentinela' ? 'selected' : ''}>Sentinela</option><option value="gestor" ${c.papel === 'gestor' ? 'selected' : ''}>Gestor</option><option value="comando" ${c.papel === 'comando' ? 'selected' : ''}>Comando (consulta)</option></select>`;
    const gerais = contas.filter((c) => c.geral), pessoais = contas.filter((c) => !c.geral);
    box.innerHTML = `<h3>Acessos ao Portão</h3>
      <p>Sentinela consulta e registra; gestor também edita cadastro, viaturas, agendados e lista de alerta.</p>
      <div class="btnrow"><button class="btn primary" id="accNovo" type="button">Criar usuário (e-mail e senha)</button><button class="btn" id="accGeral" type="button">Criar conta geral da guarda</button></div>
      ${pendentes.length ? `<h3 class="sec">Pedidos (${pendentes.length})</h3>${pendentes.map((e) => `<div class="acc"><span>${esc(e)}</span><button class="btn sm ok" data-lib="${esc(e)}" data-pap="sentinela" type="button">Sentinela</button><button class="btn sm" data-lib="${esc(e)}" data-pap="gestor" type="button">Gestor</button><button class="btn sm ghost" data-rem="${esc(e)}" type="button">Recusar</button></div>`).join('')}` : ''}
      ${gerais.length ? `<h3 class="sec">Conta geral da guarda</h3>${gerais.map((c) => `<div class="acc col">
        <span><b>${esc(c.nome || 'Guarda')}</b> · ${esc(c.email)}${c.ativo ? '' : ' <span class="pill bad">Bloqueada</span>'}</span>
        <span class="count">Celulares autorizados (${c.dispositivos.length} de ${c.maxDispositivos}): ${c.dispositivos.length ? c.dispositivos.map((d) => `<button class="chip" type="button" data-desaut="${esc(c.email)}" data-cod="${esc(d)}" title="Remover">${esc(d.slice(0, 4) + '-' + d.slice(4))} ✕</button>`).join(' ') : 'nenhum'}</span>
        <div class="toolbar"><input data-codin="${esc(c.email)}" placeholder="Código do celular (ex.: K7QM-4PZ2)" autocapitalize="characters" aria-label="Código do celular"><button class="btn sm ok" data-aut="${esc(c.email)}" type="button" ${c.dispositivos.length >= c.maxDispositivos ? 'disabled' : ''}>Autorizar</button></div>
        <div class="btnrow">${papelSel(c)}<button class="btn sm" data-ativo="${esc(c.email)}" data-v="${c.ativo ? '0' : '1'}" type="button">${c.ativo ? 'Bloquear' : 'Liberar'}</button><button class="btn sm ghost" data-rem="${esc(c.email)}" type="button">Remover</button></div></div>`).join('')}` : ''}
      ${pessoais.length ? `<h3 class="sec">Usuários</h3>${pessoais.map((c) => `<div class="acc"><span>${c.nome ? '<b>' + esc(c.nome) + '</b> · ' : ''}${esc(c.email)}${c.ativo ? '' : ' <span class="pill bad">Bloqueada</span>'}</span>
        ${papelSel(c)}<button class="btn sm" data-ativo="${esc(c.email)}" data-v="${c.ativo ? '0' : '1'}" type="button">${c.ativo ? 'Bloquear' : 'Liberar'}</button><button class="btn sm ghost" data-reset="${esc(c.email)}" type="button">Senha</button><button class="btn sm ghost" data-rem="${esc(c.email)}" type="button">Remover</button></div>`).join('')}` : ''}
      <button class="btn sm ghost" id="accReload" type="button">Atualizar lista</button>`;
    const contaDe = (email) => contas.find((c) => c.email === email);
    $('#accNovo').onclick = () => criarUsuarioUI(false);
    $('#accGeral').onclick = () => criarUsuarioUI(true);
    $$('[data-lib]', box).forEach((b) => (b.onclick = async () => { await Dados.definirAcesso(b.dataset.lib, { ativo: true, papel: b.dataset.pap }); toast('Acesso liberado'); renderAcessos(); }));
    $$('[data-papel]', box).forEach((s) => (s.onchange = async () => { await Dados.definirAcesso(s.dataset.papel, { papel: s.value }); toast('Papel atualizado'); }));
    $$('[data-ativo]', box).forEach((b) => (b.onclick = async () => { await Dados.definirAcesso(b.dataset.ativo, { ativo: b.dataset.v === '1' }); renderAcessos(); }));
    $$('[data-rem]', box).forEach((b) => (b.onclick = async () => { if (!await ask({ title: 'Remover ' + b.dataset.rem + '?', msg: 'A conta perde o acesso ao Portão.', ok: 'Remover', danger: true })) return; await Dados.removerAcesso(b.dataset.rem); renderAcessos(); }));
    $$('[data-reset]', box).forEach((b) => (b.onclick = async () => {
      try { await Dados.fb.auth.sendPasswordResetEmail(Dados.fb.a, b.dataset.reset); toast('Link para criar nova senha enviado para ' + b.dataset.reset, 5000); } catch (e) { toast(mensagemErro(e), 5000); }
    }));
    $$('[data-aut]', box).forEach((b) => (b.onclick = async () => {
      const c = contaDe(b.dataset.aut), cod = normDoc($(`[data-codin="${CSS.escape(b.dataset.aut)}"]`, box).value);
      if (cod.length !== 8) { toast('O código tem 8 letras/números, como aparece no celular da guarda.'); return; }
      if (c.dispositivos.includes(cod)) { toast('Este celular já está autorizado.'); return; }
      if (c.dispositivos.length >= c.maxDispositivos) { toast(`Limite de ${c.maxDispositivos} celulares. Remova um antes.`); return; }
      await Dados.definirAcesso(c.email, { dispositivos: [...c.dispositivos, cod] }); toast('Celular autorizado'); renderAcessos();
    }));
    $$('[data-desaut]', box).forEach((b) => (b.onclick = async () => {
      const c = contaDe(b.dataset.desaut); if (!await ask({ title: 'Remover o celular ' + b.dataset.cod + '?', msg: 'Ele deixa de abrir o app com a conta geral.', ok: 'Remover', danger: true })) return;
      await Dados.definirAcesso(c.email, { dispositivos: c.dispositivos.filter((d) => d !== b.dataset.cod) }); renderAcessos();
    }));
    $('#accReload').onclick = renderAcessos;
  } catch (e) { box.innerHTML = `<h3>Acessos ao Portão</h3><div class="gmsg">${esc(mensagemErro(e))}</div>`; }
}
function criarUsuarioUI(geral) {
  openSheet(geral ? 'Conta geral da guarda' : 'Criar usuário', `
    <p class="count">${geral
      ? 'Uma conta única para os celulares fixos do portão. Ela só abre nos celulares que você autorizar pelo código que aparece na tela deles. Em cada serviço, o app pede o nome do sentinela.'
      : 'Crie o acesso com e-mail e senha e passe a senha para a pessoa. Se o e-mail já tiver conta no Portão, o acesso é liberado e a pessoa continua com a senha que já usa.'}</p>
    <form class="view" id="cuForm" autocomplete="off">
      <label class="f" for="cuNome">${geral ? 'Nome da conta' : 'Nome (posto/graduação e nome)'}<input id="cuNome" value="${geral ? 'Guarda APMG' : ''}"></label>
      <label class="f" for="cuEmail">E-mail de login *<input type="email" id="cuEmail" autocomplete="off" placeholder="${geral ? 'Ex.: guarda.apmg@gmail.com' : 'nome@exemplo.com'}"></label>
      <label class="f" for="cuSenha">Senha * (mínimo 6 caracteres)<input type="text" id="cuSenha" autocomplete="new-password" minlength="6"></label>
      <div class="grid2">
        <label class="f" for="cuPapel">Papel<select id="cuPapel"><option value="sentinela">Sentinela</option><option value="gestor">Gestor</option><option value="comando">Comando (só consulta)</option></select></label>
        ${geral ? '<label class="f" for="cuMax">Celulares permitidos<input type="number" id="cuMax" min="1" max="6" value="2"></label>' : ''}
      </div>
      ${geral ? '' : '<p class="count">Use um e-mail real: é por ele que a pessoa recupera a senha.</p>'}
      <div class="gmsg" id="cuMsg" hidden></div>
      <button class="btn primary big" type="submit" id="cuGo">Criar</button>
    </form>`);
  $('#cuForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#cuEmail').value.trim().toLowerCase(), senha = $('#cuSenha').value, msg = $('#cuMsg');
    msg.hidden = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.hidden = false; msg.textContent = 'E-mail inválido.'; return; }
    if (senha.length < 6) { msg.hidden = false; msg.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    const b = $('#cuGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Criando…';
    try {
      const r = await Dados.criarUsuario({ email, senha, nome: $('#cuNome').value.trim(), papel: $('#cuPapel').value, geral, maxDispositivos: geral ? Math.max(1, Math.min(6, +$('#cuMax').value || 2)) : 0 });
      openSheet(geral ? 'Conta geral criada' : 'Usuário criado', `<div class="verdict ok"><h3>${r.jaExistia ? 'Acesso liberado' : 'Conta criada'}</h3><p>${esc(email)}</p></div>
        ${r.jaExistia ? '<p>Este e-mail já tinha conta no Portão. A senha digitada <b>não</b> foi trocada: a pessoa entra com a senha que já usa (ou usa "Esqueci a senha").</p>' : `<p>Passe para a pessoa: e-mail <b>${esc(email)}</b> e a senha que você definiu. Ela já pode entrar, sem confirmar o e-mail.</p>`}
        ${geral ? '<p>Agora, em cada celular da guarda: abra o app, escolha "Com a guarda", entre com esta conta e anote o código que aparece. Depois autorize os códigos em Mais → Acessos ao Portão.</p>' : ''}
        <button class="btn primary" id="cuOk" type="button">Concluir</button>`);
      $('#cuOk').onclick = () => { closeSheet(); renderAcessos(); };
    } catch (err) { msg.hidden = false; msg.textContent = mensagemErro(err); b.disabled = false; b.textContent = 'Criar'; }
  };
}
$('#cfgSent').onchange = async (e) => { CFG.sentinela = e.target.value.trim(); CFG.sentinelaEm = Date.now(); await saveCfg(); renderHeader(); toast('Sentinela atualizado'); };
$('#cfgSom').onchange = async (e) => { CFG.som = e.target.checked; await saveCfg(); if (CFG.som) alertFx('ok'); };
$('#cfgAuto').onchange = async (e) => { CFG.auto = e.target.checked; await saveCfg(); };
$('#cfgTheme').onchange = async (e) => { CFG.theme = e.target.value; await saveCfg(); applyTheme(); };
$('#cfgLimVis').onchange = async (e) => { CFG.limVisit = Math.max(0, +e.target.value || 0); await saveCfg(); checarPermanencia(); };
$('#cfgLimGer').onchange = async (e) => { CFG.limGeral = Math.max(0, +e.target.value || 0); await saveCfg(); checarPermanencia(); };
$('#cfgLimRap').onchange = async (e) => { CFG.limRapido = Math.max(0, +e.target.value || 0); await saveCfg(); checarPermanencia(); };
$('#btnPin').onclick = async () => {
  if (!await needPin()) return;
  const p = await ask({ title: CFG.pin ? 'Novo PIN' : 'Definir PIN', msg: 'Use de 4 a 8 números.', ok: 'Salvar', input: { type: 'password', mode: 'numeric', ph: 'Novo PIN' } }); if (p === null) return;
  if (!/^\d{4,8}$/.test(p)) { toast('O PIN precisa ter de 4 a 8 números'); return; }
  const c = await ask({ title: 'Confirme o PIN', ok: 'Confirmar', input: { type: 'password', mode: 'numeric', ph: 'Repita o PIN' } });
  if (c !== p) { if (c !== null) toast('Os PINs não conferem'); return; }
  CFG.pin = p; unlocked = true; await saveCfg(); renderMais(); toast('PIN definido');
};
$('#btnPinOff').onclick = async () => { if (!await needPin()) return; CFG.pin = ''; await saveCfg(); renderMais(); toast('PIN removido'); };
$('#btnMigrar').onclick = async () => {
  if (!await needGestor()) return;
  const l = await Dados.contarLocal();
  if (!await ask({ title: 'Enviar para a nuvem?', msg: `${l.veiculos.length} veículos, ${l.viaturas.length} viaturas, ${l.agendados.length} agendamentos e ${l.alertas.length} alertas deste aparelho vão para a nuvem. Itens iguais serão substituídos.`, ok: 'Enviar' })) return;
  for (const c of ['veiculos', 'viaturas', 'agendados', 'alertas', 'pontos']) { await Dados.salvarVarios(c, l[c]); await Dados.idbClear(c); }
  toast('Cadastro enviado para a nuvem'); renderMais();
};
$('#btnBackup').onclick = async () => {
  if (!await needGestor()) return;
  const registros = naNuvem() ? Dados.R : await Dados.idbAll('registros');
  const data = { app: 'portao-apmg', versao: 2, geradoEm: new Date().toISOString(), veiculos: [...Dados.V.values()], alertas: [...Dados.A.values()], agendados: [...Dados.G.values()], viaturas: [...Dados.T.values()], pontos: [...Dados.P.values()], configuracao: Dados.C, registros };
  download('backup-portao-apmg-' + hojeISO() + '.json', JSON.stringify(data), 'application/json'); toast('Backup salvo em Downloads');
};
$('#restoreIn').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !await needGestor()) return;
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'portao-apmg') throw new Error('arquivo');
    const n = (k) => (d[k] || []).length;
    if (!await ask({ title: 'Restaurar backup?', msg: `${n('veiculos')} veículos, ${n('agendados')} agendamentos, ${n('alertas')} alertas${naNuvem() ? '' : ' e ' + n('registros') + ' registros'} serão juntados aos dados atuais. Itens iguais serão substituídos.`, ok: 'Restaurar' })) return;
    await Dados.salvarVarios('veiculos', d.veiculos || []); await Dados.salvarVarios('alertas', d.alertas || []); await Dados.salvarVarios('agendados', d.agendados || []); await Dados.salvarVarios('viaturas', d.viaturas || []); await Dados.salvarVarios('pontos', d.pontos || []); if (d.configuracao) await Dados.salvarConf(d.configuracao);
    if (!naNuvem()) {
      const have = new Set((await Dados.idbAll('registros')).map((r) => r.ts + (r.chave || r.placa) + r.tipo));
      await Dados.idbPutMany('registros', (d.registros || []).filter((r) => !have.has(r.ts + (r.chave || r.placa) + r.tipo)).map(({ id, ...r }) => ({ kind: 'veiculo', chave: r.placa, ...r })));
      await Dados.iniciarLocal();
    }
    toast('Backup restaurado');
  } catch (_) { toast('Arquivo de backup inválido', 4000); }
};
$('#btnOldLogs').onclick = async () => {
  if (!naNuvem() && !await needPin()) return;
  const lim = Date.now() - 90 * 864e5; const old = await Dados.registrosPeriodo(0, lim);
  if (!old.length) { toast('Nenhum registro com mais de 90 dias'); return; }
  if (!await ask({ title: 'Apagar ' + old.length + ' registros antigos?', msg: 'Exporte um relatório ou backup antes, se precisar guardar o histórico.', ok: 'Apagar', danger: true })) return;
  await Dados.apagarVarios('registros', old.map((r) => r.id)); toast('Registros antigos apagados');
};
$('#btnWipe').onclick = async () => {
  if (!await needPin()) return;
  const v = await ask({ title: 'Apagar tudo?', msg: 'Cadastro, fotos, agendados, lista de alerta e livro serão apagados deste celular. Digite APAGAR para confirmar.', ok: 'Apagar tudo', danger: true, input: { ph: 'APAGAR' } });
  if (v === null) return; if (v.trim().toUpperCase() !== 'APAGAR') { toast('Nada foi apagado'); return; }
  for (const s of ['veiculos', 'registros', 'alertas', 'agendados', 'viaturas', 'pontos']) await Dados.idbClear(s);
  await Dados.iniciarLocal(); toast('Tudo apagado');
};

/* ---------- navegação e cabeçalho ---------- */
function go(v) {
  if (v !== 'portao' && Cam.stream) Cam.stop();
  cur = v; $$('main > .view').forEach((s) => (s.hidden = s.id !== 'v-' + v));
  $$('.tab').forEach((t) => (t.dataset.v === v ? t.setAttribute('aria-current', 'page') : t.removeAttribute('aria-current')));
  refreshAll(); window.scrollTo(0, 0);
}
$$('.tab').forEach((t) => (t.onclick = () => go(t.dataset.v)));
function renderHeader() {
  $('#hdrSent').textContent = (CFG.sentinela ? 'Sentinela: ' + CFG.sentinela : 'Sentinela não informado');
  const n = insideList().length, dot = $('#syncDot');
  $('#hdrInside').lastChild.textContent = n + (n === 1 ? ' no local' : ' no local');
  dot.hidden = !naNuvem(); dot.className = 'sync ' + (Dados.pendente || !Dados.online ? 'off' : 'on');
  dot.title = Dados.pendente ? 'Esperando internet para enviar' : Dados.online ? 'Sincronizado' : 'Sem conexão com a nuvem';
}
let rptTimer;
function refreshAll(what) {
  renderHeader(); checarPermanencia(); checarRondas();
  if (cur === 'portao') renderPortao();
  if (cur === 'painel') renderPainel();
  if (cur === 'cadastro') renderCadastro();
  if (cur === 'livro') renderLivro();
  if (cur === 'relatorios' && (!what || what === 'registros')) { clearTimeout(rptTimer); rptTimer = setTimeout(renderRelatorios, what ? 800 : 0); }
  if (cur === 'mais' && (!what || ['sync', 'tudo', 'pontos', 'config'].includes(what))) { if (what === 'pontos' || what === 'config') renderRondasCfg(); else renderMais(); }
}
let rondaAvisadas = '';
function checarRondas() {
  const rd = Dados.modo ? rondasAtrasadas() : [], b = $('#rondaBanner');
  b.hidden = !rd.length;
  b.innerHTML = rd.length ? `<span>Ronda atrasada: ${esc(rd.slice(0, 3).map((x) => x.p.nome).join(', '))}${rd.length > 3 ? '…' : ''}</span><span>Ronda</span>` : '';
  const chave = rd.map((x) => x.p.id).join(',');
  if (chave && chave !== rondaAvisadas && Dados.prontoR && rondaAvisadas !== null) { if (rondaAvisadas) { alertFx('warn', CFG.som); toast('Ronda atrasada', 4000); } }
  rondaAvisadas = chave;
}
/** Papel "comando": só painel, livro, relatórios e Mais. */
function aplicarPapel() {
  const cmd = Dados.papel === 'comando';
  document.body.classList.toggle('comando', cmd);
  $('.tab[data-v="painel"]').hidden = !cmd; $('.tab[data-v="portao"]').hidden = cmd; $('.tab[data-v="cadastro"]').hidden = cmd;
  if (cmd && (cur === 'portao' || cur === 'cadastro')) go('painel');
}
Dados.on((what) => {
  if (what === 'negado') { toast('A nuvem recusou o acesso. O administrador precisa publicar as regras do Firestore e liberar sua conta.', 7000); return; }
  refreshAll(what);
});
setInterval(() => { const d = new Date(); $('#clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); }, 1000);
setInterval(() => { if (Dados.modo) { checarPermanencia(); if (cur === 'portao') renderPortao(); } }, 60000);
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && Cam.stream && !Cam.wake) { try { Cam.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* ignora */ } } });
window.addEventListener('online', () => { Dados.online = true; renderHeader(); });
window.addEventListener('offline', () => { Dados.online = false; renderHeader(); });
$('#sheetClose').onclick = closeSheet;

/* ---------- entrada: escolha de modo, login e liberação ---------- */
function gate(html) { $('#gateBox').innerHTML = `<span class="brand-mark">APMG</span>${html}`; $('#gate').hidden = false; const i = $('#gateBox input'); if (i && matchMedia('(pointer: fine)').matches) i.focus(); }
function hideGate() { $('#gate').hidden = true; }
function gateMsg(t, ok) { const m = $('#gMsg'); if (!m) return; m.hidden = !t; m.textContent = t || ''; m.className = 'gmsg' + (ok ? ' ok' : ''); }
function gateEscolha() {
  gate(`<h1>Portão APMG</h1><p>Como este celular vai ser usado?</p>
    <button class="choice rec" id="gNuvem" type="button"><b>Com a guarda (recomendado)</b><span>Entre com sua conta. Todos os celulares do portão veem o mesmo cadastro, agendados, lista de alerta e livro. Funciona sem internet e sincroniza depois.</span></button>
    <button class="choice" id="gLocal" type="button"><b>Só neste aparelho</b><span>Sem conta. Os dados ficam só neste celular, com backup manual.</span></button>`);
  $('#gNuvem').onclick = async () => { CFG.modo = 'nuvem'; await saveCfg(); iniciarModo(); };
  $('#gLocal').onclick = async () => { CFG.modo = 'local'; await saveCfg(); iniciarModo(); };
}
function gateEntrar(tela = 'entrar') {
  const criar = tela === 'criar';
  gate(`<h1>${criar ? 'Criar conta' : 'Entrar'}</h1><p>${criar ? 'Depois de confirmar o e-mail, o administrador libera seu acesso ao Portão.' : 'Use o e-mail e a senha da sua conta do Portão.'}</p>
    <form id="gForm" class="view" autocomplete="on">
      <label class="f" for="gEmail">E-mail<input type="email" id="gEmail" autocomplete="username" required></label>
      <label class="f" for="gSenha">Senha<input type="password" id="gSenha" autocomplete="${criar ? 'new-password' : 'current-password'}" minlength="6" required></label>
      <div class="gmsg" id="gMsg" hidden></div>
      <button class="btn primary big" type="submit" id="gGo">${criar ? 'Criar conta' : 'Entrar'}</button>
    </form>
    <button class="linkbtn" id="gTroca" type="button">${criar ? 'Já tenho conta — entrar' : 'Não tenho conta — criar'}</button>
    ${criar ? '' : '<button class="linkbtn" id="gEsqueci" type="button">Esqueci a senha</button>'}
    <button class="linkbtn" id="gLocal" type="button">Usar só neste aparelho, sem conta</button>`);
  $('#gTroca').onclick = () => gateEntrar(criar ? 'entrar' : 'criar');
  $('#gLocal').onclick = async () => { CFG.modo = 'local'; await saveCfg(); location.reload(); };
  const es = $('#gEsqueci');
  if (es) es.onclick = async () => {
    const email = $('#gEmail').value.trim(); if (!email) { gateMsg('Digite seu e-mail acima e toque de novo em "Esqueci a senha".'); return; }
    try { const { auth, a } = await Dados.carregarFB(); await auth.sendPasswordResetEmail(a, email); gateMsg('Enviamos um link para redefinir a senha. Veja também o spam.', true); } catch (e) { gateMsg(mensagemErro(e)); }
  };
  $('#gForm').onsubmit = async (e) => {
    e.preventDefault(); const b = $('#gGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span>'; gateMsg('');
    try {
      const { auth, a } = await Dados.carregarFB(); const email = $('#gEmail').value.trim().toLowerCase(), senha = $('#gSenha').value;
      if (criar) { const c = await auth.createUserWithEmailAndPassword(a, email, senha); await auth.sendEmailVerification(c.user); }
      else await auth.signInWithEmailAndPassword(a, email, senha);
    } catch (err) { gateMsg(mensagemErro(err)); b.disabled = false; b.textContent = criar ? 'Criar conta' : 'Entrar'; }
  };
}
function gateSair() { return `<button class="linkbtn" id="gSair" type="button">Sair e usar outra conta</button>`; }
function ligarSair() { const s = $('#gSair'); if (s) s.onclick = async () => { const { auth, a } = Dados.fb; await auth.signOut(a); }; }
function gateVerificar(u) {
  gate(`<h1>Confirme seu e-mail</h1><p>Enviamos um link para <b>${esc(u.email)}</b>. Abra o e-mail (veja também o spam), toque no link e volte aqui.</p>
    <div class="gmsg" id="gMsg" hidden></div>
    <button class="btn primary big" id="gJa" type="button">Já confirmei</button><button class="btn" id="gReenv" type="button">Reenviar e-mail</button>${gateSair()}`);
  $('#gJa').onclick = async () => { await u.reload(); if (Dados.fb.a.currentUser.emailVerified) { await u.getIdToken(true); contaMudou(Dados.fb.a.currentUser); } else gateMsg('Ainda não consta a confirmação. Toque no link do e-mail e tente de novo.'); };
  $('#gReenv').onclick = async () => { try { await Dados.fb.auth.sendEmailVerification(u); gateMsg('E-mail reenviado.', true); } catch (e) { gateMsg(mensagemErro(e)); } };
  ligarSair();
}
function gatePendente(u) {
  gate(`<h1>Aguardando liberação</h1><p>Sua conta <b>${esc(u.email)}</b> pediu acesso ao Portão. O administrador libera em Mais → Acessos ao Portão.</p>
    <div class="gmsg" id="gMsg" hidden></div><button class="btn primary big" id="gDeNovo" type="button">Verificar de novo</button>${gateSair()}`);
  $('#gDeNovo').onclick = () => contaMudou(u, true); ligarSair();
}
function gateBloqueado(u) { gate(`<h1>Acesso bloqueado</h1><p>A conta <b>${esc(u.email)}</b> está bloqueada no Portão. Fale com o administrador.</p>${gateSair()}`); ligarSair(); }
function gateCarregando(t = 'Abrindo…') { gate(`<h1>Portão APMG</h1><p><span class="spin"></span> ${esc(t)}</p>`); }
function gateErro(t) {
  gate(`<h1>Sem conexão</h1><div class="gmsg">${esc(t)}</div><button class="btn primary big" id="gTenta" type="button">Tentar de novo</button><button class="linkbtn" id="gLocal" type="button">Usar só neste aparelho</button>`);
  $('#gTenta').onclick = () => location.reload(); $('#gLocal').onclick = async () => { CFG.modo = 'local'; await saveCfg(); location.reload(); };
}
async function contaMudou(u, avisarPendente) {
  if (!u) { Dados.parar(); gateEntrar(); return; }
  try {
    const s = await Dados.situacao(u);
    // contas criadas pelo administrador entram sem confirmar e-mail; as demais precisam confirmar
    if (!u.emailVerified && !(s.s !== 'pendente' && s.criadoPeloAdmin)) { gateVerificar(u); return; }
    if (s.s === 'pendente') { gatePendente(u); if (avisarPendente) gateMsg('Ainda não liberada.'); }
    else if (s.s === 'bloqueado') gateBloqueado(u);
    else if (s.geral && !(s.dispositivos || []).includes(CFG.deviceId)) gateAparelho(u);
    else {
      hideGate(); Dados.geral = !!s.geral;
      // conta geral: o nome do sentinela vale por um serviço (12 h); depois o app pergunta de novo
      if (s.geral && Date.now() - (CFG.sentinelaEm || 0) > 12 * 36e5) { CFG.sentinela = ''; await saveCfg(); }
      await Dados.iniciarNuvem(u, s.papel); aplicarPapel();
      if (s.geral) setTimeout(garantirSentinela, 400);
    }
  } catch (e) { gateErro(mensagemErro(e)); }
}
function gateAparelho(u) {
  gate(`<h1>Celular não autorizado</h1><p>A conta <b>${esc(u.email)}</b> é a conta geral da guarda e só abre nos celulares autorizados.</p>
    <div class="setrow" style="text-align:center"><p>Código deste celular</p><b style="font:700 36px/1 var(--display);letter-spacing:.12em">${esc(codigoAparelho())}</b></div>
    <p>Envie este código ao administrador. Ele autoriza em Mais → Acessos ao Portão.</p>
    <div class="gmsg" id="gMsg" hidden></div><button class="btn primary big" id="gDeNovo" type="button">Verificar de novo</button>${gateSair()}`);
  $('#gDeNovo').onclick = () => contaMudou(u, true); ligarSair();
}
async function seed() {
  const t = Date.now(), ontem = isoOf(new Date(t - 864e5)), hoje = hojeISO();
  const ex = [
    { placa: 'BRA2E19', nome: 'Exemplo — João Pereira', postoGrad: 'Cad. PM', vinculo: 'Cadete', marca: 'Volkswagen', modelo: 'Gol', cor: 'Prata', setor: 'Pelotão Alfa', status: 'ativo' },
    { placa: 'RTA4C22', nome: 'Exemplo — Marcos Lima', postoGrad: 'Cap. QOPM', vinculo: 'Oficial', marca: 'Toyota', modelo: 'Corolla', cor: 'Preto', setor: 'Corpo de Alunos', status: 'ativo' },
    { placa: 'ABC1234', nome: 'Exemplo — Veículo bloqueado', vinculo: 'Outro', marca: 'Fiat', modelo: 'Uno', cor: 'Branco', status: 'bloqueado', obs: 'Exemplo: proibido o acesso por determinação do comando.' },
    { placa: 'QWE9F87', nome: 'Exemplo — Ana Souza', vinculo: 'Visitante', marca: 'Hyundai', modelo: 'HB20', cor: 'Vermelho', setor: 'Visita à Seção de Ensino', validade: ontem, status: 'ativo' },
  ].map((v) => ({ ...v, exemplo: true, criadoEm: t }));
  await Dados.idbPutMany('veiculos', ex);
  await Dados.idbPutMany('agendados', [{ exemplo: true, id: 'exemplo-ag', nome: 'Exemplo — Técnico da manutenção', documento: 'RG 0.000.000-0', placa: 'MNT5A01', veiculo: 'Fiat Strada', cor: 'Branca', destino: 'Seção de Logística', autorizadoPor: 'Of. de Dia', data: hoje, horaIni: '08:00', horaFim: '18:00', criadoEm: t }]);
  await Dados.idbPutMany('alertas', [{ exemplo: true, placa: 'XYZ9K88', motivo: 'Exemplo de alerta — veículo de interesse', fonte: 'Teste do app', ativo: true, criadoEm: t }]);
  CFG.seeded = true; await seedVtr();
}
async function seedVtr() {
  await Dados.idbPutMany('viaturas', [{ id: 'EX101', prefixo: 'EX-101', placa: 'PMP1R23', tipo: 'Caminhonete', marca: 'Toyota', modelo: 'Hilux', cor: 'Caracterizada', kmAtual: 48210, ativo: true, exemplo: true, criadoEm: Date.now() }]);
  CFG.seededVtr = true; await seedPontos();
}
async function seedPontos() {
  await Dados.idbPutMany('pontos', [{ id: 'ex-pt1', nome: 'Exemplo — Muro dos fundos', ordem: 1, ativo: true, exemplo: true }, { id: 'ex-pt2', nome: 'Exemplo — Garagem das viaturas', ordem: 2, ativo: true, exemplo: true }]);
  CFG.seededPts = true; await saveCfg();
}
async function iniciarModo() {
  if (CFG.modo === 'local' || !Dados.configurado()) {
    hideGate(); if (!CFG.seeded) await seed(); else if (!CFG.seededVtr) await seedVtr(); else if (!CFG.seededPts) await seedPontos(); await Dados.iniciarLocal(); return;
  }
  gateCarregando('Conectando à nuvem…');
  try { const { auth, a } = await Dados.carregarFB(); auth.onAuthStateChanged(a, (u) => contaMudou(u)); }
  catch (e) { gateErro('Não foi possível carregar a sincronização. Na primeira vez é preciso internet.'); }
}
(async () => {
  try { await Dados.abrirIDB(); const c = await Dados.cfgGet(); if (c) CFG = { ...CFG, ...c }; }
  catch (e) { toast('Não foi possível abrir o armazenamento do navegador. Saia do modo anônimo.', 6000); }
  if (!CFG.deviceId) { CFG.deviceId = novoCodigoAparelho(); await saveCfg(); }
  applyTheme(); $('#clock').textContent = fmtH(Date.now());
  if (!CFG.modo && Dados.configurado()) gateEscolha(); else await iniciarModo();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
