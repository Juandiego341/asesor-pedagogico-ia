import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Sandbox, SANDBOX_CAPS, isolationSummary } from './sandbox';
import type { CodeFile } from '../evidence/extract';

/** Analizador estático en Python: solo usa ast (no ejecuta el código del estudiante). */
const PY_ANALYZER = String.raw`
import ast, json, sys, os
res = {}
for path in json.load(open(sys.argv[1])):
    try:
        src = open(path, encoding='utf-8', errors='replace').read()
    except Exception as e:
        res[path] = {"ok": False, "error": str(e)}; continue
    try:
        tree = ast.parse(src, filename=path)
    except SyntaxError as e:
        res[path] = {"ok": False, "error": f"{e.msg} (línea {e.lineno})", "line": e.lineno}; continue
    funcs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    classes = [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
    imports = set()
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for a in n.names: imports.add(a.name.split('.')[0])
        elif isinstance(n, ast.ImportFrom) and n.module:
            imports.add(n.module.split('.')[0])
    branches = sum(isinstance(n, (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.BoolOp, ast.IfExp, ast.comprehension)) for n in ast.walk(tree))
    bare = sum(1 for n in ast.walk(tree) if isinstance(n, ast.ExceptHandler) and n.type is None)
    documented = sum(1 for f in funcs + classes if ast.get_docstring(f))
    long_funcs = [f.name for f in funcs if (getattr(f, 'end_lineno', f.lineno) - f.lineno) > 60]
    star = any(isinstance(n, ast.ImportFrom) and any(a.name == '*' for a in n.names) for n in ast.walk(tree))
    res[path] = {"ok": True, "functions": len(funcs), "classes": len(classes), "imports": sorted(imports),
                 "branches": branches, "bareExcept": bare, "documented": documented,
                 "longFunctions": long_funcs, "starImport": star}
print(json.dumps(res))
`;

const AI_LIBS = ['sklearn', 'tensorflow', 'torch', 'keras', 'transformers', 'langchain', 'langgraph', 'openai', 'anthropic', 'google', 'numpy', 'pandas', 'matplotlib', 'seaborn', 'cv2', 'nltk', 'spacy', 'xgboost', 'lightgbm', 'gymnasium', 'gym', 'streamlit', 'gradio', 'fastapi', 'flask', 'llama_index', 'chromadb', 'faiss', 'huggingface_hub', 'datasets', 'scipy', 'statsmodels', 'ultralytics', 'mediapipe', 'pydantic'];

