import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { normPlate, validPlate, extractPlates, altPlate, plateDist, VotacaoPlacas } = createRequire(import.meta.url)('../js/placas.js');

test('valida padrão antigo e Mercosul', () => {
  assert.ok(validPlate('ABC1234'));
  assert.ok(validPlate('BRA2E19'));
  assert.ok(!validPlate('AB12345'));
  assert.equal(normPlate('abc-1d23'), 'ABC1D23');
});

test('corrige confusões comuns do OCR e ignora a faixa BRASIL', () => {
  assert.equal(extractPlates('BRASIL\nBRA2E19')[0].p, 'BRA2E19');
  assert.equal(extractPlates('8RA2E19')[0].p, 'BRA2E19');
  assert.equal(extractPlates('BRASIL BR 4BC1D23')[0].p, 'ABC1D23');
  assert.equal(extractPlates('ABC-1234')[0].p, 'ABC1234');
  assert.equal(extractPlates('RTA4C22.')[0].p, 'RTA4C22');
  assert.deepEqual(extractPlates('sem placa aqui'), []);
});

test('placa antiga e convertida são a mesma', () => {
  assert.equal(altPlate('ABC1234'), 'ABC1C34');
  assert.equal(altPlate('ABC1C34'), 'ABC1234');
  assert.equal(plateDist('BRA2E19', 'BRA2E18'), 1);
});

test('votação: exige leituras repetidas, menos para placa conhecida', () => {
  const v = new VotacaoPlacas();
  const t = 1000;
  v.add([{ p: 'XYZ1A23', c: 0 }], 85, t);
  assert.equal(v.melhor().ok, false, 'uma leitura não basta');
  v.add([{ p: 'XYZ1A23', c: 0 }], 85, t + 200);
  assert.equal(v.melhor().ok, false);
  assert.equal(v.melhor((p) => p === 'XYZ1A23').ok, true, 'conhecida aceita com 2 leituras');
  v.add([{ p: 'XYZ1A23', c: 0 }], 85, t + 400);
  assert.deepEqual([v.melhor().p, v.melhor().ok], ['XYZ1A23', true]);
  v.add([{ p: 'QQQ1A23', c: 0 }], 85, t + 9000);
  assert.equal(v.melhor().p, 'QQQ1A23', 'leituras antigas expiram');
});
