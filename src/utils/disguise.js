// disguise.js — Transform paragraphs into different disguise modes

const LOG_LEVELS    = ['INFO', 'DEBUG', 'WARN', 'ERROR'];
const LEVEL_WEIGHTS = [6, 4, 2, 1];

const MODULES = [
  'SystemHandler', 'RequestProcessor', 'MemoryCache', 'BookParser',
  'StreamHandler', 'ThreadManager', 'EventLoop',  'ConfigLoader',
  'DataPipeline',  'AuthService',     'CacheManager','NetworkProxy',
  'FileWatcher',   'MetricCollector', 'JobScheduler','TaskRunner',
  'EventBus',      'StateManager',    'RouterMiddleware','TokenValidator',
  'ServiceLocator','ModuleRegistry',  'ContextProvider','PipelineStage',
];
const THREADS = [
  ...Array.from({ length: 12 }, (_, i) => `thread-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 8  }, (_, i) => `node-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4  }, (_, i) => `worker-${String(i + 1).padStart(2, '0')}`),
];
const FUNC_NAMES = [
  'parseStream',    'initCache',       'loadData',       'processEvent',
  'validateToken',  'flushBuffer',     'syncState',      'resolveRef',
  'invokeHandler',  'scheduleTask',    'emitSignal',     'handleRequest',
  'bootstrapModule','dispatchAction',  'transformPayload','bindContext',
  'initEventLoop',  'resolveModule',   'processQueue',   'normalizeData',
  'mountProvider',  'evaluateContext', 'hydrateState',   'finalizeChain',
];
const FILE_EXTS = ['.service.ts', '.controller.ts', '.handler.ts', '.util.ts', '.module.ts'];
const PARAM_TYPES = [
  'StreamContext', 'EventHandler', 'ProcessConfig', 'CacheOptions',
  'RequestContext','ModuleConfig', 'ServiceOptions','PipelineContext',
];
const PARAM_NAMES  = ['ctx', 'opts', 'config', 'handler', 'stream', 'event', 'req', 'payload'];
const RETURN_TYPES = ['Promise<void>', 'Promise<StreamResult>', 'EventEmitter', 'ProcessResult', 'void', 'Promise<ModuleRef>'];
const IMPORT_PATHS = ['./types', '../core/types', './interfaces', '../shared/models', './contracts'];
const ACTIONS      = ['process', 'dispatch', 'resolve', 'handle', 'execute', 'emit', 'flush', 'commit'];

let _tsBase   = Date.now() - Math.random() * 3600000 * 24;
let _tsOffset = 0;

export function resetTimestamp() {
  _tsBase   = Date.now() - Math.random() * 3600000 * 24;
  _tsOffset = 0;
}

function nextTimestamp() {
  _tsOffset += Math.floor(Math.random() * 8000 + 500);
  const d = new Date(_tsBase + _tsOffset);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedLevel() {
  const total = LEVEL_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < LOG_LEVELS.length; i++) {
    r -= LEVEL_WEIGHTS[i];
    if (r <= 0) return LOG_LEVELS[i];
  }
  return 'INFO';
}

