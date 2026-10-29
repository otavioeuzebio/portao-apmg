/* Câmera e leitura de placas (Tesseract.js no próprio aparelho).
   Melhorias: duas variações de imagem por quadro (contraste e preto-e-branco),
   votação entre quadros, zoom da câmera, lanterna e recorte da placa lida.
   Chama window.onPlacaLida(placa, recorteDataURL, origem) e usa window.placaConhecida(p). */
"use strict";
const Cam = {
  stream: null, worker: null, busy: false, scanning: false, torch: false, wake: null, frame: 0,
  votos: new VotacaoPlacas(), recortes: new Map(), inicio: 0, melhorAtual: null,
  el() { return { video: $('#video'), guide: $('#guide'), status: $('#camStatus') }; },

  async getWorker() {
    if (this.worker) return this.worker;
    this.status('Carregando leitor de placas… (só demora na 1ª vez)');
    await loadScript(LIBS.tess);
    this.worker = await Tesseract.createWorker('eng', 1);
    await this.worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', tessedit_pageseg_mode: '7' });
    return this.worker;
  },
  status(t, tap = false) {
    const s = $('#camStatus'); s.textContent = t; s.hidden = !t; s.classList.toggle('tap', tap);
  },
  votosUI(sc) {
    const n = Math.max(0, Math.min(5, Math.round((sc || 0) / 0.55)));
    $('#votes').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('');
    $('#votes').hidden = !this.scanning;
  },

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Este navegador não libera a câmera. Use "Ler de uma foto".'); return; }
    try { this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
    catch (e) { toast('Câmera bloqueada. Permita o acesso à câmera nas configurações do navegador.', 4500); return; }
    const { video, guide } = this.el();
    video.srcObject = this.stream; await video.play().catch(() => {});
    $('#camIdle').hidden = true; guide.hidden = false; $('#btnStop').hidden = false;
    const tr = this.stream.getVideoTracks()[0];
    try {
      const caps = tr.getCapabilities ? tr.getCapabilities() : {};
      $('#btnTorch').hidden = !caps.torch;
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const z = $('#zoomIn'); z.min = caps.zoom.min; z.max = Math.min(caps.zoom.max, 8); z.step = caps.zoom.step || 0.1;
        z.value = (tr.getSettings && tr.getSettings().zoom) || caps.zoom.min; $('#zoomRow').hidden = false;
      }
    } catch (e) { /* sem recursos extras */ }
    try { this.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* tela pode apagar */ }
    try { await this.getWorker(); } catch (e) { this.status(e.message); return; }
    this.resume(true);
  },
  stop() {
    this.scanning = false; const { video, guide } = this.el();
    guide.classList.remove('scan');
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
    video.srcObject = null; $('#camIdle').hidden = false; guide.hidden = true; $('#btnStop').hidden = true;
    $('#btnTorch').hidden = true; $('#zoomRow').hidden = true; $('#votes').hidden = true; this.torch = false; this.status('');
    try { this.wake && this.wake.release(); } catch (e) { /* já liberado */ }
    this.wake = null;
  },
  pause() { this.scanning = false; this.el().guide.classList.remove('scan'); $('#votes').hidden = true; },
  resume(force) {
    if (!this.stream || (this.scanning && !force)) return;
    this.scanning = true; this.el().guide.classList.add('scan');
    this.votos.reset(); this.recortes.clear(); this.inicio = Date.now(); this.melhorAtual = null;
    this.status('Procurando placa…'); this.votosUI(0); this.loop();
  },
  async setTorch() {
    try { this.torch = !this.torch; await this.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: this.torch }] }); $('#btnTorch').textContent = this.torch ? 'Desligar lanterna' : 'Lanterna'; }
    catch (e) { toast('Lanterna indisponível neste celular'); }
  },
  async setZoom(v) { try { await this.stream.getVideoTracks()[0].applyConstraints({ advanced: [{ zoom: +v }] }); } catch (e) { /* ignora */ } },

  /* ---------- imagem ---------- */
  cinza(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const g = (a[i] * .299 + a[i + 1] * .587 + a[i + 2] * .114) | 0; a[i] = a[i + 1] = a[i + 2] = g; }
    return d;
  },
  /** Variação 0: estica o contraste. Variação 1: preto e branco (Otsu), letras escuras sobre fundo claro. */
  preprocess(ctx, w, h, variacao = 0) {
    const d = this.cinza(ctx, w, h), a = d.data, n = w * h, hist = new Uint32Array(256);
    for (let i = 0; i < a.length; i += 4) hist[a[i]]++;
    if (variacao === 0) {
      let lo = 0, hi = 255, acc = 0;
      for (lo = 0; lo < 255; lo++) { acc += hist[lo]; if (acc > n * .02) break; }
      acc = 0; for (hi = 255; hi > 0; hi--) { acc += hist[hi]; if (acc > n * .02) break; }
      const rng = Math.max(1, hi - lo);
      for (let i = 0; i < a.length; i += 4) { let v = (a[i] - lo) * 255 / rng; v = v < 0 ? 0 : v > 255 ? 255 : v; a[i] = a[i + 1] = a[i + 2] = v; }
    } else {
      let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sB = 0, wB = 0, max = 0, th = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
        sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
        if (between > max) { max = between; th = t; }
      }
      let escuros = 0; for (let i = 0; i < a.length; i += 4) if (a[i] <= th) escuros++;
      const inverter = escuros > n * 0.6; // fundo escuro: inverte para letras escuras
      for (let i = 0; i < a.length; i += 4) { let v = a[i] > th ? 255 : 0; if (inverter) v = 255 - v; a[i] = a[i + 1] = a[i + 2] = v; }
    }
    ctx.putImageData(d, 0, 0);
  },
  /** Recorta do vídeo a área do retângulo amarelo. */
  grab() {
    const { video, guide } = this.el(); const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
    const r = video.getBoundingClientRect(), g = guide.getBoundingClientRect(); const sc = Math.max(r.width / vw, r.height / vh);
    const ox = (r.width - vw * sc) / 2, oy = (r.height - vh * sc) / 2;
    const sx = Math.max(0, (g.left - r.left - ox) / sc), sy = Math.max(0, (g.top - r.top - oy) / sc);
    const sw = Math.min(vw - sx, g.width / sc), sh = Math.min(vh - sy, g.height / sc);
    const c = document.createElement('canvas'); c.width = 900; c.height = Math.round(900 * sh / sw);
    c.getContext('2d', { willReadFrequently: true }).drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  },
  async loop() {
    if (!this.scanning) return;
    if (!this.busy) {
      this.busy = true;
      try {
        const orig = this.grab();
        if (orig) {
          const variacao = this.frame++ % 2;
          const c = document.createElement('canvas'); c.width = orig.width; c.height = orig.height;
          const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(orig, 0, 0); this.preprocess(ctx, c.width, c.height, variacao);
          const { data } = await this.worker.recognize(c);
          this.handle(data.text, data.confidence, orig);
        }
      } catch (e) { /* quadro perdido */ }
      this.busy = false;
    }
    if (this.scanning) setTimeout(() => this.loop(), 120);
  },
  handle(text, conf, orig) {
    if (!this.scanning) return;
    const cands = extractPlates(text);
    if (cands.length) {
      this.votos.add(cands, conf);
      if (!this.recortes.has(cands[0].p) || cands[0].c === 0) {
        const t = document.createElement('canvas'); t.width = 360; t.height = Math.round(360 * orig.height / orig.width);
        t.getContext('2d').drawImage(orig, 0, 0, t.width, t.height); this.recortes.set(cands[0].p, t.toDataURL('image/jpeg', .75));
      }
    }
    const b = this.votos.melhor(window.placaConhecida || (() => false));
    this.votosUI(b ? b.s : 0);
    if (b && b.ok) { this.aceitar(b.p, 'camera'); return; }
    if (b) {
      this.melhorAtual = b.p;
      const longo = Date.now() - this.inicio > 6000;
      this.status(longo ? `Melhor leitura: ${b.p} — toque para consultar` : `Confirmando ${b.p}…`, longo);
    } else this.status(Date.now() - this.inicio > 8000 ? 'Aproxime, use o zoom ou a lanterna' : 'Procurando placa…');
  },
  aceitar(p, origem) {
    this.pause(); this.status('Placa lida: ' + p);
    const recorte = this.recortes.get(p) || this.recortes.get(altPlate(p)) || null;
    window.onPlacaLida(p, recorte, origem);
    sheetOnClose = () => setTimeout(() => this.resume(), 600);
  },
  tocarStatus() { if (this.melhorAtual && $('#camStatus').classList.contains('tap')) this.aceitar(this.melhorAtual, 'camera (confirmada)'); },

  /** Lê a placa numa foto inteira: procura palavras com cara de placa e recorta a melhor. */
  async lerFoto(file) {
    if (!file) return;
    toast('Lendo a placa na foto…', 9000);
    try {
      const url = await fileToDataURL(file); const im = await loadImg(url);
      const s = Math.min(1, 1800 / Math.max(im.width, im.height));
      const orig = document.createElement('canvas'); orig.width = Math.round(im.width * s); orig.height = Math.round(im.height * s);
      orig.getContext('2d').drawImage(im, 0, 0, orig.width, orig.height);
      const w = await this.getWorker(); this.status('');
      await w.setParameters({ tessedit_pageseg_mode: '11' });
      let melhores = [];
      for (const variacao of [0, 1]) {
        const c = document.createElement('canvas'); c.width = orig.width; c.height = orig.height;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(orig, 0, 0); this.preprocess(ctx, c.width, c.height, variacao);
        const { data } = await w.recognize(c);
        for (const ln of (data.lines || [])) for (const cd of extractPlates(ln.text)) melhores.push({ ...cd, bbox: ln.bbox, conf: ln.confidence });
        if (!melhores.length) for (const cd of extractPlates(data.text)) melhores.push({ ...cd, conf: data.confidence });
        if (melhores.some((m) => m.c === 0)) break;
      }
      await w.setParameters({ tessedit_pageseg_mode: '7' });
      $('#toast').hidden = true;
      if (!melhores.length) { toast('Nenhuma placa encontrada na foto. Tente mais perto ou digite a placa.', 4000); return; }
      const conhecida = window.placaConhecida || (() => false);
      melhores.sort((a, b) => (conhecida(b.p) - conhecida(a.p)) || (a.c - b.c) || ((b.conf || 0) - (a.conf || 0)));
      const pick = melhores[0]; let recorte = null;
      if (pick.bbox) {
        const { x0, y0, x1, y1 } = pick.bbox, padX = (x1 - x0) * 0.12, padY = (y1 - y0) * 0.5;
        const sx = Math.max(0, x0 - padX), sy = Math.max(0, y0 - padY), sw = Math.min(orig.width - sx, x1 - x0 + 2 * padX), sh = Math.min(orig.height - sy, y1 - y0 + 2 * padY);
        const t = document.createElement('canvas'); t.width = 360; t.height = Math.max(40, Math.round(360 * sh / sw));
        t.getContext('2d').drawImage(orig, sx, sy, sw, sh, 0, 0, t.width, t.height); recorte = t.toDataURL('image/jpeg', .8);
      }
      window.onPlacaLida(pick.p, recorte, 'foto');
    } catch (e) { toast(e.message || 'Não foi possível ler a foto', 4000); }
  },
};
