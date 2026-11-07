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
        descriptor('addModel', ['filePath', 'displayName', 'mmprojPath']),
        descriptor('saveModelMmproj', ['id', 'mmprojPath']),
        descriptor('removeModel', ['id']),
        descriptor('saveModelOptions', ['id', 'options']),
        descriptor('start', ['id']),
        descriptor('stop', []),
        descriptor('testEngine', []),
        descriptor('testVision', []),
        descriptor('registerModel', ['id']),
        descriptor('searchHub', ['query', 'sort', 'paramsRange', 'weightRange']),
        descriptor('downloadHubModel', ['repoId', 'filename', 'repoMetadata']),
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
.dlwb-hub-search { display:grid; grid-template-columns:minmax(220px,1fr) minmax(170px,220px) auto; gap:12px; align-items:end; }
.dlwb-hub-search-action { padding-bottom:1px; }
.dlwb-hub-filters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
.dlwb-hub-selected-file { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); border-radius:9px; padding:9px 10px; display:flex; flex-wrap:wrap; gap:7px; align-items:center; }
.dlwb-hub-selected-file strong { font-size:11px; font-weight:600; margin-right:2px; }
.dlwb-hub-results-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:18px 0 10px; font-weight:600; }
.dlwb-hub-card { display:flex; flex-direction:column; gap:8px; }
.dlwb-hub-repo { display:block; color:var(--dsw-alias-label-primary); font-size:14px; font-weight:620; overflow-wrap:anywhere; text-decoration:none; }
.dlwb-hub-repo:hover { text-decoration:underline; }
@media (max-width:760px) { .dlwb-hub-search, .dlwb-hub-filters { grid-template-columns:minmax(0,1fr); } .dlwb-hub-search-action .dlwb-btn { width:100%; } }
.dlwb-card { border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-1); border-radius:13px; padding:15px; min-width:0; }
.dlwb-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.dlwb-model-title { font-weight:620; font-size:14px; overflow-wrap:anywhere; }
.dlwb-tag { display:inline-flex; align-items:center; padding:2px 7px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; font-size:10px; color:var(--dsw-alias-label-tertiary); white-space:nowrap; }
.dlwb-capabilities { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 9px; }
.dlwb-capability { display:inline-flex; align-items:center; gap:4px; border:1px solid var(--dsw-alias-border-l2); border-radius:7px; padding:3px 7px; font-size:10px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); white-space:nowrap; }
.dlwb-capability.is-supported { border-color:color-mix(in srgb, #25a46a 38%, var(--dsw-alias-border-l2)); color:var(--dsw-alias-state-success-primary, #25875d); }
.dlwb-capability.is-conditional { border-color:color-mix(in srgb, #d99b26 42%, var(--dsw-alias-border-l2)); color:var(--dsw-alias-state-warning-primary, #a97818); }
.dlwb-capability.is-unsupported { color:var(--dsw-alias-label-tertiary); opacity:.72; text-decoration:line-through; text-decoration-thickness:1px; }
.dlwb-model-id { margin-top:3px; color:var(--dsw-alias-label-quaternary, var(--dsw-alias-label-tertiary)); font:10px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap:anywhere; }
.dlwb-capability-legend { margin:2px 0 10px; color:var(--dsw-alias-label-tertiary); font-size:10px; }
.dlwb-compat { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:7px 0 10px; }
.dlwb-compat-ok { border-color:color-mix(in srgb, #25a46a 40%, var(--dsw-alias-border-l2)); color:var(--dsw-alias-state-success-primary, #25875d); }
.dlwb-compat-unknown { color:var(--dsw-alias-label-tertiary); }
.dlwb-registered-note { margin:8px 0 14px; }
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
      const [mmprojPathDraft, setMmprojPathDraft] = React.useState('')
      const [mmprojDrafts, setMmprojDrafts] = React.useState({})
      const [scanMmprojSelection, setScanMmprojSelection] = React.useState({})
      const [directoryDraft, setDirectoryDraft] = React.useState('')
      const [scannedFiles, setScannedFiles] = React.useState([])
      const [scanSummary, setScanSummary] = React.useState('')
      const [expandedId, setExpandedId] = React.useState(null)
      const [optionDraft, setOptionDraft] = React.useState(null)
      const [hubQuery, setHubQuery] = React.useState('')
      const [hubSort, setHubSort] = React.useState('trending')
      const [hubParamsRange, setHubParamsRange] = React.useState('any')
      const [hubWeightRange, setHubWeightRange] = React.useState('any')
      const [hubResults, setHubResults] = React.useState([])
      const [hubLoading, setHubLoading] = React.useState(false)
      const [hubSelection, setHubSelection] = React.useState({})
      const [hubMmprojSelection, setHubMmprojSelection] = React.useState({})
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
      function pathText(value) { return String(value || '').split(/[\\/]/).pop() || value }
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
      function optionField(label, key, min, max, step, helper, model = null) {
        const value = optionDraft ? optionDraft[key] : ''
        let detail = helper
        let fieldLabel = `${label}: ${value}`
        if (key === 'contextSize' && model && model.contextMemory && Number(model.contextMemory.bytesPerToken) > 0) {
          const bytes = Number(model.contextMemory.bytesPerToken) * Number(value)
          const gib = bytes / (1024 ** 3)
          const weightGib = Number(model.sizeBytes || 0) / (1024 ** 3)
          fieldLabel = `${label}: ${Number(value).toLocaleString('ru-RU')} · KV-cache ≈ ${gib.toFixed(2)} GiB`
          detail = `Оценка KV-cache при K/V F16: около ${gib.toFixed(2)} GiB для ${Number(value).toLocaleString('ru-RU')} токенов. Файл весит ${weightGib.toFixed(2)} GiB. Это не полный расход RAM/VRAM: дополнительно нужны память весов, compute buffers и служебные буферы; распределение зависит от GPU layers.`
          if (model.contextMemory.stateSpaceMetadata) detail += ' У модели обнаружены SSM/Mamba-метаданные: оценка показывает только attention KV-cache и не включает состояние SSM.'
          else detail += ' Для гибридных архитектур оценка может быть неполной; фактический расход зависит от реализации llama.cpp.'
        } else if (key === 'contextSize' && model) {
          detail = 'GGUF не содержит достаточных метаданных attention для оценки KV-cache. Показать точную цифру без этих данных нельзя; фактический расход зависит от архитектуры и типа KV-кэша.'
        }
        return h('div', { className: 'dlwb-field', key },
          h('label', { htmlFor: `dlwb-opt-${key}` }, fieldLabel),
          h('div', { className: 'dlwb-range' },
            h('input', { id: `dlwb-opt-${key}`, type: 'range', min, max, step, value, onChange: (event) => setOptionDraft((old) => ({ ...old, [key]: Number(event.target.value) })) })
          ),
          detail ? h('div', { className: 'dlwb-help' }, detail) : null
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

      function capabilityChips(capabilities, source) {
        if (!Array.isArray(capabilities) || !capabilities.length) return null
        const known = capabilities.filter((item) => item && typeof item.label === 'string').slice(0, 8)
        if (!known.length) return null
        return h('div', { className: 'dlwb-capabilities' },
          known.map((item) => {
            const status = ['supported', 'conditional', 'unsupported'].includes(item.status) ? item.status : 'unknown'
            const mark = item.mark || '?'
            const detail = item.detail || 'Функция отмечена в метаданных модели, но её поддержка плагином не проверена.'
            const origin = source === 'filename' ? 'Предположение по названию файла' : source === 'huggingface' ? 'Метаданные Hugging Face' : 'Метаданные модели'
            return h('span', {
              className: `dlwb-capability is-${status}`,
              key: item.id || item.label,
              title: `${item.label}: ${detail} Источник: ${origin}. Метаданные модели не являются функциональным тестом.`,
            }, `${item.icon || '•'} ${item.label} ${mark}`)
          })
        )
      }

      function compatibilityChip(model, source = 'local') {
        if (model && model.runtimeLoadVerifiedAt) {
          return h('span', { className: 'dlwb-tag dlwb-compat-ok', title: `llama-server успешно загрузил модель ${new Date(model.runtimeLoadVerifiedAt).toLocaleString('ru-RU')}` }, '✓ Загружалась в llama.cpp')
        }
        if (model && model.llamaCppListed) {
          return h('span', { className: 'dlwb-tag dlwb-compat-ok', title: 'Hugging Face помечает репозиторий как совместимый с llama.cpp; локальная сборка ещё не проверена' }, '✓ llama.cpp · HF')
        }
        if (source === 'hub') {
          return h('span', { className: 'dlwb-tag dlwb-compat-unknown', title: 'GGUF-файл найден, но Hugging Face не вернул отметку llama.cpp. Совместимость нужно проверить запуском' }, '？ llama.cpp не подтверждён')
        }
        return h('span', { className: 'dlwb-tag dlwb-compat-unknown', title: 'Модель ещё не запускалась успешно в этой конфигурации llama.cpp' }, '？ Не проверена')
      }

      function renderModelCard(model) {
        const selected = state && state.activeModelId === model.id
        const registered = state && state.registeredModelId === model.id
        const expanded = expandedId === model.id
        return h('article', { className: 'dlwb-card', key: model.id },
          h('div', { className: 'dlwb-card-head' },
            h('div', { style: { minWidth: 0 } },
              h('div', { className: 'dlwb-model-title' }, model.name),
              h('div', { className: 'dlwb-muted dlwb-small', style: { marginTop: 3, overflowWrap: 'anywhere' } }, model.fileName),
              h('div', { className: 'dlwb-model-id', title: 'Идентификатор модели в DSH' }, `ID: ${model.id}`)
            ),
            h('span', { className: 'dlwb-tag' }, model.quantization || 'GGUF')
          ),
          h('div', { className: 'dlwb-meta' },
            h('span', { className: 'dlwb-tag' }, model.sizeLabel || '—'),
            h('span', { className: 'dlwb-tag' }, `${(model.options && model.options.contextSize || 8192).toLocaleString('ru-RU')} ctx`),
            selected ? h('span', { className: 'dlwb-tag' }, 'Активная') : null,
            registered ? h('span', { className: 'dlwb-tag dlwb-compat-ok' }, 'В DSH') : null
          ),
          capabilityChips(model.capabilities, model.capabilitySource),
          h('div', { className: 'dlwb-compat' }, compatibilityChip(model)),
          h('div', { className: 'dlwb-actions' },
            selected && isRunning
              ? button(state.status === 'stopping' ? 'Останавливается…' : 'Остановить', () => runAction('stop', () => api.call('stop')), 'danger', state.status === 'stopping')
              : button('Запустить', () => runAction(`start:${model.id}`, () => api.call('start', model.id)), 'primary', !!isRunning || !!busy),
            button('Настройки', () => {
              setExpandedId(expanded ? null : model.id)
              setOptionDraft({ ...(model.options || {}) })
              setMmprojDrafts((old) => old[model.id] === undefined ? { ...old, [model.id]: model.mmprojPath || '' } : old)
            }),
            button(registered ? 'Обновить в DSH' : 'В DSH', () => runAction(`register:${model.id}`, () => api.call('registerModel', model.id), 'Регистрация подтверждена. Для переключения модели создай новый чат или выбери её в селекторе текущего чата.'), '', !!busy),
            button('Убрать', () => runAction(`remove:${model.id}`, () => api.call('removeModel', model.id), 'Модель убрана из библиотеки.'), 'danger', !!busy || selected)
          ),
          expanded ? h('div', { className: 'dlwb-divider' }) : null,
          expanded ? h(React.Fragment, null,
            h('div', { className: 'dlwb-h2', style: { marginBottom: 9 } }, 'Мультимодальность / Vision'),
            h('div', { className: 'dlwb-form-grid' },
              h('div', { className: 'dlwb-field' },
                h('label', { htmlFor: `dlwb-mmproj-${model.id}` }, 'Путь к совместимому mmproj GGUF'),
                h('input', { id: `dlwb-mmproj-${model.id}`, className: 'dlwb-input', value: mmprojDrafts[model.id] === undefined ? (model.mmprojPath || '') : mmprojDrafts[model.id], placeholder: 'D:\\Models\\mmproj-model-f16.gguf', spellCheck: false, onChange: (event) => setMmprojDrafts((old) => ({ ...old, [model.id]: event.target.value })) }),
                h('div', { className: 'dlwb-help' }, 'Проектор должен относиться именно к этой архитектуре и версии модели. После привязки останови и запусти модель заново.')
              )
            ),
            h('div', { className: 'dlwb-actions', style: { marginTop: 9, marginBottom: 16 } },
              button('Сохранить mmproj', () => runAction(`mmproj:${model.id}`, () => api.call('saveModelMmproj', model.id, mmprojDrafts[model.id] === undefined ? (model.mmprojPath || '') : mmprojDrafts[model.id]), 'Путь mmproj сохранён. Перезапусти модель для применения.'), '', !!busy || (selected && isRunning)),
              model.hasMmproj && selected && state.status === 'ready'
                ? button('Проверить Vision', () => runAction(`vision:${model.id}`, () => api.call('testVision'), 'Тестовое изображение принято llama-server. Vision зарегистрирован в DSH; создай новый чат или заново выбери модель.'), 'primary', !!busy)
                : null,
              model.visionVerifiedAt ? h('span', { className: 'dlwb-tag dlwb-compat-ok', title: model.visionVerificationSource || '' }, '✓ Vision проверен') : model.visionRuntimeHint && model.visionRuntimeHint.status === 'image-advertised' ? h('span', { className: 'dlwb-tag dlwb-compat-unknown' }, 'Сервер заявляет image · требуется тест') : null
            ),
            h('div', { className: 'dlwb-divider' }),
            h('div', { className: 'dlwb-h2', style: { marginBottom: 7 } }, 'Reasoning / рассуждение'),
            model.reasoningRuntimeHint && model.reasoningRuntimeHint.status === 'supported'
              ? h('div', { className: 'dlwb-help' }, `llama.cpp подтвердил уровни шаблона: ${model.reasoningRuntimeHint.levels.join(', ')}. После запуска плагин регистрирует их в селекторе DSH. Уровень Off передаётся как reasoning_effort=none.`)
              : model.reasoningRuntimeHint
                ? h('div', { className: 'dlwb-help' }, `Выбор уровня не подтверждён: ${model.reasoningRuntimeHint.detail || 'шаблон модели не объявил поддерживаемые уровни.'} Модель может рассуждать автоматически, но ручной Effort-селектор для этого шаблона не гарантирован.`)
                : h('div', { className: 'dlwb-help' }, 'Уровни рассуждения определяются после запуска модели по llama-server /props. До запуска их поддержка неизвестна.'),
            h('div', { className: 'dlwb-h2', style: { marginTop: 14, marginBottom: 13 } }, 'Параметры запуска'),
            h('div', { className: 'dlwb-form-grid' },
              optionField('Контекст', 'contextSize', 512, 131072, 512, 'Размер контекстного окна (-c).', model),
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
          state && state.registeredModelId ? h('div', { className: 'dlwb-notice dlwb-registered-note' },
            `В DSH сейчас зарегистрирована: ${state.registeredModelName || state.registeredModelId} · ID ${state.registeredModelId}. Если чат показывает «no configured model <ID>», этот ID отсутствует в текущем каталоге провайдера или сохранён в старой сессии. Нажми «В DSH» у нужной модели, затем создай новый чат либо выбери её заново в селекторе старого чата. DSH сохраняет model ID уже начатой сессии.`
          ) : null,
          h('div', { className: 'dlwb-capability-legend' }, 'Значки показывают заявленные возможности модели и реальную поддержку плагином. Vision включается в DSH только после привязки mmproj и успешного тестового запроса с изображением.'),
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-h2', style: { marginBottom: 5 } }, 'Добавить локальную модель'),
            h('div', { className: 'dlwb-muted dlwb-small', style: { marginBottom: 12 } }, 'Укажи полный путь к GGUF-файлу. Сам файл останется на диске, плагин добавит его в библиотеку.'),
            h('div', { className: 'dlwb-form-grid' },
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-model-path' }, 'Путь к .gguf'), h('input', { id: 'dlwb-model-path', className: 'dlwb-input', value: pathDraft, placeholder: 'D:\\Models\\Qwen3-8B-Q4_K_M.gguf', spellCheck: false, onChange: (event) => setPathDraft(event.target.value) })),
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-model-name' }, 'Название (необязательно)'), h('input', { id: 'dlwb-model-name', className: 'dlwb-input', value: nameDraft, placeholder: 'Qwen3 8B Q4_K_M', onChange: (event) => setNameDraft(event.target.value) })),
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-model-mmproj' }, 'Путь к mmproj (необязательно)'), h('input', { id: 'dlwb-model-mmproj', className: 'dlwb-input', value: mmprojPathDraft, placeholder: 'D:\\Models\\mmproj-model-f16.gguf', spellCheck: false, onChange: (event) => setMmprojPathDraft(event.target.value) }), h('div', { className: 'dlwb-help' }, 'Если рядом ровно один файл mmproj, плагин привяжет его автоматически.'))
            ),
            h('div', { className: 'dlwb-actions', style: { marginTop: 11 } }, button('Добавить модель', () => runAction('add-model', () => api.call('addModel', pathDraft, nameDraft, mmprojPathDraft).then(() => { setPathDraft(''); setNameDraft(''); setMmprojPathDraft('') }), 'Модель добавлена в библиотеку.'), 'primary', !pathDraft.trim() || !!busy)),
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
            scannedFiles.length ? h('div', { className: 'dlwb-file-list' }, scannedFiles.map((file) => {
              const candidates = Array.isArray(file.mmprojCandidates) ? file.mmprojCandidates : []
              const chosenProjector = scanMmprojSelection[file.path] === undefined ? (file.mmprojPath || '') : scanMmprojSelection[file.path]
              return h('div', { className: 'dlwb-file-row', key: file.path },
                h('div', { className: 'dlwb-file-name', style: { flex: 1 } }, h('div', null, file.name), h('div', { className: 'dlwb-muted dlwb-small' }, `${file.relativePath || file.name} · ${(file.sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`),
                  candidates.length > 1 ? h('div', { className: 'dlwb-field', style: { marginTop: 7, maxWidth: 420 } }, h('label', null, 'Проектор mmproj'), h('select', { className: 'dlwb-select', value: chosenProjector, onChange: (event) => setScanMmprojSelection((old) => ({ ...old, [file.path]: event.target.value })) }, h('option', { value: '' }, 'Без Vision'), candidates.map((item) => h('option', { value: item.path, key: item.path }, `${item.name} · ${(item.sizeBytes / 1024 ** 3).toFixed(2)} GB`)))) : chosenProjector ? h('div', { className: 'dlwb-help' }, `mmproj найден: ${pathText(chosenProjector)}`) : null
                ),
                button('Добавить', () => runAction(`scan-add:${file.path}`, () => api.call('addModel', file.path, file.name.replace(/\.gguf$/i, ''), chosenProjector), 'Модель добавлена.'), '', !!busy)
              )
            })) : null
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
        setSuccess('')
        setHubResults([])
        try {
          const results = await api.call('searchHub', hubQuery, hubSort, hubParamsRange, hubWeightRange)
          setHubResults(results)
          setHubSelection({})
          if (!results.length) {
            if (hubWeightRange !== 'any') setSuccess('Нет отдельных GGUF-файлов в выбранном диапазоне веса. Вес проверяется по точным размерам файлов в Hugging Face.')
            else if (hubParamsRange !== 'any') setSuccess('Не найдены GGUF-модели с таким количеством параметров. Не у всех репозиториев Hugging Face заполнены данные о размере модели.')
            else setSuccess('Ничего не найдено. Попробуй короткий запрос: Qwen, Gemma, Llama или Mistral.')
          }
        } catch (e) { setError(errorText(e)) } finally { setHubLoading(false) }
      }

      function renderHub() {
        const download = state && state.download
        return h(React.Fragment, null,
          h('div', { className: 'dlwb-section-head' }, h('div', null, h('h2', { className: 'dlwb-h2' }, 'Hugging Face'), h('div', { className: 'dlwb-muted dlwb-small' }, 'Каталог GGUF для llama.cpp. Модель, shard-части и выбранный mmproj скачиваются как единый комплект.'))),
          h('div', { className: 'dlwb-capability-legend' }, 'Значки показывают заявленные возможности модели и реальную поддержку плагином. Vision включается в DSH только после привязки mmproj и успешного тестового запроса с изображением.'),
          h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-hub-search' },
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-hub-query' }, 'Поиск моделей'), h('input', { id: 'dlwb-hub-query', className: 'dlwb-input', value: hubQuery, placeholder: 'Например: Qwen3, Gemma, Llama', onChange: (event) => setHubQuery(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') searchHub() } })),
              h('div', { className: 'dlwb-field' }, h('label', { htmlFor: 'dlwb-hub-sort' }, 'Сортировка'), h('select', { id: 'dlwb-hub-sort', className: 'dlwb-select', value: hubSort, onChange: (event) => setHubSort(event.target.value) },
                h('option', { value: 'trending' }, 'Популярные'),
                h('option', { value: 'downloads' }, 'По загрузкам'),
                h('option', { value: 'likes' }, 'По лайкам'),
                h('option', { value: 'updated' }, 'Недавно обновлённые')
              )),
              h('div', { className: 'dlwb-hub-search-action' }, button(hubLoading ? 'Поиск…' : hubQuery.trim() ? 'Найти' : 'Показать модели', searchHub, 'primary', hubLoading))
            ),
            h('div', { className: 'dlwb-hub-filters' },
              h('div', { className: 'dlwb-field' },
                h('label', { htmlFor: 'dlwb-hub-params' }, 'Количество параметров'),
                h('select', { id: 'dlwb-hub-params', className: 'dlwb-select', value: hubParamsRange, onChange: (event) => setHubParamsRange(event.target.value) },
                  h('option', { value: 'any' }, 'Любое количество'),
                  h('option', { value: 'upTo4B' }, 'До 4B'),
                  h('option', { value: 'from4To8B' }, '4–8B'),
                  h('option', { value: 'from8To14B' }, '8–14B'),
                  h('option', { value: 'from14To32B' }, '14–32B'),
                  h('option', { value: 'from32To70B' }, '32–70B'),
                  h('option', { value: 'from70B' }, 'От 70B')
                )
              ),
              h('div', { className: 'dlwb-field' },
                h('label', { htmlFor: 'dlwb-hub-weight' }, 'Размер GGUF-файла'),
                h('select', { id: 'dlwb-hub-weight', className: 'dlwb-select', value: hubWeightRange, onChange: (event) => setHubWeightRange(event.target.value) },
                  h('option', { value: 'any' }, 'Любой вес'),
                  h('option', { value: 'upTo2GB' }, 'До 2 GB'),
                  h('option', { value: 'from2To5GB' }, '2–5 GB'),
                  h('option', { value: 'from5To10GB' }, '5–10 GB'),
                  h('option', { value: 'from10To20GB' }, '10–20 GB'),
                  h('option', { value: 'from20GB' }, 'От 20 GB')
                )
              )
            ),
            h('div', { className: 'dlwb-help' }, 'Количество параметров фильтруется через Hugging Face. Вес проверяется по фактическому размеру каждого GGUF-файла. Применить фильтры можно кнопкой поиска.')
          ),
          download ? h('div', { className: 'dlwb-panel' },
            h('div', { className: 'dlwb-card-head' }, h('div', null, h('div', { className: 'dlwb-h2' }, download.status === 'downloading' ? 'Загрузка модели' : download.status === 'complete' ? 'Загрузка завершена' : download.status === 'cancelled' ? 'Загрузка отменена' : 'Ошибка загрузки'), h('div', { className: 'dlwb-muted dlwb-small' }, `${download.repoId || ''} · ${download.filename || ''}`)),
              download.status === 'downloading' ? button('Отменить', () => runAction('cancel-download', () => api.call('cancelDownload')), 'danger') : null
            ),
            h('div', { className: 'dlwb-progress' }, h('span', { style: { width: `${download.progress || 0}%` } })),
            h('div', { className: 'dlwb-muted dlwb-small' }, `${download.fileIndex || 0}/${download.fileCount || 0} файлов · ${download.currentFile || ''}`),
            h('div', { className: 'dlwb-muted dlwb-small' }, `${download.progress || 0}% · ${(download.downloadedBytes || 0).toLocaleString()} / ${(download.totalBytes || 0).toLocaleString()} bytes`),
            download.error ? h('div', { className: 'dlwb-error', style: { marginTop: 8 } }, download.error) : null
          ) : null,
          hubResults.length ? h(React.Fragment, null,
            h('div', { className: 'dlwb-hub-results-head' }, `${hubResults.length} GGUF-репозиториев`, h('span', { className: 'dlwb-muted dlwb-small' }, 'Публичные модели Hugging Face')),
            h('div', { className: 'dlwb-grid' }, hubResults.map((repo) => {
              const selectedFile = hubSelection[repo.id] || repo.files[0].name
              const selectedFileInfo = repo.files.find((file) => file.name === selectedFile) || repo.files[0]
              const projectors = Array.isArray(repo.projectors) ? repo.projectors : []
              const selectedProjectorName = hubMmprojSelection[repo.id] === undefined
                ? (projectors.length === 1 ? projectors[0].name : '')
                : hubMmprojSelection[repo.id]
              const selectedProjectorInfo = projectors.find((file) => file.name === selectedProjectorName)
              const mainDownloadFiles = Array.isArray(selectedFileInfo.downloadFiles) && selectedFileInfo.downloadFiles.length
                ? selectedFileInfo.downloadFiles : [{ name: selectedFileInfo.name, sizeBytes: selectedFileInfo.sizeBytes || 0 }]
              const parameterCount = selectedFileInfo.parameterCountB || repo.parameterCountB
              const parameterLabel = Number.isFinite(Number(parameterCount)) && Number(parameterCount) > 0 ? `${Number(parameterCount).toLocaleString('ru-RU')}B` : 'Не указано'
              const quantizationLabel = selectedFileInfo.quantization && selectedFileInfo.quantization !== 'Unknown' ? selectedFileInfo.quantization : 'Не определено'
              const weightLabel = selectedFileInfo.sizeLabel || (selectedFileInfo.sizeBytes ? `${(selectedFileInfo.sizeBytes / 1024 ** 3).toFixed(2)} GB` : 'Не указан')
              return h('article', { className: 'dlwb-card dlwb-hub-card', key: repo.id },
                h('div', { className: 'dlwb-card-head' },
                  h('div', { style: { minWidth: 0 } },
                    h('div', { className: 'dlwb-muted dlwb-small' }, repo.author),
                    h('a', { className: 'dlwb-hub-repo', href: `https://huggingface.co/${encodeURIComponent(repo.id).replace(/%2F/g, '/')}`, target: '_blank', rel: 'noopener noreferrer' }, repo.id)
                  ),
                  h('span', { className: 'dlwb-tag' }, `${repo.fileCount} GGUF`)
                ),
                h('div', { className: 'dlwb-meta' },
                  h('span', { className: 'dlwb-tag' }, `${repo.downloads.toLocaleString('ru-RU')} загрузок`),
                  h('span', { className: 'dlwb-tag' }, `♥ ${repo.likes.toLocaleString('ru-RU')}`),
                  repo.sources && repo.sources.includes('llama.cpp') ? h('span', { className: 'dlwb-tag dlwb-compat-ok' }, 'llama.cpp') : null
                ),
                capabilityChips(repo.capabilities, 'huggingface'),
                h('div', { className: 'dlwb-compat' }, compatibilityChip({ llamaCppListed: !!(repo.llamaCppListed || (repo.sources && repo.sources.includes('llama.cpp'))) }, 'hub')),
                repo.pipelineTag ? h('div', { className: 'dlwb-muted dlwb-small' }, `Задача HF: ${repo.pipelineTag}`) : null,
                repo.lastModified ? h('div', { className: 'dlwb-muted dlwb-small', style: { margin: '7px 0 10px' } }, `Обновлено: ${new Date(repo.lastModified).toLocaleDateString('ru-RU')}`) : null,
                h('div', { className: 'dlwb-field' }, h('label', null, 'Файл модели'), h('select', { className: 'dlwb-select', value: selectedFile, onChange: (event) => setHubSelection((old) => ({ ...old, [repo.id]: event.target.value })) }, repo.files.map((file) => {
                  const fileParams = file.parameterCountB || repo.parameterCountB
                  const paramsText = Number.isFinite(Number(fileParams)) && Number(fileParams) > 0 ? `${Number(fileParams)}B` : 'B —'
                  const quantText = file.quantization && file.quantization !== 'Unknown' ? file.quantization : 'GGUF'
                  return h('option', { value: file.name, key: file.name }, `${file.name} · ${paramsText} · ${quantText}${file.sizeLabel ? ` · ${file.sizeLabel}` : ''}`)
                }))),
                h('div', { className: 'dlwb-hub-selected-file', 'aria-live': 'polite' },
                  h('strong', null, 'Выбранный GGUF'),
                  h('span', { className: 'dlwb-tag' }, `Параметры: ${parameterLabel}`),
                  h('span', { className: 'dlwb-tag' }, `Квант: ${quantizationLabel}`),
                  h('span', { className: 'dlwb-tag' }, `Вес: ${weightLabel}`),
                  selectedFileInfo.shardCount > 1 ? h('span', { className: 'dlwb-tag' }, `Частей: ${selectedFileInfo.shardCount}`) : null
                ),
                h('div', { className: 'dlwb-field', style: { marginTop: 12 } },
                  h('label', null, 'Vision-проектор (mmproj)'),
                  h('select', { className: 'dlwb-select', value: selectedProjectorName, onChange: (event) => setHubMmprojSelection((old) => ({ ...old, [repo.id]: event.target.value })) },
                    h('option', { value: '' }, 'Без проектора · скачать только текстовую модель'),
                    projectors.map((file) => h('option', { value: file.name, key: file.name }, `${file.name} · ${file.sizeLabel || 'размер неизвестен'}`))
                  ),
                  projectors.length ? h('div', { className: 'dlwb-help' }, 'Проектор будет скачан вместе с моделью и автоматически привязан к ней. Убедись, что он предназначен для выбранной архитектуры и ревизии.')
                    : repo.capabilities && repo.capabilities.some((item) => item.id === 'vision') ? h('div', { className: 'dlwb-help' }, 'HF помечает репозиторий как Vision, но mmproj в этой ревизии не найден. Vision не будет включён без подходящего проектора.')
                    : h('div', { className: 'dlwb-help' }, 'Для обычных текстовых моделей проектор не требуется.')
                ),
                h('div', { className: 'dlwb-actions', style: { marginTop: 11 } }, button('Скачать в библиотеку', () => runAction(`download:${repo.id}`, () => api.call('downloadHubModel', repo.id, selectedFileInfo.name, {
                  pipelineTag: repo.pipelineTag,
                  tags: repo.tags,
                  sources: repo.sources || [repo.source],
                  revision: repo.revision || 'main',
                  displayName: repo.id.split('/').pop(),
                  sizeBytes: selectedFileInfo.sizeBytes || 0,
                  downloadFiles: mainDownloadFiles,
                  mmprojFilename: selectedProjectorInfo ? selectedProjectorInfo.name : '',
                  mmprojSizeBytes: selectedProjectorInfo ? selectedProjectorInfo.sizeBytes : 0,
                }), 'Загрузка завершена. Все компоненты модели добавлены в библиотеку.'), 'primary', !!busy || !!(download && download.status === 'downloading')))
              )
            }))
          ) : hubLoading ? h('div', { className: 'dlwb-empty' }, 'Ищем модели на Hugging Face…') : h('div', { className: 'dlwb-empty' }, hubQuery.trim() ? 'Нет результатов. Попробуй более короткое название семейства модели.' : 'Нажми «Показать модели», чтобы открыть популярные GGUF-модели. Если выбран вес, результаты без точного размера файла не показываются.'),
          h('p', { className: 'dlwb-help' }, 'Значки возможностей основаны на тегах и задаче модели в Hugging Face. Метка llama.cpp означает, что репозиторий указан в каталоге HF для llama.cpp, но не гарантирует поддержку твоей конкретной сборкой. Надёжная локальная проверка — успешный запуск модели в этом плагине.'),
          h('p', { className: 'dlwb-help' }, 'Если репозиторий содержит split GGUF, будут показаны только полные комплекты всех частей. Выбранный mmproj и все shard-файлы скачиваются по одной и той же ревизии HF; каждый размер проверяется до добавления в библиотеку.')
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