function wrapText(text, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// ── LOG MODE ───────────────────────────────────────────────
export function renderLogs(text, width = 90) {
  const level  = weightedLevel();
  const ts     = nextTimestamp();
  const mod    = pick(MODULES);
  const thread = pick(THREADS);
  const header = `[${level}] ${ts} | ${mod} | ${thread} | `;
  const bodyWidth = Math.max(30, width - header.length);
  const lines  = wrapText(text, bodyWidth);

  const result = [{ type: 'log-line', level, header, text: lines[0] || '' }];
  for (let i = 1; i < lines.length; i++) {
    result.push({ type: 'log-continuation', indent: ' '.repeat(header.length), text: lines[i] });
  }
  return result;
}

// ── CODE MODE ──────────────────────────────────────────────
export function renderCode(text, width = 90) {
  const mod   = pick(MODULES) + pick(FILE_EXTS);
  const lines = wrapText(text, width - 4);
  const sep   = '─'.repeat(Math.min(width - 4, 60));
  return [
    { type: 'code-sep',    text: `// ${sep}` },
    { type: 'code-header', text: `/* ${mod} - Documentation Block` },
    ...lines.map(l => ({ type: 'code-line',   text: ` * ${l}` })),
    { type: 'code-footer', text: ' */' },
  ];
}

// ── DOCS MODE ──────────────────────────────────────────────
export function renderDocs(text, width = 90) {
  const mod   = pick(MODULES);
  const fn    = pick(FUNC_NAMES) + '()';
  const ret   = Math.random() > 0.5 ? 'Promise<void>' : 'void';
  const lines = wrapText(text, width - 4);
  return [
    { type: 'docs-header', text: `## ${mod} — ${fn}` },
    ...lines.map(l => ({ type: 'docs-body',   text: `> ${l}` })),
    { type: 'docs-footer', text: `Returns: ${ret} | Throws: StreamException` },
  ];
}

// ── DIFF MODE ──────────────────────────────────────────────
export function renderDiff(text, width = 90) {
  const lines = wrapText(text, width - 3);
  const lineA = Math.floor(Math.random() * 500 + 50);
  const lineB = lineA + Math.floor(Math.random() * 20);
  return [
    { type: 'diff-hunk',    text: `@@ -${lineA},6 +${lineB},${lines.length + 2} @@ class ${pick(MODULES)}` },
    { type: 'diff-removed', text: `-    // Deprecated implementation` },
    { type: 'diff-removed', text: `-    return null;` },
    ...lines.map(l => ({ type: 'diff-added', text: `+ ${l}` })),
  ];
}

// ── VS CODE MODE ───────────────────────────────────────────
export function renderVSCode(text, width = 86) {
  const commentWidth = width - 4;
  const lines       = wrapText(text, commentWidth);
  const fn          = pick(FUNC_NAMES);
  const paramType   = pick(PARAM_TYPES);
  const paramName   = pick(PARAM_NAMES);
  const returnType  = pick(RETURN_TYPES);
  const importPath  = pick(IMPORT_PATHS);
  const action      = pick(ACTIONS);

  return [
    { type: 'vsc-import',       text: `import { ${paramType}, ProcessOptions } from '${importPath}';` },
    { type: 'vsc-blank',        text: '' },
    { type: 'vsc-jsdoc-start',  text: '/**' },
    ...lines.map(l => ({ type: 'vsc-jsdoc-body', text: ` * ${l}` })),
    { type: 'vsc-jsdoc-blank',  text: ' *' },
    { type: 'vsc-jsdoc-tag',    text: ` * @param {${paramType}} ${paramName} - Processing context` },
    { type: 'vsc-jsdoc-tag',    text: ` * @returns {${returnType}}` },
    { type: 'vsc-jsdoc-end',    text: ' */' },
    { type: 'vsc-fn-keyword',   text: `export async function ${fn}(` },
    { type: 'vsc-fn-param',     text: `  ${paramName}: ${paramType},` },
    { type: 'vsc-fn-param',     text: `  opts: ProcessOptions = {}` },
    { type: 'vsc-fn-close-sig', text: `): ${returnType} {` },
    { type: 'vsc-fn-body',      text: `  return ${paramName}.${action}(opts);` },
    { type: 'vsc-fn-end',       text: `}` },
    { type: 'vsc-blank',        text: '' },
  ];
}

export function renderChunk(text, mode, width = 90) {
  switch (mode) {
    case 'code':   return renderCode(text, width);
    case 'docs':   return renderDocs(text, width);
    case 'diff':   return renderDiff(text, width);
    case 'vscode': return renderVSCode(text, width);
    default:       return renderLogs(text, width);
  }
}
