/* Viaturas da APMG (por prefixo ou placa) com motorista e KM obrigatórios,
   e cadastros rápidos de Uber/app e entregadores. */
"use strict";
const TIPOS_VTR = ['Carro', 'Caminhonete', 'Moto', 'Van', 'Micro-ônibus', 'Ônibus', 'Outro'];
const APPS = ['Uber', '99', 'InDrive', 'Táxi', 'Outro'];
const EMPRESAS = ['iFood', 'Rappi', 'Mercado Livre', 'Correios', 'Amazon', 'Shopee', 'Farmácia', 'Outro'];

const idViatura = (prefixo, placa) => normDoc(prefixo) || normPlate(placa);
const parseKm = (s) => { const n = String(s ?? '').replace(/[^\d]/g, ''); return n ? +n : NaN; };
const fmtKm = (n) => (n === '' || n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR'));
const vtrBadge = (t, cls = '') => `<span class="vtr ${cls}">${esc(t.prefixo || 'VTR')}</span>`;
const vtrNome = (t) => (t.prefixo ? 'VTR ' + t.prefixo : t.placa);

function viaturaPorPlaca(p) {
  if (!p) return null; const alt = altPlate(p);
  for (const t of Dados.T.values()) if (t.ativo !== false && t.placa && (t.placa === p || t.placa === alt)) return t;
  return null;
}
/** Acha a viatura pelo que a sentinela digitou: prefixo completo, só os números do prefixo, ou a placa. */
function viaturaPorTexto(s) {
  const d = normDoc(s); if (!d) return null;
  const ativos = [...Dados.T.values()].filter((t) => t.ativo !== false);
  return ativos.find((t) => normDoc(t.prefixo) === d)
    || ativos.find((t) => t.prefixo && normDoc(t.prefixo).replace(/^[A-Z]+/, '') === d.replace(/^[A-Z]+/, '') && /\d/.test(d))
    || (validPlate(normPlate(s)) ? viaturaPorPlaca(normPlate(s)) : null);
}
function motoristasRecentes() {
  const m = new Map();
  [...Dados.R].filter((r) => r.kind === 'viatura' && r.motorista).sort((a, b) => b.ts - a.ts)
    .forEach((r) => { const k = norm(r.motorista); if (!m.has(k)) m.set(k, { nome: r.motorista, doc: r.documento || '' }); });
  return [...m.values()].slice(0, 40);
}

/* ---------- movimento da viatura ---------- */
function abrirViatura(id, recorte) {
  const t = Dados.T.get(id); if (!t) return;
  const fora = !!t.fora, mots = motoristasRecentes();
  let html = `<div class="verdict ${fora ? 'info' : 'ok'}">${vtrBadge(t, 'xl')}${t.placa ? plateHTML(t.placa) : ''}<h3>${fora ? 'Viatura fora da unidade' : 'Viatura na unidade'}</h3>
    <p>${esc([t.tipo, t.marca, t.modelo, t.cor].filter(Boolean).join(' '))}${t.kmAtual != null && t.kmAtual !== '' ? ' · último KM ' + fmtKm(t.kmAtual) : ''}</p></div>`;
  if (recorte) html += `<div class="crop"><img src="${recorte}" alt="Recorte da placa lida"><span>Imagem lida pela câmera.</span></div>`;
  if (fora) html += `<div class="setrow"><h3>Saída</h3><dl class="kv" style="margin:0"><dt>Motorista</dt><dd>${esc(t.motoristaAtual || '—')}</dd><dt>Saiu em</dt><dd>${t.foraDesde ? fmtDT(t.foraDesde) + ' (há ' + fmtDur(Date.now() - t.foraDesde) + ')' : '—'}</dd>
    <dt>KM de saída</dt><dd>${fmtKm(t.kmSaida)}</dd>${t.destinoAtual ? `<dt>Destino</dt><dd>${esc(t.destinoAtual)}</dd>` : ''}</dl></div>`;
  html += `<datalist id="dlMot">${mots.map((m) => `<option value="${esc(m.nome)}"></option>`).join('')}</datalist>
    <form class="setrow" id="vtrForm" autocomplete="off"><h3>${fora ? 'Registrar retorno' : 'Registrar saída'}</h3>
      <label class="f" for="vMot">Motorista * (posto/graduação e nome)<input id="vMot" list="dlMot" value="${esc(fora ? t.motoristaAtual || '' : '')}" placeholder="Ex.: Sd. Fulano"></label>
      ${fora ? '' : `<label class="f" for="vDoc">RG / matrícula do motorista<input id="vDoc"></label>`}
      <label class="f" for="vKm">${fora ? 'KM final *' : 'KM inicial *'}<input id="vKm" inputmode="numeric" value="${fora ? '' : esc(t.kmAtual ?? '')}" placeholder="Odômetro" style="font:600 24px var(--display);letter-spacing:.06em"></label>
      ${fora ? '' : `<label class="f" for="vDest">Destino / missão<input id="vDest" placeholder="Ex.: Escolta — 13º BPM"></label>`}
      <label class="f" for="vObs">Observação<input id="vObs" placeholder="${fora ? 'Ex.: avaria no retrovisor, abastecida' : 'Ex.: com 3 cadetes'}"></label>
      <p class="count" id="vKmInfo"></p>
      <button class="btn ${fora ? 'ok' : 'primary'} big" type="submit">${fora ? 'Registrar retorno' : 'Registrar saída'}</button>
    </form>
    <div class="btnrow"><button class="btn ghost" id="vHist" type="button">Histórico da viatura</button>${podeGerir() ? '<button class="btn" id="vEdit" type="button">Editar viatura</button>' : ''}</div>`;
  openSheet(vtrNome(t), html);
  alertFx('ok', CFG.som);
  const info = () => {
    const km = parseKm($('#vKm').value);
    $('#vKmInfo').textContent = fora && !isNaN(km) && t.kmSaida != null ? (km >= t.kmSaida ? `Percurso: ${fmtKm(km - t.kmSaida)} km` : 'KM final menor que o de saída') : '';
  };
  $('#vKm').oninput = info;
  $('#vHist').onclick = () => showHistory('VTR:' + id);
  const ed = $('#vEdit'); if (ed) ed.onclick = async () => { if (await needGestor()) editViatura(id); };
  $('#vtrForm').onsubmit = async (e) => {
    e.preventDefault();
    const mot = $('#vMot').value.trim(), km = parseKm($('#vKm').value), obs = $('#vObs').value.trim();
    if (!mot) { toast('Informe o motorista'); $('#vMot').focus(); return; }
    if (isNaN(km)) { toast(fora ? 'Informe o KM final' : 'Informe o KM inicial'); $('#vKm').focus(); return; }
    const base = { kind: 'viatura', chave: 'VTR:' + id, placa: t.placa || '', prefixo: t.prefixo || '', viaturaId: id, nome: mot, motorista: mot, resultado: 'vtr', km, obs,
      veiculo: [t.marca, t.modelo].filter(Boolean).join(' '), origem: recorte ? 'camera' : 'viatura' };
    try {
      if (!fora) {
        const ult = parseKm(t.kmAtual);
        if (!isNaN(ult) && km < ult && !await ask({ title: 'KM menor que o último', msg: `O último KM registrado desta viatura é ${fmtKm(ult)}. Confirma ${fmtKm(km)}?`, ok: 'Confirmar' })) return;
        if (!isNaN(ult) && km - ult > 3000 && !await ask({ title: 'KM muito acima do último', msg: `Último registrado: ${fmtKm(ult)}. Confirma ${fmtKm(km)}?`, ok: 'Confirmar' })) return;
        const dest = $('#vDest').value.trim();
        await registrar({ ...base, tipo: 'saida', documento: $('#vDoc').value.trim(), destino: dest });
        await Dados.atualizar('viaturas', id, { fora: true, foraDesde: Date.now(), motoristaAtual: mot, destinoAtual: dest, kmSaida: km, kmAtual: km, atualizadoEm: Date.now() });
      } else {
        const ini = parseKm(t.kmSaida);
        if (!isNaN(ini) && km < ini) { toast(`O KM final não pode ser menor que o de saída (${fmtKm(ini)}).`, 4500); return; }
        if (!isNaN(ini) && km - ini > 2000 && !await ask({ title: 'Percurso muito longo', msg: `${fmtKm(km - ini)} km desde a saída. Confirma o KM final ${fmtKm(km)}?`, ok: 'Confirmar' })) return;
        await registrar({ ...base, tipo: 'entrada', kmInicial: isNaN(ini) ? null : ini, kmRodados: isNaN(ini) ? null : km - ini, destino: t.destinoAtual || '' });
        await Dados.atualizar('viaturas', id, { fora: false, foraDesde: null, motoristaAtual: '', destinoAtual: '', kmSaida: null, kmAtual: km, atualizadoEm: Date.now() });
        if (!isNaN(ini)) toast(`Retorno registrado · ${fmtKm(km - ini)} km rodados`, 4000);
      }
      closeSheet();
    } catch (err) { /* sem sentinela informado */ }
  };
}
function renderViaturasPortao() {
  const arr = [...Dados.T.values()].filter((t) => t.ativo !== false).sort((a, b) => vtrNome(a).localeCompare(vtrNome(b), 'pt-BR', { numeric: true }));
  const fora = arr.filter((t) => t.fora).sort((a, b) => (a.foraDesde || 0) - (b.foraDesde || 0)), dentro = arr.filter((t) => !t.fora);
  $('#vtrFora').innerHTML = fora.length ? fora.map((t) => `<li class="litem" data-vtr="${esc(t.id)}"><span class="t">${t.foraDesde ? fmtH(t.foraDesde) : '—'}</span>
    <div class="who"><div class="vtop">${vtrBadge(t)}${t.placa ? plateHTML(t.placa, 'sm') : ''}</div><b>${esc(t.motoristaAtual || 'Motorista não informado')}</b><small>${esc(['KM ' + fmtKm(t.kmSaida), t.destinoAtual].filter(Boolean).join(' · '))}</small></div>
    <button class="btn sm ok" type="button" data-vtr="${esc(t.id)}">Retorno</button></li>`).join('') : '<li class="empty">Nenhuma viatura fora.</li>';
  $('#vtrDentro').innerHTML = dentro.length ? dentro.map((t) => `<li class="vitem" data-vtr="${esc(t.id)}" tabindex="0"><div class="vinfo"><div class="vtop">${vtrBadge(t)}${t.placa ? plateHTML(t.placa, 'sm') : ''}</div>
    <b>${esc([t.tipo, t.marca, t.modelo].filter(Boolean).join(' ') || 'Viatura')}</b><small>KM ${fmtKm(t.kmAtual)}</small></div></li>`).join('')
    : `<li class="empty">${arr.length ? 'Todas as viaturas estão fora.' : 'Nenhuma viatura cadastrada. Cadastre em Cadastro → Viaturas.'}</li>`;
}

/* ---------- cadastro de viatura ---------- */
function editViatura(id) {
  const t = id ? { ...Dados.T.get(id) } : { ativo: true, tipo: 'Carro' };
  openSheet(id ? 'Editar viatura' : 'Nova viatura', `
    <div class="grid2"><label class="f" for="etPref">Prefixo<input id="etPref" value="${esc(t.prefixo || '')}" autocapitalize="characters" placeholder="Ex.: 13-1234" style="font:600 22px var(--display);letter-spacing:.06em"></label>
      <label class="f" for="etPlaca">Placa<input id="etPlaca" value="${esc(t.placa || '')}" maxlength="8" autocapitalize="characters" style="font:600 22px var(--display);letter-spacing:.1em;text-transform:uppercase"></label></div>
    <p class="count">Informe o prefixo, a placa ou os dois. Com placa, a câmera reconhece a viatura.</p>
    <div class="grid2"><label class="f" for="etTipo">Tipo<select id="etTipo">${TIPOS_VTR.map((x) => `<option ${x === t.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f" for="etAtivo">Situação<select id="etAtivo"><option value="1" ${t.ativo !== false ? 'selected' : ''}>Em uso</option><option value="0" ${t.ativo === false ? 'selected' : ''}>Baixada / fora de uso</option></select></label></div>
    <div class="grid2"><label class="f" for="etMarca">Marca<input id="etMarca" value="${esc(t.marca || '')}"></label><label class="f" for="etModelo">Modelo<input id="etModelo" value="${esc(t.modelo || '')}"></label></div>
    <div class="grid2"><label class="f" for="etCor">Cor / caracterização<input id="etCor" value="${esc(t.cor || '')}" placeholder="Ex.: caracterizada"></label><label class="f" for="etKm">KM atual<input id="etKm" inputmode="numeric" value="${esc(t.kmAtual ?? '')}"></label></div>
    <label class="f" for="etObs">Observações<textarea id="etObs">${esc(t.obs || '')}</textarea></label>
    <button class="btn primary big" id="etSave" type="button">Salvar</button>
    ${id ? '<button class="btn bad" id="etDel" type="button">Excluir viatura</button>' : ''}`);
  $('#etSave').onclick = async () => {
    const pref = $('#etPref').value.trim().toUpperCase(), placa = normPlate($('#etPlaca').value);
    if (!pref && !placa) { toast('Informe o prefixo ou a placa'); return; }
    if (placa && !validPlate(placa)) { toast('Placa inválida'); return; }
    const nid = idViatura(pref, placa);
    if (nid !== id && Dados.T.has(nid)) { toast('Já existe uma viatura com este prefixo/placa.'); return; }
    const km = parseKm($('#etKm').value);
    const nv = { ...t, id: nid, prefixo: pref, placa, tipo: $('#etTipo').value, ativo: $('#etAtivo').value === '1', marca: $('#etMarca').value.trim(), modelo: $('#etModelo').value.trim(),
      cor: $('#etCor').value.trim(), kmAtual: isNaN(km) ? (t.kmAtual ?? null) : km, obs: $('#etObs').value.trim(), atualizadoEm: Date.now() };
    if (!nv.criadoEm) nv.criadoEm = Date.now(); delete nv.exemplo;
    if (id && id !== nid) await Dados.apagar('viaturas', id);
    await Dados.salvar('viaturas', nv); closeSheet(); toast(vtrNome(nv) + ' salva');
  };
  if (id) $('#etDel').onclick = async () => { if (!await ask({ title: 'Excluir ' + vtrNome(t) + '?', msg: 'Os registros de saída e retorno continuam no livro.', ok: 'Excluir', danger: true })) return; await Dados.apagar('viaturas', id); closeSheet(); toast('Viatura excluída'); };
}

/* ---------- Uber / app e entregadores ---------- */
function chipsHTML(id, opts, sel) { return `<div class="chips" id="${id}" role="group">${opts.map((o) => `<button class="chip" type="button" data-v="${esc(o)}" aria-pressed="${o === sel}">${esc(o)}</button>`).join('')}</div>`; }
function ligarChips(id, onSel) { $('#' + id).onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; $$('#' + id + ' .chip').forEach((c) => c.setAttribute('aria-pressed', c === b)); onSel(b.dataset.v); }; }
function abrirRapido(tipo, pre = {}) {
  const app = tipo === 'app'; let escolha = app ? 'Uber' : 'iFood';
  openSheet(app ? 'Uber / app de transporte' : 'Entregador', `
    <form class="view" id="rpForm" autocomplete="off">
      ${chipsHTML('rpChips', app ? APPS : EMPRESAS, escolha)}
      <label class="f" for="rpOutro" id="rpOutroL" hidden>${app ? 'Qual aplicativo?' : 'Qual empresa?'}<input id="rpOutro"></label>
      <label class="f" for="rpPlaca">${app ? 'Placa *' : 'Placa da moto/veículo (se houver)'}<input id="rpPlaca" value="${esc(pre.placa || '')}" maxlength="8" autocapitalize="characters" style="font:600 22px var(--display);letter-spacing:.1em;text-transform:uppercase"></label>
      <label class="f" for="rpNome">${app ? 'Nome do motorista' : 'Nome do entregador *'}<input id="rpNome"></label>
      ${app ? '<label class="f" for="rpVeic">Veículo e cor<input id="rpVeic" placeholder="Ex.: Onix prata"></label>' : ''}
      <label class="f" for="rpDest">${app ? 'Vai buscar/deixar quem? *' : 'Para quem é a entrega? *'}<input id="rpDest" placeholder="${app ? 'Ex.: Cad. Fulano — alojamento' : 'Ex.: Cad. Fulano — Pelotão Alfa'}"></label>
      <label class="f" for="rpObs">Observação<input id="rpObs" placeholder="${app ? 'Ex.: só embarque, não estaciona' : 'Ex.: entregou na guarda'}"></label>
      <button class="btn ok big" type="submit">Registrar entrada</button>
      <p class="count">Fica no livro como ${app ? 'Uber/app' : 'entrega'}. Avisa se passar de ${CFG.limRapido || 0} min (ajuste em Mais).</p>
    </form>`);
  ligarChips('rpChips', (v) => { escolha = v; $('#rpOutroL').hidden = v !== 'Outro'; });
  setTimeout(() => { const el = pre.placa ? $('#rpDest') : app ? $('#rpPlaca') : $('#rpNome'); if (el) el.focus(); }, 80);
  $('#rpForm').onsubmit = async (e) => {
    e.preventDefault();
    const emp = escolha === 'Outro' ? ($('#rpOutro').value.trim() || 'Outro') : escolha;
    const placa = normPlate($('#rpPlaca').value), nome = $('#rpNome').value.trim(), dest = $('#rpDest').value.trim(), obs = $('#rpObs').value.trim();
    if (app && !validPlate(placa)) { toast('Informe a placa do carro'); $('#rpPlaca').focus(); return; }
    if (!app && placa && !validPlate(placa)) { toast('Placa inválida — deixe em branco se não houver'); return; }
    if (!app && !nome) { toast('Informe o nome do entregador'); $('#rpNome').focus(); return; }
    if (!dest) { toast(app ? 'Informe quem ele vai buscar ou deixar' : 'Informe para quem é a entrega'); $('#rpDest').focus(); return; }
    if (placa) {
      const av = avaliar(placa);
      if (av.al || av.st === 'bloq') { closeSheet(); showResult(placa, app ? 'uber' : 'entrega'); return; } // alerta/bloqueio tem prioridade
      if (isInside(av.key)) { toast('Esta placa já consta dentro da unidade. Registre a saída antes.', 4000); return; }
    }
    const chave = placa || ('P:' + norm(nome) + ':' + norm(emp));
    if (!placa && isInside(chave)) { toast('Este entregador já consta dentro.'); return; }
    try {
      await registrar({ kind: placa ? 'veiculo' : 'pessoa', chave, placa: placa || '', tipo: 'entrada', resultado: app ? 'app' : 'entrega', empresa: emp,
        nome: nome || (emp + ' — motorista'), veiculo: app ? $('#rpVeic').value.trim() : '', destino: dest, obs, origem: app ? 'uber' : 'entrega' });
      closeSheet();
    } catch (err) { /* sem sentinela informado */ }
  };
}
