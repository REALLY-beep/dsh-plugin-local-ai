/**
 * Browser half for DSH Desktop.
 * DSH loads this closure with its shared CJS module loader; no bundler/JSX is needed.
 */
window.__ModuleLoader__.load({
  id: 'dsh-local-ai-workbench',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')
    const h = React.createElement

    const PKG = 'dsh-local-ai-workbench'
    const PANEL_ID = 'local-ai-workbench'
    const NAMESPACE = 'localAIWorkbench'
    const IDENTITY_SCHEMA = {
      '~standard': { version: 1, vendor: PKG, validate: (value) => ({ value }) },
      parse: (value) => value,
    }
    const strictCodec = (typeSymbol) => ({ mode: 'strict', typeSymbol, create: () => IDENTITY_SCHEMA })
    function descriptor(method, parameterNames) {
      return {
        id: `${PKG}#${NAMESPACE}/${method}`,
        service: NAMESPACE,
        namespace: NAMESPACE,
        method,
        invocation: { kind: 'direct' },
        parameters: parameterNames.map((name) => ({
          name,
          wire: name,
          source: 'json',
          codec: strictCodec(`${PKG}#${method}:${name}`),
        })),
        result: { mode: 'strict', typeSymbol: `${PKG}#${method}:result`, create: () => IDENTITY_SCHEMA },
      }
    }
    const CONTRIBUTION = {
      package: PKG,
      descriptors: [
        descriptor('getState', []),
        descriptor('refreshModels', []),
        descriptor('saveSettings', ['settings']),
        descriptor('scanDirectory', ['dir']),
        descriptor('addModel', ['filePath', 'displayName']),
        descriptor('removeModel', ['id']),
        descriptor('saveModelOptions', ['id', 'options']),
        descriptor('start', ['id']),
        descriptor('stop', []),
        descriptor('testEngine', []),
        descriptor('registerModel', ['id']),
        descriptor('searchHub', ['query']),
        descriptor('downloadHubModel', ['repoId', 'filename']),
        descriptor('cancelDownload', []),
      ],
    }

    const CSS = `
.dlwb, .dlwb * { box-sizing: border-box; }
.dlwb { color: var(--dsw-alias-label-primary); width: 100%; height: 100%; min-height: 0; min-width: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; scrollbar-gutter: stable; padding: 28px clamp(16px, 3vw, 42px) 48px; font-size: 13px; line-height: 1.5; }
.dlwb-shell { max-width: 1180px; min-height: 100%; margin: 0 auto; }
.dlwb-top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:26px; }
.dlwb-titlebox { display:flex; align-items:center; gap:14px; min-width:0; }
.dlwb-mark { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:var(--dsw-alias-bg-layer-2); border:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-primary); flex:none; }
.dlwb-h1 { font-size:22px; line-height:1.25; font-weight:650; letter-spacing:-.45px; }
.dlwb-subtitle { margin-top:4px; color:var(--dsw-alias-label-tertiary); font-size:12px; }
.dlwb-back { color:var(--dsw-alias-label-secondary); border:1px solid var(--dsw-alias-border-l2); border-radius:9px; background:transparent; padding:7px 11px; cursor:pointer; white-space:nowrap; }
.dlwb-back:hover, .dlwb-btn:hover { border-color:var(--dsw-alias-border-l3); background:var(--dsw-alias-bg-layer-2); }
.dlwb-tabs { display:flex; gap:5px; flex-wrap:wrap; border-bottom:1px solid var(--dsw-alias-border-l2); margin-bottom:20px; }
.dlwb-tab { border:0; border-bottom:2px solid transparent; color:var(--dsw-alias-label-tertiary); background:transparent; padding:10px 14px 11px; cursor:pointer; font:inherit; }
.dlwb-tab[aria-selected="true"] { color:var(--dsw-alias-label-primary); border-bottom-color:var(--dsw-alias-label-primary); font-weight:600; }
.dlwb-section-head { display:flex; justify-content:space-between; align-items:flex-end; gap:14px; margin:4px 0 14px; }
.dlwb-h2 { font-size:16px; font-weight:620; margin:0; }
.dlwb-muted { color:var(--dsw-alias-label-tertiary); }
.dlwb-small { font-size:11px; }
.dlwb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:12px; }
.dlwb-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); border-radius:13px; padding:15px; min-width:0; }
.dlwb-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.dlwb-model-title { font-weight:620; font-size:14px; overflow-wrap:anywhere; }
.dlwb-tag { display:inline-flex; align-items:center; padding:2px 7px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; font-size:10px; color:var(--dsw-alias-label-tertiary); white-space:nowrap; }
.dlwb-meta { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 13px; }
.dlwb-actions { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
.dlwb-btn { border:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-primary); border-radius:8px; background:transparent; padding:6px 10px; cursor:pointer; font:inherit; font-size:12px; }
.dlwb-btn.primary { background:var(--dsw-alias-control-primary-bg, #2868d7); border-color:transparent; color:white; }
.dlwb-btn.danger { color:var(--dsw-alias-state-error-primary, #d64d4d); }
.dlwb-btn:disabled { opacity:.45; cursor:not-allowed; }
.dlwb-input, .dlwb-select { min-width:0; width:100%; height:35px; padding:6px 9px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-1); font:inherit; }
.dlwb-input:focus, .dlwb-select:focus { outline:2px solid var(--dsw-alias-border-focus, #4386e8); outline-offset:1px; }
.dlwb-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.dlwb-field label { color:var(--dsw-alias-label-secondary); font-size:12px; }
.dlwb-form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px 16px; }
.dlwb-panel { border:1px solid var(--dsw-alias-border-l2); border-radius:13px; padding:17px; margin-bottom:14px; background:var(--dsw-alias-bg-layer-1); }
.dlwb-divider { height:1px; background:var(--dsw-alias-border-l2); margin:16px 0; }
.dlwb-empty { padding:42px 18px; text-align:center; border:1px dashed var(--dsw-alias-border-l2); border-radius:13px; color:var(--dsw-alias-label-tertiary); }
.dlwb-status { display:inline-flex; align-items:center; gap:7px; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dlwb-dot { width:7px; height:7px; border-radius:50%; background:#929292; }
.dlwb-dot.ready { background:#25a46a; box-shadow:0 0 0 3px color-mix(in srgb, #25a46a 15%, transparent); }
.dlwb-dot.starting { background:#d99b26; }
.dlwb-dot.error { background:#d64d4d; }
.dlwb-notice { border:1px solid var(--dsw-alias-border-l2); border-radius:9px; padding:10px 12px; margin:10px 0; color:var(--dsw-alias-label-secondary); white-space:pre-wrap; overflow-wrap:anywhere; }
.dlwb-error { color:var(--dsw-alias-state-error-primary, #d64d4d); }
.dlwb-progress { height:7px; border-radius:99px; background:var(--dsw-alias-bg-layer-3); overflow:hidden; margin:9px 0 4px; }
.dlwb-progress > span { display:block; height:100%; background:var(--dsw-alias-label-primary); border-radius:99px; transition:width .15s; }
.dlwb-log { max-height:210px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; padding:11px; border-radius:9px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:11px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
.dlwb-file-list { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
.dlwb-file-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:9px; }
.dlwb-file-name { overflow-wrap:anywhere; min-width:0; }
.dlwb-range { display:flex; gap:9px; align-items:center; }
.dlwb-range input { width:100%; accent-color:var(--dsw-alias-label-primary); }
.dlwb-help { margin:5px 0 0; color:var(--dsw-alias-label-tertiary); font-size:11px; }
@media(max-width:620px) { .dlwb { padding:18px 12px 36px; } .dlwb-top { align-items:flex-start; } .dlwb-h1 { font-size:19px; } .dlwb-back { font-size:11px; padding:6px 8px; } .dlwb-file-row { align-items:flex-start; flex-direction:column; } }
`

    function Icon({ size = 18 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 4 }),
        h('path', { d: 'M8 8h8M8 12h8M8 16h4' }),
        h('path', { d: 'M16 16h.01' })
      )
    }

    function injectStyles() {
      if (typeof document === 'undefined') return null
      const existing = document.querySelector('style[data-dlwb-css]')
      if (existing) return existing
      const tag = document.createElement('style')
      tag.dataset.dlwbCss = 'true'
      tag.textContent = CSS
      document.head.appendChild(tag)
      return tag
    }

    function Panel({ api, ctx }) {
      const [state, setState] = React.useState(null)
      const [tab, setTab] = React.useState('models')
      const [error, setError] = React.useState('')
      const [success, setSuccess] = React.useState('')
      const [settingsDraft, setSettingsDraft] = React.useState(null)
      const [pathDraft, setPathDraft] = React.useState('')
      const [nameDraft, setNameDraft] = React.useState('')
      const [directoryDraft, setDirectoryDraft] = React.useState('')
      const [scannedFiles, setScannedFiles] = React.useState([])
      const [scanSummary, setScanSummary] = React.useState('')
      const [expandedId, setExpandedId] = React.useState(null)
      const [optionDraft, setOptionDraft] = React.useState(null)
      const [hubQuery, setHubQuery] = React.useState('')
      const [hubResults, setHubResults] = React.useState([])
      const [hubLoading, setHubLoading] = React.useState(false)
      const [hubSelection, setHubSelection] = React.useState({})
      const [busy, setBusy] = React.useState('')

      const refresh = React.useCallback(async () => {
        try {
          const next = await api.call('getState')
          setState(next)
          setSettingsDraft((old) => old || { ...next.settings })
          setDirectoryDraft((old) => old || next.settings.modelsDir || '')
        } catch (e) { setError(errorText(e)) }
      }, [api])

      React.useEffect(() => {
        injectStyles()
        refresh()
        const timer = setInterval(refresh, 1600)
        return () => clearInterval(timer)
      }, [refresh])

      function errorText(value) { return value && value.message ? value.message : String(value) }
      function runAction(name, action, successText) {
        setBusy(name)
        setError('')
        setSuccess('')
        Promise.resolve().then(action).then((result) => {
          if (successText) setSuccess(successText)
          refresh()
          return result
        }).catch((e) => setError(errorText(e))).finally(() => setBusy(''))
      }
      function setSetting(key, value) {
        setSettingsDraft((old) => ({ ...(old || {}), [key]: value }))
      }
      function field(label, key, placeholder, type = 'text', helper = '') {
        return h('div', { className: 'dlwb-field', key },
          h('label', { htmlFor: `dlwb-${key}` }, label),
          h('input', {
            id: `dlwb-${key}`, className: 'dlwb-input', type,
            value: settingsDraft ? (settingsDraft[key] ?? '') : '',
            placeholder: placeholder || '',
            spellCheck: false,
            onChange: (event) => setSetting(key, event.target.value),
          }),
          helper ? h('div', { className: 'dlwb-help' }, helper) : null
        )
      }
      function optionField(label, key, min, max, step, helper) {
        const value = optionDraft ? optionDraft[key] : ''
        return h('div', { className: 'dlwb-field', key },
          h('label', { htmlFor: `dlwb-opt-${key}` }, `${label}: ${value}`),
          h('div', { className: 'dlwb-range' },
            h('input', { id: `dlwb-opt-${key}`, type: 'range', min, max, step, value, onChange: (event) => setOptionDraft((old) => ({ ...old, [key]: Number(event.target.value) })) })
          ),
          helper ? h('div', { className: 'dlwb-help' }, helper) : null
        )
      }
      function button(text, onClick, cls = '', disabled = false) {
        return h('button', { className: `dlwb-btn ${cls}`.trim(), onClick, disabled }, text)
      }
      function statusPill() {
        const status = state ? state.status : 'stopped'
        return h('span', { className: 'dlwb-status' },
          h('span', { className: `dlwb-dot ${status}` }),
          status === 'ready' ? 'Сервер запущен' : status === 'starting' ? 'Запуск…' : status === 'stopping' ? 'Остановка…' : status === 'error' ? 'Ошибка' : 'Сервер остановлен'
        )
      }
      const models = state && Array.isArray(state.models) ? state.models : []
      const isRunning = state && ['ready', 'starting', 'stopping'].includes(state.status)

      function renderModelCard(model) {
        const selected = state && state.activeModelId === model.id
        const expanded = expandedId === model.id
        return h('article', { className: 'dlwb-card', key: model.id },
          h('div', { className: 'dlwb-card-head' },
            h('div', { style: { minWidth: 0 } },
              h('div', { className: 'dlwb-model-title' }, model.name),
              h('div', { className: 'dlwb-muted dlwb-small', style: { marginTop: 3, overflowWrap: 'anywhere' } }, model.fileName)
            ),
            h('span', { className: 'dlwb-tag' }, model.quantization || 'GGUF')
          ),
          h('div', { className: 'dlwb-meta' },
            h('span', { className: 'dlwb-tag' }, model.sizeLabel || '—'),
            h('span', { className: 'dlwb-tag' }, `${(model.options && model.options.contextSize || 8192).toLocaleString('ru-RU')} ctx`),
            selected ? h('span', { className: 'dlwb-tag' }, 'Активная') : null
          ),
          h('div', { className: 'dlwb-actions' },
            selected && isRunning
              ? button(state.status === 'stopping' ? 'Останавливается…' : 'Остановить', () => runAction('stop', () => api.call('stop')), 'danger', state.status === 'stopping')
              : button('Запустить', () => runAction(`start:${model.id}`, () => api.call('start', model.id)), 'primary', !!isRunning || !!busy),
            button('Настройки', () => {
              setExpandedId(expanded ? null : model.id)
              setOptionDraft({ ...(model.options || {}) })
            }),
            button('В DSH', () => runAction(`register:${model.id}`, () => api.call('registerModel', model.id), 'Модель добавлена в список DSH.'), '', !!busy),
            button('Убрать', () => runAction(`remove:${model.id}`, () => api.call('removeModel', model.id), 'Модель убрана из библиотеки.'), 'danger', !!busy || selected)
          ),
          expanded ? h('div', { className: 'dlwb-divider' }) : null,
          expanded ? h(React.Fragment, null,
            h('div', { className: 'dlwb-h2', style: { marginBottom: 13 } }, 'Параметры запуска'),
            h('div', { className: 'dlwb-form-grid' },
              optionField('Контекст', 'contextSize', 512, 131072, 512, 'Размер контекстного окна (-c). Больший контекст требует больше RAM/VRAM.'),
              optionField('GPU layers', 'gpuLayers', 0, 200, 1, 'Сколько слоёв выгружать на видеокарту (-ngl). 0 — CPU.'),
              optionField('Потоки CPU', 'threads', 1, 64, 1),
              optionField('Batch size', 'batchSize', 32, 2048, 32),
              optionField('Temperature', 'temperature', 0, 2, 0.05),
              optionField('Top P', 'topP', 0.1, 1, 0.05),
              optionField('Top K', 'topK', 0, 200, 1),
              optionField('Repeat penalty', 'repeatPenalty', 0.8, 1.5, 0.01)
            ),
            h('div', { className: 'dlwb-actions', style: { marginTop: 15 } },
              h('label', { className: 'dlwb-status' }, h('input', { type: 'checkbox', checked: !!(optionDraft && optionDraft.flashAttention), onChange: (event) => setOptionDraft((old) => ({ ...old, flashAttention: event.target.checked })) }), 'Flash Attention'),
              h('label', { className: 'dlwb-status' }, h('input', { type: 'checkbox', checked: !!(optionDraft && optionDraft.jinja), onChange: (event) => setOptionDraft((old) => ({ ...old, jinja: event.target.checked })) }), 'Jinja / tool templates')
            ),
            h('div', { className: 'dlwb-actions', style: { marginTop: 14 } },
              button('Сохранить параметры', () => runAction(`options:${model.id}`, () => api.call('saveModelOptions', model.id, optionDraft).then(() => setExpandedId(null)), 'Параметры сохранены.'), 'primary', !!busy),
              button('Отмена', () => setExpandedId(null))
            )
          ) : null
        )
      }

      function renderModels() {
        return h(React.Fragment, null,
          h('div', { className: 'dlwb-section-head' },
            h('div', null, h('h2', { className: 'dlwb-h2' }, 'Библиотека моделей'), h('div', { className: 'dlwb-muted dlwb-small' }, `${models.length} моделей · GGUF`)),
            h('div', { className: 'dlwb-actions' }, statusPill(), button('Обновить', () => runAction('refresh', () => api.call('refreshModels').then(setState))))
          ),
          state && state.lastError ? h('div', { className: 'dlwb-notice dlwb-error' }, state.lastError) : null,
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-h2', style: { marginBottom: 5 } }, 'Добавить локальную модель'),
            h('div', { className: 'dlwb-muted dlwb-small', style: { marginBottom: 12 } }, 'Укажи полный путь к GGUF-файлу. Сам файл останется на диске, плагин добавит его в библиотеку.'),
            h('div', { className: 'dlwb-form-grid' },
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-model-path' }, 'Путь к .gguf'), h('input', { id: 'dlwb-model-path', className: 'dlwb-input', value: pathDraft, placeholder: 'D:\\Models\\Qwen3-8B-Q4_K_M.gguf', spellCheck: false, onChange: (event) => setPathDraft(event.target.value) })),
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-model-name' }, 'Название (необязательно)'), h('input', { id: 'dlwb-model-name', className: 'dlwb-input', value: nameDraft, placeholder: 'Qwen3 8B Q4_K_M', onChange: (event) => setNameDraft(event.target.value) }))
            ),
            h('div', { className: 'dlwb-actions', style: { marginTop: 11 } }, button('Добавить модель', () => runAction('add-model', () => api.call('addModel', pathDraft, nameDraft).then(() => { setPathDraft(''); setNameDraft('') }), 'Модель добавлена в библиотеку.'), 'primary', !pathDraft.trim() || !!busy)),
            h('div', { className: 'dlwb-divider' }),
            h('div', { className: 'dlwb-h2', style: { marginBottom: 5 } }, 'Полное сканирование папки'),
            h('div', { className: 'dlwb-muted dlwb-small', style: { marginBottom: 10 } }, 'Проверяются все вложенные папки на любой глубине. Символические ссылки на другие папки не обходятся.'),
            h('div', { className: 'dlwb-form-grid' }, h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-scan-dir' }, 'Путь к папке с GGUF'), h('input', { id: 'dlwb-scan-dir', className: 'dlwb-input', value: directoryDraft, placeholder: 'D:\\AI\\Models', spellCheck: false, onChange: (event) => setDirectoryDraft(event.target.value) }))),
            h('div', { className: 'dlwb-actions', style: { marginTop: 10 } }, button(busy === 'scan-dir' ? 'Сканирование…' : 'Сканировать все вложенные папки', () => runAction('scan-dir', async () => {
              const result = await api.call('scanDirectory', directoryDraft)
              setScannedFiles(result.files || [])
              const warnings = (result.skippedDirectories || 0) + (result.skippedFiles || 0)
              setScanSummary(`Проверено папок: ${result.directoriesScanned || 0}. Найдено GGUF: ${(result.files || []).length}.${warnings ? ` Не удалось прочитать элементов: ${warnings}.` : ''}`)
              return result
            }, 'Сканирование завершено.'), '', !directoryDraft.trim() || !!busy)),
            scanSummary ? h('div', { className: 'dlwb-help', role: 'status' }, scanSummary) : null,
            scannedFiles.length ? h('div', { className: 'dlwb-file-list' }, scannedFiles.map((file) => h('div', { className: 'dlwb-file-row', key: file.path },
              h('div', { className: 'dlwb-file-name' }, h('div', null, file.name), h('div', { className: 'dlwb-muted dlwb-small' }, `${file.relativePath || file.name} · ${(file.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`)),
              button('Добавить', () => runAction(`scan-add:${file.path}`, () => api.call('addModel', file.path, file.name.replace(/\.gguf$/i, '')), 'Модель добавлена.'), '', !!busy)
            ))) : null
          ),
          models.length
            ? h('div', { className: 'dlwb-grid' }, models.map(renderModelCard))
            : h('div', { className: 'dlwb-empty' }, h('div', { style: { fontSize: 16, marginBottom: 7, color: 'var(--dsw-alias-label-primary)' } }, 'Библиотека пока пуста'), 'Добавь GGUF-файл вручную или скачай модель из Hugging Face.')
        )
      }

      function renderEngine() {
        const draft = settingsDraft || (state && state.settings) || {}
        return h(React.Fragment, null,
          h('div', { className: 'dlwb-section-head' }, h('div', null, h('h2', { className: 'dlwb-h2' }, 'Engine & Settings'), h('div', { className: 'dlwb-muted dlwb-small' }, 'Настройки llama.cpp и локального API-сервера'))),
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-form-grid' },
              field('Путь к llama-server или папке llama.cpp', 'serverPath', 'Например: C:\\llama.cpp\\build\\bin'),
              field('Имя бинарного файла', 'serverName', 'llama-server.exe / llama-server'),
              field('Папка моделей', 'modelsDir', 'Например: D:\\AI\\Models'),
              field('Порт API', 'port', '12345', 'number', 'Сервер будет доступен только на 127.0.0.1.'),
              field('API key (необязательно)', 'apiKey', 'Оставь пустым, чтобы отключить авторизацию', 'password', 'Используется llama-server и локальным DSH-провайдером.'),
              field('DSH settings namespace', 'settingsNamespace', 'llm-pi-ai', 'text', 'Обычно менять не нужно.')
            ),
            h('div', { className: 'dlwb-divider' }),
            h('div', { className: 'dlwb-actions' },
              button('Сохранить настройки', () => runAction('save-settings', () => api.call('saveSettings', draft).then(() => setSettingsDraft(null)), 'Настройки сохранены.'), 'primary', !!busy || !!isRunning),
              button('Проверить сервер', () => runAction('test-engine', async () => {
                const result = await api.call('testEngine')
                if (!result.ok) throw new Error(result.error || `Сервер ответил HTTP ${result.status}`)
                return result
              }, 'Сервер доступен по локальному API.'), '', !!busy)
            ),
            h('p', { className: 'dlwb-help' }, 'Перед изменением настроек останови сервер. После смены порта или API key повторно нажми «В DSH» у нужной модели.')
          ),
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-h2', style: { marginBottom: 8 } }, 'Статус движка'),
            h('div', { className: 'dlwb-actions' }, statusPill(), state && state.activeModelId ? h('span', { className: 'dlwb-muted dlwb-small' }, `Модель ID: ${state.activeModelId}`) : null),
            state && state.startedAt ? h('div', { className: 'dlwb-help' }, `Запущен: ${new Date(state.startedAt).toLocaleString()}`) : null,
            h('div', { className: 'dlwb-actions', style: { marginTop: 12 } },
              button('Остановить сервер', () => runAction('stop', () => api.call('stop')), 'danger', !isRunning || !!busy)
            )
          ),
          state && state.logTail ? h('div', { className: 'dlwb-panel' }, h('div', { className: 'dlwb-h2', style: { marginBottom: 10 } }, 'Лог llama-server'), h('pre', { className: 'dlwb-log' }, state.logTail)) : null
        )
      }

      async function searchHub() {
        setHubLoading(true)
        setError('')
        setHubResults([])
        try {
          const results = await api.call('searchHub', hubQuery)
          setHubResults(results)
          setHubSelection({})
          if (!results.length) setSuccess('По запросу не найдено GGUF-репозиториев с файлами .gguf.')
        } catch (e) { setError(errorText(e)) } finally { setHubLoading(false) }
      }

      function renderHub() {
        const download = state && state.download
        return h(React.Fragment, null,
          h('div', { className: 'dlwb-section-head' }, h('div', null, h('h2', { className: 'dlwb-h2' }, 'Hugging Face'), h('div', { className: 'dlwb-muted dlwb-small' }, 'Поиск публичных GGUF-репозиториев и загрузка выбранного файла на компьютер.'))),
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-form-grid' }, h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-hub-query' }, 'Название модели или репозитория'), h('input', { id: 'dlwb-hub-query', className: 'dlwb-input', value: hubQuery, placeholder: 'Qwen3 8B GGUF', onChange: (event) => setHubQuery(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') searchHub() } }))),
            h('div', { className: 'dlwb-actions', style: { marginTop: 11 } }, button(hubLoading ? 'Поиск…' : 'Найти модели', searchHub, 'primary', hubLoading || !hubQuery.trim()))
          ),
          download ? h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-card-head' }, h('div', null, h('div', { className: 'dlwb-h2' }, download.status === 'downloading' ? 'Загрузка модели' : download.status === 'complete' ? 'Загрузка завершена' : download.status === 'cancelled' ? 'Загрузка отменена' : 'Ошибка загрузки'), h('div', { className: 'dlwb-muted dlwb-small' }, `${download.repoId || ''} · ${download.filename || ''}`)),
              download.status === 'downloading' ? button('Отменить', () => runAction('cancel-download', () => api.call('cancelDownload')), 'danger') : null
            ),
            h('div', { className: 'dlwb-progress' }, h('span', { style: { width: `${download.progress || 0}%` } })),
            h('div', { className: 'dlwb-muted dlwb-small' }, `${download.progress || 0}% · ${(download.downloadedBytes || 0).toLocaleString()} / ${(download.totalBytes || 0).toLocaleString()} bytes`),
            download.error ? h('div', { className: 'dlwb-error', style: { marginTop: 8 } }, download.error) : null
          ) : null,
          hubResults.length ? h('div', { className: 'dlwb-grid' }, hubResults.map((repo) => h('article', { className: 'dlwb-card', key: repo.id },
            h('div', { className: 'dlwb-model-title' }, repo.id),
            h('div', { className: 'dlwb-meta' }, h('span', { className: 'dlwb-tag' }, `${repo.downloads.toLocaleString()} загрузок`), h('span', { className: 'dlwb-tag' }, `${repo.likes} likes`)),
            h('div', { className: 'dlwb-field' }, h('label', null, 'GGUF файл'), h('select', { className: 'dlwb-select', value: hubSelection[repo.id] || repo.files[0], onChange: (event) => setHubSelection((old) => ({ ...old, [repo.id]: event.target.value })) }, repo.files.map((file) => h('option', { value: file, key: file }, file)))),
            h('div', { className: 'dlwb-actions', style: { marginTop: 11 } }, button('Скачать в библиотеку', () => runAction(`download:${repo.id}`, () => api.call('downloadHubModel', repo.id, hubSelection[repo.id] || repo.files[0]), 'Загрузка завершена. Модель добавлена в библиотеку.'), 'primary', !!busy || !!(download && download.status === 'downloading')))
          ))) : hubLoading ? h('div', { className: 'dlwb-empty' }, 'Ищем публичные GGUF-модели…') : null,
          h('p', { className: 'dlwb-help' }, 'Запросы к Hugging Face выполняются только при поиске/скачивании. Генерация и обработка запросов остаются локальными на твоём компьютере.')
        )
      }

      return h('main', { className: 'dlwb' },
        h('div', { className: 'dlwb-shell' },
          h('header', { className: 'dlwb-top', 'data-window-drag': true },
            h('div', { className: 'dlwb-titlebox' },
              h('div', { className: 'dlwb-mark' }, h(Icon, { size: 21 })),
              h('div', null, h('div', { className: 'dlwb-h1' }, 'Local AI'), h('div', { className: 'dlwb-subtitle' }, 'GGUF models · llama.cpp · local inference'))
            ),
            h('button', { className: 'dlwb-back', onClick: () => { try { ctx.layout.selectPanel(null) } catch { /* panel may be closed by host navigation */ } } }, '← К чату')
          ),
          h('nav', { className: 'dlwb-tabs', role: 'tablist', 'aria-label': 'Local AI sections' },
            [['models', 'Модели'], ['engine', 'Engine & Settings'], ['hub', 'Hugging Face']].map(([id, label]) => h('button', { className: 'dlwb-tab', role: 'tab', 'aria-selected': tab === id, key: id, onClick: () => setTab(id) }, label))
          ),
          error ? h('div', { className: 'dlwb-notice dlwb-error', role: 'alert' }, error) : null,
          success ? h('div', { className: 'dlwb-notice' }, success) : null,
          tab === 'models' ? renderModels() : tab === 'engine' ? renderEngine() : renderHub()
        )
      )
    }

    exports.inject = ['slots', 'remote', 'layout']
    exports.apply = function apply(ctx) {
      if (!ctx.slots) return
      const styleTag = injectStyles()
      const remote = ctx.remote
      let disposed = false
      let remoteDisposer = null
      let namespace = null
      const ready = remote && remote.$mount(CONTRIBUTION).then((dispose) => {
        if (disposed) { Promise.resolve(dispose()).catch(() => {}); return }
        remoteDisposer = dispose
        namespace = typeof ctx.get === 'function' ? ctx.get('remote.' + NAMESPACE) : (remote[NAMESPACE] || null)
      }).catch((error) => console.error('[dsh-local-ai-workbench] Remote mount failed:', error))

      const api = {
        async call(method, ...args) {
          if (ready) await ready
          const ns = namespace || (typeof ctx.get === 'function' ? ctx.get('remote.' + NAMESPACE) : null)
          if (!ns || typeof ns[method] !== 'function') throw new Error('Host API ещё не подключён. Перезагрузи DSH и проверь версию плагина.')
          const result = await ns[method](...args)
          if (!result.ok) throw result.error || new Error('Host method failed')
          return result.value
        },
      }

      ctx.effect(() => {
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, () => h(Panel, { api, ctx })))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 26,
          label: 'Local AI',
        }, Icon))
        return () => {
          disposed = true
          if (remoteDisposer) Promise.resolve(remoteDisposer()).catch(() => {})
          if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
        }
      }, 'dsh-local-ai-workbench: panel')
    }
    return module.exports
  },
})
