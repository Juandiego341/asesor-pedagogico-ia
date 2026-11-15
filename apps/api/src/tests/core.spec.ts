import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGrade, normalizeWeights, parseRubricCsv, fromExtraction, validateRubric, RubricContent } from '../rubrics/rubric';
import { checkCitations, checkQuote, norm } from '../evaluations/citations';
import { readCodeZip, parseGithubUrl } from '../evidence/extract';
import { verifyCode } from '../sandbox/code-check';
import AdmZip from 'adm-zip';

const rubric: RubricContent = {
  title: 'R', competencies: [{ id: 'C1', name: 'Técnica', description: '' }],
  criteria: [
    { id: 'K1', competencyId: 'C1', name: 'A', description: '', weight: 60, levels: [{ id: 'H', name: 'Alto', score: 5, descriptor: 'x' }, { id: 'L', name: 'Bajo', score: 2, descriptor: 'y' }] },
    { id: 'K2', competencyId: 'C1', name: 'B', description: '', weight: 40, levels: [{ id: 'H', name: 'Alto', score: 4.5, descriptor: 'x' }, { id: 'L', name: 'Bajo', score: 1, descriptor: 'y' }] },
  ],
};

test('la nota se calcula con las ponderaciones de la rúbrica', () => {
  assert.equal(computeGrade(rubric, { K1: 'H', K2: 'H' }).grade, 4.8); // 0.6*5 + 0.4*4.5 = 4.8
  assert.equal(computeGrade(rubric, { K1: 'L', K2: 'H' }).grade, 3.0); // 1.2 + 1.8
  assert.equal(computeGrade(rubric, { K1: 'L', K2: 'L' }).grade, 1.6);
});

test('un nivel inexistente aporta 0 y nunca supera 5', () => {
  const r = computeGrade(rubric, { K1: 'X' });
  assert.equal(r.grade, 0);
  assert.equal(r.rows[0].levelName, 'Sin nivel válido');
});

test('detecta ponderaciones que no suman 100 y las normaliza', () => {
  const bad = { ...rubric, criteria: rubric.criteria.map((c) => ({ ...c, weight: 30 })) };
  const v = validateRubric(bad);
  assert.ok(v.issues.some((i) => i.fix === 'normalize_weights' && i.severity === 'error'));
  const fixed = normalizeWeights(bad);
  assert.equal(fixed.criteria.reduce((s, c) => s + c.weight, 0), 100);
  assert.equal(validateRubric(fixed).issues.filter((i) => i.severity === 'error').length, 0);
});

test('detecta competencias inexistentes, niveles insuficientes y duplicados', () => {
  const bad = { ...rubric, criteria: [{ ...rubric.criteria[0], competencyId: 'NO', levels: [rubric.criteria[0].levels[0]] }, { ...rubric.criteria[1], id: 'K1' }] };
  const msgs = validateRubric(bad).issues.map((i) => i.message).join(' | ');
  assert.match(msgs, /competencia inexistente/);
  assert.match(msgs, /al menos 2 niveles/);
  assert.match(msgs, /duplicado/);
});

test('importa rúbricas en CSV', () => {
  const csv = 'competencia;criterio;descripcion;peso;nivel;valor;descriptor\nC;Uno;d;50;Alto;5;a\nC;Uno;d;50;Bajo;1;b\nC;Dos;d;50;Alto;5;a\nC;Dos;d;50;Bajo;1;b';
  const r = fromExtraction(parseRubricCsv(csv));
  assert.equal(r.criteria.length, 2);
  assert.equal(validateRubric(r).issues.filter((i) => i.severity === 'error').length, 0);
});

test('verifica citas literales, parciales e inventadas', () => {
  const corpus = norm('Usamos la distancia Manhattan, que es admisible porque nunca sobreestima el costo real del camino.');
  assert.equal(checkQuote('la distancia Manhattan, que es admisible', corpus).status, 'verificada');
  assert.equal(checkQuote('El estudiante implementó una red neuronal convolucional profunda con PyTorch', corpus).status, 'no_encontrada');
  const r = checkCitations([{ criterionId: 'K1', evidence: [{ quote: 'Manhattan, que es admisible porque nunca sobreestima', source: 'informe', location: 'p1' }] }], 'Usamos la distancia Manhattan, que es admisible porque nunca sobreestima el costo');
  assert.equal(r.verified, 1);
});

test('lee ZIP ignorando rutas inseguras y carpetas de dependencias', () => {
  const z = new AdmZip();
  z.addFile('proj/main.py', Buffer.from('print(1)'));
  z.addFile('proj/node_modules/x.js', Buffer.from('x'));
  const b = readCodeZip(z.toBuffer());
  assert.deepEqual(b.files.map((f) => f.path), ['main.py']);
});

test('reconoce enlaces de GitHub', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/a/b'), { owner: 'a', repo: 'b', ref: undefined });
  assert.equal(parseGithubUrl('https://github.com/a/b/tree/dev')?.ref, 'dev');
  assert.equal(parseGithubUrl('https://gitlab.com/a/b'), null);
});

test('sandbox: detecta errores de sintaxis, ejecuta pruebas y bloquea la red', async () => {
  const files = [
    { path: 'ok.py', content: 'def f():\n    return 1\n', size: 20, lang: 'python' },
    { path: 'malo.py', content: 'def f(:\n', size: 8, lang: 'python' },
    { path: 'test_red.py', content: 'import socket\n\ndef test_sin_red():\n    try:\n        socket.create_connection(("1.1.1.1", 80), timeout=2)\n        assert False\n    except OSError:\n        pass\n', size: 100, lang: 'python' },
  ];
  const r = await verifyCode(files);
  assert.equal(r.syntax.errors.length, 1);
  assert.equal(r.syntax.errors[0].path, 'malo.py');
  if (r.tests.ran) assert.equal(r.tests.failed, 0, r.tests.output);
});
