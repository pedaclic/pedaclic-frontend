// Quick TS type check for changed files
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = '/sessions/practical-exciting-keller/mnt/PedaClic-deploy';
process.chdir(root);

const cfg = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
const opts = {
  ...cfg.compilerOptions,
  noEmit: true,
  skipLibCheck: true,
};
opts.target = ts.ScriptTarget.ES2020;
opts.module = ts.ModuleKind.ESNext;
opts.moduleResolution = ts.ModuleResolutionKind.Bundler;
opts.jsx = ts.JsxEmit.ReactJSX;
opts.lib = ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'];
opts.allowImportingTsExtensions = true;
opts.isolatedModules = true;
opts.allowSyntheticDefaultImports = true;
opts.esModuleInterop = true;
opts.resolveJsonModule = true;
opts.strict = false;
opts.noImplicitAny = false;
delete opts.useDefineForClassFields;

const targets = [
  'src/components/RichTextEditor.tsx',
  'src/components/prof/ProfDashboard.tsx',
  'src/components/prof/CahierProgressionWidget.tsx',
  'src/components/prof/BulletinAbsencesModal.tsx',
  'src/components/prof/GroupeDetail.tsx',
  'src/pages/CahierDetailPage.tsx',
  'src/utils/bulletinAbsencesPDF.ts',
  'src/services/groupeAbsencesService.ts',
  'src/types/groupeAbsences.types.ts',
];

console.log('Compiling...');
const program = ts.createProgram(targets, opts);
console.log('Got program');
const diags = ts.getPreEmitDiagnostics(program);
console.log('Got diagnostics: ' + diags.length);

const fcts = new Set(targets.map(t => path.resolve(t)));
const filtered = diags.filter(d => d.file && fcts.has(d.file.fileName));

console.log('Filtered to target files: ' + filtered.length);
filtered.slice(0, 50).forEach(d => {
  const file = path.relative(process.cwd(), d.file.fileName);
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  console.log(file + ':' + (line+1) + ':' + (character+1) + ' [TS' + d.code + '] ' + msg);
});
