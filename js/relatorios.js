/* Relatórios para o comando: movimento por dia e por hora, visitantes, pedestres,
   ocorrências (bloqueio, alerta, vencidos) e exportação em PDF e Excel. */
"use strict";
const RPT = { per: '7', a: null, b: null, dados: null };
const RES_TXT = { ok: 'Autorizado', bloq: 'Bloqueado', venc: 'Vencido', nao: 'Não cadastrado', agend: 'Agendado', agendfora: 'Agendado fora do horário', pessoa: 'Pedestre' };

function rptPeriodo() {
  const hoje = diaMs(hojeISO()), d = new Date();
  switch (RPT.per) {
    case '7': return [hoje - 6 * 864e5, hoje + 864e5, 'Últimos 7 dias'];
    case '30': return [hoje - 29 * 864e5, hoje + 864e5, 'Últimos 30 dias'];
    case 'mes': return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), hoje + 864e5, 'Mês atual'];
    case 'mesant': return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime(), 'Mês anterior'];
    default: {
      const a = diaMs($('#rptA').value || hojeISO()), b = diaMs($('#rptB').value || hojeISO()) + 864e5;
      return [a, Math.max(a + 864e5, b), 'Período escolhido'];
    }
  }
}
function rptCalc(rows, a, b) {
  rows = [...rows].sort((x, y) => x.ts - y.ts);
  const ent = rows.filter((r) => r.tipo === 'entrada'), sai = rows.filter((r) => r.tipo === 'saida');
  const entV = ent.filter((r) => r.kind !== 'pessoa'), entP = ent.filter((r) => r.kind === 'pessoa');
  const visit = ent.filter((r) => r.kind === 'pessoa' || ['nao', 'agend', 'agendfora'].includes(r.resultado));
  const naoCad = entV.filter((r) => r.resultado === 'nao');
  const ocorr = rows.filter((r) => r.alerta || r.resultado === 'bloq' || r.resultado === 'venc' || r.resultado === 'agendfora');
  const dias = []; for (let t = a; t < b; t += 864e5) dias.push(isoOf(new Date(t)));
  const porDia = new Map(dias.map((d) => [d, 0])); ent.forEach((r) => { const k = isoOf(new Date(r.ts)); porDia.set(k, (porDia.get(k) || 0) + 1); });
  const porHora = new Array(24).fill(0); ent.forEach((r) => porHora[new Date(r.ts).getHours()]++);
  const freq = new Map(); entV.forEach((r) => { const f = freq.get(r.placa) || { placa: r.placa, nome: r.nome, n: 0 }; f.n++; f.nome = r.nome || f.nome; freq.set(r.placa, f); });
  // permanência: liga cada entrada à saída seguinte da mesma placa/pessoa
  const aberto = new Map(), perm = [];
  for (const r of rows) { if (r.tipo === 'entrada') aberto.set(r.chave || r.placa, r); else { const e = aberto.get(r.chave || r.placa); if (e) { perm.push({ e, ms: r.ts - e.ts }); aberto.delete(r.chave || r.placa); } } }
  const media = (arr) => (arr.length ? arr.reduce((s, x) => s + x.ms, 0) / arr.length : 0);
  const permVis = perm.filter((x) => x.e.kind === 'pessoa' || ['nao', 'agend', 'agendfora'].includes(x.e.resultado));
  const pico = porHora.indexOf(Math.max(...porHora));
  return {
    rows, ent, sai, entV, entP, visit, naoCad, ocorr, dias, porDia, porHora, pico,
    top: [...freq.values()].sort((x, y) => y.n - x.n).slice(0, 10),
    bloq: rows.filter((r) => r.resultado === 'bloq').length, alertas: rows.filter((r) => r.alerta).length,
    mediaPerm: media(perm), mediaVis: media(permVis),
  };
}
function barChart(labels, values, { titulo, destacarMax = true, cada = 1 } = {}) {
  const W = 400, H = 170, L = 24, R = 6, T = 16, B = 22, n = values.length || 1;
  const max = Math.max(1, ...values), step = max <= 5 ? 1 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step, bw = (W - L - R) / n, y = (v) => T + (H - T - B) * (1 - v / top);
  const iMax = values.indexOf(Math.max(...values));
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  values.forEach((v, i) => {
    const x = L + i * bw + bw * 0.15, w = bw * 0.7, h = y(0) - y(v);
    if (v) g += `<rect class="bar ${destacarMax && i === iMax ? 'peak' : ''}" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"><title>${esc(labels[i])}: ${v}</title></rect>`;
    if (destacarMax && i === iMax && v) g += `<text class="v" x="${(x + w / 2).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" text-anchor="middle">${v}</text>`;
    if (i % cada === 0) g += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(labels[i])}</text>`;
  });
  return `<div class="chart"><h4>${esc(titulo)}</h4><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">${g}</svg></div>`;
}
async function renderRelatorios() {
  const box = $('#rptBox'); $('#rptCustom').hidden = RPT.per !== 'custom';
  $$('#rptPer .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.p === RPT.per));
  const [a, b, rot] = rptPeriodo();
  box.innerHTML = '<p class="count"><span class="spin"></span> Calculando…</p>';
  let rows;
  try { rows = await Dados.registrosPeriodo(a, b); } catch (e) { box.innerHTML = `<div class="note">${esc(mensagemErro(e))}</div>`; return; }
  const D = rptCalc(rows, a, b); RPT.dados = { D, a, b, rot };
  const cadaDia = D.dias.length > 8 ? Math.ceil(D.dias.length / 7) : 1;
  box.innerHTML = `
    <p class="count">${esc(rot)}: ${fmtD(isoOf(new Date(a)))} a ${fmtD(isoOf(new Date(b - 1)))} · ${D.rows.length} registros</p>
    <div class="stats">
      <div class="stat"><b>${D.entV.length}</b><span>Entradas de veículos</span></div>
      <div class="stat"><b>${D.entP.length}</b><span>Entradas de pedestres</span></div>
      <div class="stat ${D.naoCad.length ? 'warn' : ''}"><b>${D.visit.length}</b><span>Visitantes (veíc. + ped.)</span></div>
      <div class="stat ${D.bloq + D.alertas ? 'bad' : ''}"><b>${D.bloq + D.alertas}</b><span>Bloqueios e alertas</span></div>
    </div>
    ${barChart(D.dias.map((d) => d.slice(8, 10) + '/' + d.slice(5, 7)), D.dias.map((d) => D.porDia.get(d) || 0), { titulo: 'Entradas por dia', cada: cadaDia })}
    ${barChart(D.porHora.map((_, h) => pad(h) + 'h'), D.porHora, { titulo: `Entradas por hora${D.ent.length ? ' — pico às ' + pad(D.pico) + 'h' : ''}`, cada: 4 })}
    <div class="stats">
      <div class="stat"><b>${D.sai.length}</b><span>Saídas</span></div>
      <div class="stat"><b>${D.naoCad.length}</b><span>Veículos não cadastrados</span></div>
      <div class="stat"><b>${D.mediaPerm ? fmtDur(D.mediaPerm) : '—'}</b><span>Permanência média</span></div>
      <div class="stat"><b>${D.mediaVis ? fmtDur(D.mediaVis) : '—'}</b><span>Permanência de visitantes</span></div>
    </div>
    <h3 class="sec">Ocorrências</h3>
    ${D.ocorr.length ? `<div class="tablewrap"><table class="rtable"><thead><tr><th>Data</th><th>Placa / pessoa</th><th>Situação</th><th>Obs.</th></tr></thead><tbody>
      ${D.ocorr.slice(-60).reverse().map((r) => `<tr><td>${fmtDT(r.ts)}</td><td>${esc(r.placa || r.nome)}</td><td>${r.alerta ? 'Lista de alerta' : esc(RES_TXT[r.resultado] || '')}</td><td>${esc(r.obs || '')}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">Nenhum bloqueio, alerta ou cadastro vencido no período.</p>'}
    <h3 class="sec">Veículos mais frequentes</h3>
    ${D.top.length ? `<div class="tablewrap"><table class="rtable"><thead><tr><th>Placa</th><th>Responsável</th><th class="n">Entradas</th></tr></thead><tbody>
      ${D.top.map((t) => `<tr><td>${esc(t.placa)}</td><td>${esc(t.nome || '—')}</td><td class="n">${t.n}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Sem entradas de veículos no período.</p>'}
    <div class="btnrow"><button class="btn primary" id="rptPdf" type="button">Exportar PDF</button><button class="btn" id="rptXls" type="button">Exportar Excel</button></div>`;
  $('#rptPdf').onclick = rptPDF; $('#rptXls').onclick = rptXLS;
}
function rptLinhas(D) {
  return D.rows.map((r) => [fmtD(isoOf(new Date(r.ts))), fmtH(r.ts), r.tipo === 'entrada' ? 'Entrada' : 'Saída', r.kind === 'pessoa' ? 'Pedestre' : 'Veículo',
    r.placa || '', r.nome || '', r.documento || '', r.veiculo || '', r.alerta ? 'Lista de alerta' : (RES_TXT[r.resultado] || ''), r.sentinela || '', r.obs || r.destino || '']);
}
const RPT_COLS = ['Data', 'Hora', 'Movimento', 'Tipo', 'Placa', 'Nome', 'Documento', 'Veículo', 'Situação', 'Sentinela', 'Obs./destino'];
async function rptXLS() {
  const { D, a, b, rot } = RPT.dados;
  try { await loadScript(LIBS.xlsx); } catch (e) { toast(e.message, 4000); return; }
  const wb = XLSX.utils.book_new();
  const resumo = [['Relatório de acesso — Portão APMG'], [rot, fmtD(isoOf(new Date(a))) + ' a ' + fmtD(isoOf(new Date(b - 1)))], [],
    ['Entradas de veículos', D.entV.length], ['Entradas de pedestres', D.entP.length], ['Saídas', D.sai.length], ['Visitantes', D.visit.length],
    ['Veículos não cadastrados', D.naoCad.length], ['Alertas de bloqueio', D.bloq], ['Lista de alerta', D.alertas],
    ['Horário de pico', D.ent.length ? pad(D.pico) + 'h' : '—'], ['Permanência média', D.mediaPerm ? fmtDur(D.mediaPerm) : '—'], ['Permanência de visitantes', D.mediaVis ? fmtDur(D.mediaVis) : '—']];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Data', 'Entradas'], ...D.dias.map((d) => [fmtD(d), D.porDia.get(d) || 0])]), 'Por dia');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Hora', 'Entradas'], ...D.porHora.map((v, h) => [pad(h) + 'h', v])]), 'Por hora');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Data', 'Hora', 'Placa/pessoa', 'Situação', 'Obs.'], ...D.ocorr.map((r) => [fmtD(isoOf(new Date(r.ts))), fmtH(r.ts), r.placa || r.nome, r.alerta ? 'Lista de alerta' : RES_TXT[r.resultado] || '', r.obs || ''])]), 'Ocorrências');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([RPT_COLS, ...rptLinhas(D)]), 'Registros');
  XLSX.writeFile(wb, `relatorio-portao-${isoOf(new Date(a))}_${isoOf(new Date(b - 1))}.xlsx`);
}
async function rptPDF() {
  const { D, a, b, rot } = RPT.dados;
  toast('Gerando PDF…', 6000);
  try { await loadScript(LIBS.jspdf); await loadScript(LIBS.autotable); } catch (e) { toast(e.message, 4000); return; }
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }); const W = 210;
  const azul = [20, 33, 48], amarelo = [242, 183, 5];
  doc.setFillColor(...azul); doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Relatório de acesso — Portão APMG', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(`${rot}: ${fmtD(isoOf(new Date(a)))} a ${fmtD(isoOf(new Date(b - 1)))}   ·   Gerado em ${fmtD(hojeISO())} ${fmtH(Date.now())}${CFG.sentinela ? ' por ' + CFG.sentinela : ''}`, 14, 20);
  doc.setTextColor(20);
  doc.autoTable({
    startY: 32, theme: 'grid', head: [['Indicador', 'Valor']], headStyles: { fillColor: azul }, styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' } }, margin: { left: 14, right: 110 },
    body: [['Entradas de veículos', D.entV.length], ['Entradas de pedestres', D.entP.length], ['Saídas', D.sai.length], ['Visitantes', D.visit.length], ['Veículos não cadastrados', D.naoCad.length],
      ['Alertas de bloqueio', D.bloq], ['Lista de alerta', D.alertas], ['Horário de pico', D.ent.length ? pad(D.pico) + 'h' : '—'], ['Permanência média', D.mediaPerm ? fmtDur(D.mediaPerm) : '—'], ['Permanência de visitantes', D.mediaVis ? fmtDur(D.mediaVis) : '—']],
  });
  // gráfico por hora
  const gx = 110, gy = 34, gw = 86, gh = 50, mx = Math.max(1, ...D.porHora);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Entradas por hora', gx, gy - 2); doc.setFont('helvetica', 'normal');
  doc.setDrawColor(200); doc.line(gx, gy + gh, gx + gw, gy + gh);
  D.porHora.forEach((v, h) => {
    const bw = gw / 24, bh = (v / mx) * (gh - 4);
    doc.setFillColor(...(h === D.pico && v ? [245, 165, 36] : amarelo)); if (v) doc.rect(gx + h * bw + 0.4, gy + gh - bh, bw - 0.8, bh, 'F');
    if (h % 3 === 0) { doc.setFontSize(6); doc.text(pad(h), gx + h * bw + bw / 2, gy + gh + 3.5, { align: 'center' }); }
  });
  let y = Math.max(doc.lastAutoTable.finalY, gy + gh + 6) + 8;
  const sec = (t) => { if (y > 260) { doc.addPage(); y = 18; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, 14, y); doc.setFont('helvetica', 'normal'); y += 3; };
  sec('Entradas por dia');
  doc.autoTable({ startY: y, theme: 'striped', head: [['Data', 'Entradas']], headStyles: { fillColor: azul }, styles: { fontSize: 8 }, margin: { left: 14, right: 120 },
    body: D.dias.map((d) => [fmtD(d), D.porDia.get(d) || 0]) });
  y = doc.lastAutoTable.finalY + 8; sec('Ocorrências');
  doc.autoTable({ startY: y, theme: 'striped', head: [['Data', 'Hora', 'Placa / pessoa', 'Situação', 'Obs.']], headStyles: { fillColor: azul }, styles: { fontSize: 8 },
    body: D.ocorr.length ? D.ocorr.map((r) => [fmtD(isoOf(new Date(r.ts))), fmtH(r.ts), r.placa || r.nome, r.alerta ? 'Lista de alerta' : RES_TXT[r.resultado] || '', r.obs || '']) : [['—', '', 'Nenhuma ocorrência no período', '', '']] });
  y = doc.lastAutoTable.finalY + 8; sec('Veículos mais frequentes');
  doc.autoTable({ startY: y, theme: 'striped', head: [['Placa', 'Responsável', 'Entradas']], headStyles: { fillColor: azul }, styles: { fontSize: 8 }, body: D.top.map((t) => [t.placa, t.nome || '—', t.n]) });
  doc.addPage('a4', 'landscape'); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Registros do período', 14, 14);
  doc.autoTable({ startY: 18, theme: 'grid', head: [RPT_COLS], headStyles: { fillColor: azul }, styles: { fontSize: 7, cellPadding: 1.2 }, body: rptLinhas(D) });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Portão APMG · página ${i} de ${n} · documento de uso interno`, 14, doc.internal.pageSize.getHeight() - 6); }
  doc.save(`relatorio-portao-${isoOf(new Date(a))}_${isoOf(new Date(b - 1))}.pdf`);
  $('#toast').hidden = true;
}
