/* Camada de dados.
   Modo "local": tudo no IndexedDB deste aparelho.
   Modo "nuvem": Firestore (projeto próprio do Portão) com cache offline — todos os celulares
   da guarda veem o mesmo cadastro, lista de alerta, agendados e livro.
   O resto do app só usa Dados.V / A / G / R, Dados.salvar(), Dados.apagar() e Dados.addRegistro(). */
"use strict";
const NUVEM = { veiculos: 'portaoVeiculos', registros: 'portaoRegistros', alertas: 'portaoAlertas', agendados: 'portaoAgendados', viaturas: 'portaoViaturas', pontos: 'portaoPontos' };
const CHAVE = { veiculos: 'placa', alertas: 'placa', agendados: 'id', viaturas: 'id', pontos: 'id' };
/** Configuração do posto compartilhada entre os celulares (vagas, ronda). */
const CONF_PADRAO = { vagasVisitantes: 0, rondaMin: 120 };
const JANELA_DIAS = 45; // livro carregado em memória (o resto é buscado sob demanda)

const Dados = {
  modo: null, prontoR: false, user: null, papel: '', fb: null, idb: null, online: navigator.onLine, pendente: false,
  V: new Map(), A: new Map(), G: new Map(), T: new Map(), P: new Map(), C: { ...CONF_PADRAO }, R: [], geral: false,
  subs: [], unsub: [],
  on(f) { this.subs.push(f); },
  emit(what) { for (const f of this.subs) { try { f(what); } catch (e) { console.error(e); } } },
  mapa(col) { return { veiculos: this.V, alertas: this.A, agendados: this.G, viaturas: this.T, pontos: this.P }[col]; },

  /* ---------- IndexedDB ---------- */
  abrirIDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('portao-apmg', 4);
      r.onupgradeneeded = () => {
        const d = r.result, have = new Set(d.objectStoreNames);
        if (!have.has('veiculos')) d.createObjectStore('veiculos', { keyPath: 'placa' });
        if (!have.has('registros')) d.createObjectStore('registros', { keyPath: 'id', autoIncrement: true });
        if (!have.has('config')) d.createObjectStore('config', { keyPath: 'k' });
        if (!have.has('alertas')) d.createObjectStore('alertas', { keyPath: 'placa' });
        if (!have.has('agendados')) d.createObjectStore('agendados', { keyPath: 'id' });
        if (!have.has('viaturas')) d.createObjectStore('viaturas', { keyPath: 'id' });
        if (!have.has('pontos')) d.createObjectStore('pontos', { keyPath: 'id' });
      };
      r.onsuccess = () => { this.idb = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  idbReq(store, mode, fn) {
    return new Promise((res, rej) => {
      const tx = this.idb.transaction(store, mode); const st = tx.objectStore(store); let out;
      const q = fn(st); if (q) q.onsuccess = () => (out = q.result);
      tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error);
    });
  },
  idbAll(s) { return this.idbReq(s, 'readonly', (st) => st.getAll()); },
  idbPutMany(s, arr) { return this.idbReq(s, 'readwrite', (st) => { arr.forEach((v) => st.put(v)); }); },
  idbDelMany(s, ks) { return this.idbReq(s, 'readwrite', (st) => { ks.forEach((k) => st.delete(k)); }); },
  idbClear(s) { return this.idbReq(s, 'readwrite', (st) => st.clear()); },
  async cfgGet() { const r = await this.idbReq('config', 'readonly', (st) => st.get('cfg')); return r ? r.v : null; },
  cfgSet(v) { return this.idbReq('config', 'readwrite', (st) => st.put({ k: 'cfg', v })); },
  /** Dados que existem neste aparelho (para enviar à nuvem). */
  async contarLocal() {
    const [v, a, g, t, p] = await Promise.all([this.idbAll('veiculos'), this.idbAll('alertas'), this.idbAll('agendados'), this.idbAll('viaturas'), this.idbAll('pontos')]);
    return { veiculos: v.filter((x) => !x.exemplo), alertas: a.filter((x) => !x.exemplo), agendados: g.filter((x) => !x.exemplo), viaturas: t.filter((x) => !x.exemplo), pontos: p.filter((x) => !x.exemplo) };
  },

  /* ---------- Firebase ---------- */
  configurado() { return !!(typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey); },
  async carregarFB() {
    if (this.fb) return this.fb;
    const B = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}`;
    const [app, auth, fs] = await Promise.all([import(B + '/firebase-app.js'), import(B + '/firebase-auth.js'), import(B + '/firebase-firestore.js')]);
    const inst = app.initializeApp(FIREBASE_CONFIG, 'portao'); // app com nome próprio: login separado do da Agenda no mesmo navegador
    const a = auth.getAuth(inst); a.languageCode = 'pt';
    let db;
    const banco = typeof FIREBASE_DB === 'string' && FIREBASE_DB ? FIREBASE_DB : '(default)';
    try { db = fs.initializeFirestore(inst, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }, banco); }
    catch (e) { db = fs.getFirestore(inst, banco); }
    this.fb = { auth, fs, a, db };
    return this.fb;
  },
  ehAdmin(email) { return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(email || '').toLowerCase()); },

  /* ---------- início ---------- */
  async iniciarLocal() {
    this.modo = 'local'; this.papel = 'local';
    const [v, a, g, r, t, pt, cf] = await Promise.all([this.idbAll('veiculos'), this.idbAll('alertas'), this.idbAll('agendados'), this.idbAll('registros'), this.idbAll('viaturas'), this.idbAll('pontos'),
      this.idbReq('config', 'readonly', (st) => st.get('compartilhada'))]);
    this.T = new Map(t.map((x) => [x.id, x])); this.P = new Map(pt.map((x) => [x.id, x])); this.C = { ...CONF_PADRAO, ...(cf ? cf.v : {}) };
    this.V = new Map(v.map((x) => [x.placa, x])); this.A = new Map(a.map((x) => [x.placa, x]));
    this.G = new Map(g.map((x) => [x.id, x])); this.R = r; this.prontoR = true;
    this.emit('tudo');
  },
  async iniciarNuvem(user, papel) {
    this.modo = 'nuvem'; this.user = user; this.papel = papel;
    const { fs, db } = await this.carregarFB();
    this.unsub.forEach((u) => u()); this.unsub = [];
    this.V = new Map(); this.A = new Map(); this.G = new Map(); this.T = new Map(); this.P = new Map(); this.C = { ...CONF_PADRAO }; this.R = []; this.prontoR = false;
    const ouvir = (col, mapa, chave) => {
      this.unsub.push(fs.onSnapshot(fs.collection(db, NUVEM[col]), { includeMetadataChanges: true }, (snap) => {
        snap.docChanges().forEach((ch) => {
          if (ch.type === 'removed') mapa.delete(ch.doc.id);
          else mapa.set(ch.doc.id, { ...ch.doc.data(), [chave]: ch.doc.id });
        });
        this.marcarSync(snap.metadata);
        this.emit(col);
      }, (err) => this.erroNuvem(err)));
    };
    ouvir('veiculos', this.V, 'placa'); ouvir('alertas', this.A, 'placa'); ouvir('agendados', this.G, 'id'); ouvir('viaturas', this.T, 'id'); ouvir('pontos', this.P, 'id');
    this.unsub.push(fs.onSnapshot(fs.doc(db, 'portaoConfig', 'posto'), (d) => { this.C = { ...CONF_PADRAO, ...(d.exists() ? d.data() : {}) }; this.emit('config'); }, (err) => this.erroNuvem(err)));
    const desde = Date.now() - JANELA_DIAS * 864e5;
    const reg = new Map();
    this.unsub.push(fs.onSnapshot(fs.query(fs.collection(db, NUVEM.registros), fs.where('ts', '>=', desde)), { includeMetadataChanges: true }, (snap) => {
      snap.docChanges().forEach((ch) => { if (ch.type === 'removed') reg.delete(ch.doc.id); else reg.set(ch.doc.id, { ...ch.doc.data(), id: ch.doc.id }); });
      this.R = [...reg.values()]; this.prontoR = true;
      this.marcarSync(snap.metadata);
      this.emit('registros');
    }, (err) => this.erroNuvem(err)));
  },
  marcarSync(meta) {
    const antes = this.pendente + ':' + this.online;
    this.pendente = !!meta.hasPendingWrites; this.online = navigator.onLine && !meta.fromCache;
    if (antes !== this.pendente + ':' + this.online) this.emit('sync');
  },
  erroNuvem(err) {
    console.error(err);
    if (err && err.code === 'permission-denied') this.emit('negado');
  },
  falhaGravar(e) { console.error(e); toast('A nuvem recusou a gravação: ' + mensagemErro(e), 6000); },
  parar() { this.unsub.forEach((u) => u()); this.unsub = []; },

  /* ---------- gravação ---------- */
  limpar(obj) { const o = {}; for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = v; return o; },
  async salvar(col, obj) {
    const k = CHAVE[col]; if (!obj[k]) obj[k] = novoId();
    obj = this.limpar(obj);
    if (this.modo === 'nuvem') {
      const { fs, db } = this.fb; const { [k]: id, ...rest } = obj;
      this.mapa(col).set(id, obj); this.emit(col);
      // sem await: com o cache offline a gravação só "termina" quando chega ao servidor
      fs.setDoc(fs.doc(db, NUVEM[col], id), rest).catch((e) => this.falhaGravar(e));
    } else {
      await this.idbPutMany(col, [obj]); this.mapa(col).set(obj[k], obj); this.emit(col);
    }
    return obj;
  },
  async salvarVarios(col, arr, progresso) {
    const k = CHAVE[col];
    arr = arr.map((o) => { if (!o[k]) o[k] = novoId(); return this.limpar(o); });
    if (this.modo === 'nuvem') {
      const { fs, db } = this.fb;
      for (let i = 0; i < arr.length; i += 200) {
        const b = fs.writeBatch(db);
        for (const o of arr.slice(i, i + 200)) { const { [k]: id, ...rest } = o; b.set(fs.doc(db, NUVEM[col], id), rest); }
        b.commit().catch((e) => this.falhaGravar(e)); if (progresso) progresso(Math.min(arr.length, i + 200), arr.length);
      }
      arr.forEach((o) => this.mapa(col).set(o[k], o));
    } else {
      await this.idbPutMany(col, arr); arr.forEach((o) => this.mapa(col).set(o[k], o));
    }
    this.emit(col);
  },
  /** Configuração compartilhada do posto (gestor). */
  async salvarConf(campos) {
    this.C = { ...this.C, ...campos }; this.emit('config');
    if (this.modo === 'nuvem') { const { fs, db } = this.fb; fs.setDoc(fs.doc(db, 'portaoConfig', 'posto'), campos, { merge: true }).catch((e) => this.falhaGravar(e)); }
    else await this.idbReq('config', 'readwrite', (st) => st.put({ k: 'compartilhada', v: this.C }));
  },
  /** Muda só alguns campos (a sentinela atualiza km e situação da viatura sem poder editar o resto). */
  async atualizar(col, id, campos) {
    const atual = this.mapa(col).get(id); if (!atual) return;
    const novo = { ...atual, ...campos }; this.mapa(col).set(id, novo); this.emit(col);
    if (this.modo === 'nuvem') { const { fs, db } = this.fb; fs.setDoc(fs.doc(db, NUVEM[col], id), campos, { merge: true }).catch((e) => this.falhaGravar(e)); }
    else await this.idbPutMany(col, [novo]);
  },
  async apagar(col, id) { return this.apagarVarios(col, [id]); },
  async apagarVarios(col, ids) {
    if (!ids.length) return;
    if (this.modo === 'nuvem') {
      const { fs, db } = this.fb;
      for (let i = 0; i < ids.length; i += 400) {
        const b = fs.writeBatch(db); ids.slice(i, i + 400).forEach((id) => b.delete(fs.doc(db, NUVEM[col], String(id)))); b.commit().catch((e) => this.falhaGravar(e));
      }
    } else await this.idbDelMany(col, ids);
    if (col === 'registros') { const s = new Set(ids.map(String)); this.R = this.R.filter((r) => !s.has(String(r.id))); }
    else ids.forEach((id) => this.mapa(col).delete(id));
    this.emit(col);
  },
  async addRegistro(rec) {
    rec = this.limpar({ ...rec, por: this.user ? this.user.email : '' });
    if (this.modo === 'nuvem') {
      const { fs, db } = this.fb; const ref = fs.doc(fs.collection(db, NUVEM.registros));
      const p = fs.setDoc(ref, rec);
      this.R.push({ ...rec, id: ref.id }); this.emit('registros');
      p.catch((e) => this.falhaGravar(e));
      return ref.id;
    }
    const id = await this.idbReq('registros', 'readwrite', (st) => st.add(rec));
    this.R.push({ ...rec, id }); this.emit('registros');
    return id;
  },
  /** Registros de um período [a, b) — usa a memória quando possível. */
  async registrosPeriodo(a, b) {
    const desde = Date.now() - JANELA_DIAS * 864e5 + 6e4;
    if (this.modo !== 'nuvem') { const all = await this.idbAll('registros'); return all.filter((r) => r.ts >= a && r.ts < b); }
    if (a >= desde) return this.R.filter((r) => r.ts >= a && r.ts < b);
    const { fs, db } = this.fb;
    const snap = await fs.getDocs(fs.query(fs.collection(db, NUVEM.registros), fs.where('ts', '>=', a), fs.where('ts', '<', b)));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  },

  /* ---------- contas (modo nuvem) ---------- */
  async situacao(user) {
    const email = String(user.email || '').toLowerCase();
    if (this.ehAdmin(email)) return { s: 'liberado', papel: 'admin' };
    const chave = 'portao-apmg:acesso:' + user.uid;
    try {
      const { fs, db } = await this.carregarFB();
      const snap = await fs.getDoc(fs.doc(db, 'portaoAcessos', email));
      let r;
      if (snap.exists()) {
        const d = snap.data();
        r = { s: d.ativo === false ? 'bloqueado' : 'liberado', papel: d.papel || 'sentinela', geral: !!d.geral, dispositivos: d.dispositivos || [], criadoPeloAdmin: !!d.criadoPeloAdmin, nome: d.nome || '' };
      }
      else {
        r = { s: 'pendente', papel: '' };
        if (user.emailVerified) await fs.setDoc(fs.doc(db, 'portaoPedidos', email), { email, criadoEm: fs.serverTimestamp() }).catch(() => {});
      }
      try { localStorage.setItem(chave, JSON.stringify(r)); } catch (e) { /* sem armazenamento */ }
      return r;
    } catch (e) {
      try { const s = JSON.parse(localStorage.getItem(chave) || 'null'); if (s) return s; } catch (e2) { /* nada salvo */ }
      throw e;
    }
  },
  async listarAcessos() {
    const { fs, db } = this.fb;
    const [p, a] = await Promise.all([fs.getDocs(fs.collection(db, 'portaoPedidos')), fs.getDocs(fs.collection(db, 'portaoAcessos'))]);
    const acc = new Map(a.docs.map((d) => [d.id, d.data()]));
    return {
      pendentes: p.docs.map((d) => d.id).filter((e) => !acc.has(e)).sort(),
      contas: [...acc].map(([email, v]) => ({ email, ativo: v.ativo !== false, papel: v.papel || 'sentinela', nome: v.nome || '', geral: !!v.geral, dispositivos: v.dispositivos || [], maxDispositivos: v.maxDispositivos || 2, criadoPeloAdmin: !!v.criadoPeloAdmin }))
        .sort((x, y) => (y.geral - x.geral) || x.email.localeCompare(y.email)),
    };
  },
  async definirAcesso(email, dados) {
    const { fs, db } = this.fb; email = email.toLowerCase();
    await fs.setDoc(fs.doc(db, 'portaoAcessos', email), { ...dados, atualizadoEm: fs.serverTimestamp() }, { merge: true });
    await fs.deleteDoc(fs.doc(db, 'portaoPedidos', email)).catch(() => {});
  },
  /**
   * Cria a conta (e-mail e senha) sem derrubar o login do administrador: usa uma
   * segunda instância do Firebase só para isso. Se a conta já existir,
   * apenas libera o acesso — a pessoa continua com a senha que já tem.
   */
  async criarUsuario({ email, senha, nome, papel, geral, maxDispositivos }) {
    const { auth, fs, db } = this.fb; email = email.trim().toLowerCase();
    const B = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}`;
    const appMod = await import(B + '/firebase-app.js');
    const inst = appMod.initializeApp(FIREBASE_CONFIG, 'criador-' + Date.now());
    const a2 = auth.initializeAuth(inst, { persistence: auth.inMemoryPersistence });
    let jaExistia = false;
    try { await auth.createUserWithEmailAndPassword(a2, email, senha); await auth.signOut(a2); }
    catch (e) { if (e && e.code === 'auth/email-already-in-use') jaExistia = true; else throw e; }
    finally { appMod.deleteApp(inst).catch(() => {}); }
    await fs.setDoc(fs.doc(db, 'portaoAcessos', email), {
      ativo: true, papel: papel || 'sentinela', nome: nome || '', geral: !!geral, criadoPeloAdmin: true,
      ...(geral ? { maxDispositivos: maxDispositivos || 2, dispositivos: [] } : {}), atualizadoEm: fs.serverTimestamp(),
    }, { merge: true });
    await fs.deleteDoc(fs.doc(db, 'portaoPedidos', email)).catch(() => {});
    return { jaExistia };
  },
  async removerAcesso(email) {
    const { fs, db } = this.fb;
    await fs.deleteDoc(fs.doc(db, 'portaoAcessos', email)).catch(() => {});
    await fs.deleteDoc(fs.doc(db, 'portaoPedidos', email)).catch(() => {});
  },
};

function mensagemErro(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite a senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem internet. Conecte-se para entrar pela primeira vez.',
    'permission-denied': 'Sem permissão. Confira se as regras do Firestore foram publicadas e se sua conta foi liberada.',
    'unavailable': 'Sem internet no momento. Tente de novo mais tarde.',
  };
  return m[c] || ('Não foi possível concluir. ' + (e && e.message ? e.message : ''));
}