const SECRET_PATTERNS: [string, RegExp][] = [
  ['Clave de OpenAI', /sk-[A-Za-z0-9_-]{20,}/],
  ['Clave de Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['Clave de Google', /AIza[0-9A-Za-z_-]{35}/],
  ['Token de GitHub', /gh[pousr]_[A-Za-z0-9]{30,}/],
  ['Clave AWS', /AKIA[0-9A-Z]{16}/],
  ['Contraseña en código', /(password|passwd|contrase(n|ñ)a)\s*=\s*['"][^'"]{4,}['"]/i],
];

export interface VerificationReport {
  ranAt: string;
  isolation: ReturnType<typeof isolationSummary>;
  inventory: { files: number; lines: number; byLanguage: Record<string, { files: number; lines: number }>; hasReadme: boolean; hasDependencies: boolean; hasTests: boolean; notebooks: number };
  syntax: { checked: number; passed: number; errors: { path: string; error: string }[] };
  staticAnalysis: { functions: number; classes: number; documentedRatio: number; bareExcept: number; longFunctions: string[]; starImports: string[]; aiLibraries: string[]; avgBranchesPerFile: number; comments: number };
  security: { findings: { path: string; type: string; line: number }[] };
  tests: { framework: string | null; ran: boolean; passed: number; failed: number; errors: number; output: string; timedOut: boolean; note?: string };
  score: { label: string; notes: string[] };
}

export async function verifyCode(files: CodeFile[]): Promise<VerificationReport> {
  const code = files.filter((f) => f.lang !== 'markdown' && f.lang !== 'text');
  const byLanguage: VerificationReport['inventory']['byLanguage'] = {};
  let lines = 0, comments = 0;
  for (const f of files) {
    const n = f.content.split('\n').length;
    lines += n;
    byLanguage[f.lang] ??= { files: 0, lines: 0 };
    byLanguage[f.lang].files++; byLanguage[f.lang].lines += n;
    if (['python', 'notebook', 'shell', 'r'].includes(f.lang)) comments += (f.content.match(/^\s*#(?! %%)/gm) || []).length;
    if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go'].includes(f.lang)) comments += (f.content.match(/^\s*(\/\/|\/\*|\*)/gm) || []).length;
  }
  const isTest = (p: string) => /(^|\/)(test_[^/]+\.py|[^/]+_test\.py|[^/]+\.(test|spec)\.(js|mjs|ts))$/.test(p) || /(^|\/)tests?\//.test(p);
  const report: VerificationReport = {
    ranAt: new Date().toISOString(),
    isolation: isolationSummary(),
    inventory: {
      files: files.length, lines, byLanguage,
      hasReadme: files.some((f) => /readme/i.test(f.path)),
      hasDependencies: files.some((f) => /(requirements\.txt|pyproject\.toml|package\.json|environment\.ya?ml|Pipfile)$/.test(f.path)),
      hasTests: files.some((f) => isTest(f.path)),
      notebooks: files.filter((f) => f.lang === 'notebook').length,
    },
    syntax: { checked: 0, passed: 0, errors: [] },
    staticAnalysis: { functions: 0, classes: 0, documentedRatio: 0, bareExcept: 0, longFunctions: [], starImports: [], aiLibraries: [], avgBranchesPerFile: 0, comments },
    security: { findings: [] },
    tests: { framework: null, ran: false, passed: 0, failed: 0, errors: 0, output: '', timedOut: false },
    score: { label: '', notes: [] },
  };

  for (const f of files) {
    f.content.split('\n').forEach((l, i) => {
      for (const [type, re] of SECRET_PATTERNS) if (re.test(l)) report.security.findings.push({ path: f.path, type, line: i + 1 });
    });
  }

  if (!code.length) { report.score = { label: 'Sin código analizable', notes: ['No se encontraron archivos de código fuente.'] }; return report; }

  // Para notebooks se analiza el código de las celdas convertido a .py
  const pyFiles = files.filter((f) => f.lang === 'python' || f.lang === 'notebook').map((f) => ({
    ...f, path: f.lang === 'notebook' ? f.path.replace(/\.ipynb$/, '.__nb__.py') : f.path,
    content: f.lang === 'notebook' ? notebookCodeOnly(f.content) : f.content,
  }));
  const jsFiles = files.filter((f) => f.lang === 'javascript' && !f.path.endsWith('.jsx'));
  const sbx = await Sandbox.create([...files.filter((f) => f.lang !== 'notebook'), ...pyFiles.filter((f) => f.path.endsWith('.__nb__.py'))]);
  try {
    if (pyFiles.length && SANDBOX_CAPS.python) {
            await writeFile(join(sbx.dir, '.__files.json'), JSON.stringify(pyFiles.slice(0, 300).map((f) => f.path)));
      await writeFile(join(sbx.dir, '.__analyzer.py'), PY_ANALYZER);
      const r = await sbx.run('python3', ['-I', '.__analyzer.py', '.__files.json'], { timeoutMs: 30_000 });
      try {
        const out = JSON.parse(r.stdout) as Record<string, any>;
        const libs = new Set<string>(); let documented = 0, defs = 0, branches = 0;
        for (const [path, a] of Object.entries(out)) {
          const shown = path.replace('.__nb__.py', '.ipynb');
          report.syntax.checked++;
          if (!a.ok) { report.syntax.errors.push({ path: shown, error: a.error }); continue; }
          report.syntax.passed++;
          report.staticAnalysis.functions += a.functions; report.staticAnalysis.classes += a.classes;
          report.staticAnalysis.bareExcept += a.bareExcept; documented += a.documented; defs += a.functions + a.classes; branches += a.branches;
          a.longFunctions.forEach((fn: string) => report.staticAnalysis.longFunctions.push(`${shown}:${fn}`));
          if (a.starImport) report.staticAnalysis.starImports.push(shown);
          a.imports.forEach((m: string) => AI_LIBS.includes(m) && libs.add(m));
        }
        report.staticAnalysis.aiLibraries = [...libs].sort();
        report.staticAnalysis.documentedRatio = defs ? Math.round((documented / defs) * 100) / 100 : 0;
        report.staticAnalysis.avgBranchesPerFile = report.syntax.passed ? Math.round((branches / report.syntax.passed) * 10) / 10 : 0;
      } catch {
        report.score.notes.push('No se pudo completar el análisis estático de Python: ' + (r.stderr || 'salida inválida').slice(0, 300));
      }
    }
    for (const f of jsFiles.slice(0, 40)) {
      const r = await sbx.run('node', ['--check', f.path], { timeoutMs: 10_000 });
      report.syntax.checked++;
      if (r.code === 0) report.syntax.passed++;
      else report.syntax.errors.push({ path: f.path, error: (r.stderr.split('\n').find((l) => /Error/.test(l)) || r.stderr).slice(0, 300) });
    }
    for (const f of files.filter((x) => x.lang === 'json' && !x.path.endsWith('.ipynb'))) {
      report.syntax.checked++;
      try { JSON.parse(f.content); report.syntax.passed++; } catch (e) { report.syntax.errors.push({ path: f.path, error: 'JSON inválido: ' + (e as Error).message }); }
    }

    // Pruebas unitarias del estudiante (si existen), dentro del sandbox
    const pyTests = files.some((f) => f.lang === 'python' && isTest(f.path));
    const jsTests = files.some((f) => /\.(test|spec)\.(js|mjs)$/.test(f.path));
    if (pyTests) {
      report.tests.framework = 'pytest';
      if (!SANDBOX_CAPS.pytest) report.tests.note = 'pytest no está instalado en el servidor';
      else {
        const r = await sbx.run('python3', ['-m', 'pytest', '-q', '--tb=line', '-p', 'no:cacheprovider', '--color=no'], { timeoutMs: 90_000, memMb: 1024, cpuSec: 60 });
        report.tests.ran = true; report.tests.timedOut = r.timedOut;
        report.tests.output = (r.stdout + '\n' + r.stderr).trim().slice(-4000);
        const m = (k: string) => Number((report.tests.output.match(new RegExp(`(\\d+) ${k}`)) || [])[1] || 0);
        report.tests.passed = m('passed'); report.tests.failed = m('failed'); report.tests.errors = m('errors?');
        if (r.timedOut) report.tests.note = 'Las pruebas superaron el tiempo límite';
      }
    } else if (jsTests) {
      report.tests.framework = 'node:test';
      const r = await sbx.run('node', ['--test'], { timeoutMs: 60_000 });
      report.tests.ran = true; report.tests.timedOut = r.timedOut;
      report.tests.output = (r.stdout + '\n' + r.stderr).trim().slice(-4000);
      report.tests.passed = Number((report.tests.output.match(/# pass (\d+)/) || [])[1] || 0);
      report.tests.failed = Number((report.tests.output.match(/# fail (\d+)/) || [])[1] || 0);
    } else {
      report.tests.note = 'La entrega no incluye pruebas unitarias';
    }
  } finally {
    await sbx.dispose();
  }

  const n = report.score.notes;
  const ok = report.syntax.checked ? report.syntax.passed / report.syntax.checked : 1;
  if (report.syntax.errors.length) n.push(`${report.syntax.errors.length} archivo(s) con errores de sintaxis.`);
  else n.push(`Sintaxis válida en ${report.syntax.passed} archivo(s).`);
  if (report.tests.ran) n.push(`Pruebas: ${report.tests.passed} aprobadas, ${report.tests.failed} fallidas${report.tests.errors ? `, ${report.tests.errors} con error` : ''}.`);
  if (!report.inventory.hasReadme) n.push('No incluye README.');
  if (!report.inventory.hasDependencies) n.push('No declara dependencias (requirements.txt, package.json…).');
  if (report.security.findings.length) n.push(`Posibles secretos expuestos en ${report.security.findings.length} línea(s).`);
  if (report.staticAnalysis.bareExcept) n.push(`${report.staticAnalysis.bareExcept} bloque(s) "except" sin tipo de excepción.`);
  report.score.label = ok === 1 && (!report.tests.ran || report.tests.failed + report.tests.errors === 0) ? 'Verificación técnica satisfactoria' : 'Verificación técnica con hallazgos';
  return report;
}

function notebookCodeOnly(nbText: string) {
  // nbText ya viene convertido por notebookToText: se conservan solo celdas de código y se comentan magias (!pip, %matplotlib)
  return nbText.split(/\n(?=# %% \[celda)/).filter((c) => c.includes('· código]')).map((c) =>
    c.split('\n').map((l) => (/^\s*[!%]/.test(l) ? '# ' + l : l)).join('\n')).join('\n\n');
}
