import React, { useEffect, useRef, useState } from "react"
import pkg from "../../package.json" // app version, always matches the build
import {
  LuSettings,
  LuCalendar,
  LuSlidersHorizontal,
  LuKeyboard,
  LuUser,
  LuShield,
  LuCreditCard,
  LuInfo,
  LuEye,
  LuEyeOff,
  LuPower,
  LuSearch,
  LuPlus,
  LuPaperclip,
  LuX,
  LuCheck,
  LuFileText,
  LuMic,
  LuCpu,
  LuTrash2,
  LuRefreshCw,
  LuChevronDown
} from "react-icons/lu"

interface RefFile {
  name: string
  text: string
}
interface Mode {
  id: string
  name: string
  instructions: string
  files: RefFile[]
}
interface ModesState {
  modes: Mode[]
  activeId: string
}

// Settings window matching Cluely's General screen (classes extracted from its bundle).
type Page = "general" | "calendar" | "modes" | "shortcuts" | "account" | "security" | "billing" | "about"

const NAV: { page: Page; label: string; icon: React.ComponentType<{ className?: string }>; gradient: string; description: string }[] = [
  { page: "general", label: "General", icon: LuSettings, gradient: "from-[#b0b0b5] to-[#77777e]", description: "Manage how Open Cluely works on your Mac, including software updates, language, and audio." },
  { page: "calendar", label: "Calendar", icon: LuCalendar, gradient: "from-[#ff757d] to-[#ee3b48]", description: "Connect your calendar to see upcoming meetings and get reminders before they start." },
  { page: "modes", label: "Modes", icon: LuSlidersHorizontal, gradient: "from-[#a58bff] to-[#7860df]", description: "Customize how Open Cluely responds with instructions and reference files." },
  { page: "shortcuts", label: "Keyboard Shortcuts", icon: LuKeyboard, gradient: "from-[#a0a1a8] to-[#6a6c75]", description: "Control Open Cluely from your keyboard." },
  { page: "account", label: "Account", icon: LuUser, gradient: "from-[#67b8ff] to-[#3385ea]", description: "Manage your personal information and connected accounts." },
  { page: "security", label: "Security", icon: LuShield, gradient: "from-[#ff9f6b] to-[#f5653c]", description: "Review the permissions Open Cluely uses." },
  { page: "billing", label: "Billing", icon: LuCreditCard, gradient: "from-[#5fd07a] to-[#34b85a]", description: "Manage your plan and payment details." },
  { page: "about", label: "About", icon: LuInfo, gradient: "from-[#67b8ff] to-[#3385ea]", description: "About Open Cluely." }
]

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#0a84ff]" : "bg-white/15"}`}
  >
    <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-[2px]"}`} />
  </button>
)

const Row: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; description: string; control: React.ReactNode; first?: boolean }> = ({
  icon: Icon,
  title,
  description,
  control,
  first
}) => (
  <div className={`flex items-center justify-between gap-3 py-3.5 ${first ? "" : "border-t border-white/[0.06]"}`}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.045]">
        <Icon className="size-4 text-white/50" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-[13px] text-white/90">{title}</p>
        <div className="mt-0.5 text-[11px] text-white/40 leading-[1.4]">{description}</div>
      </div>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
)

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-medium text-[12px] text-white/55">{children}</h2>
)

// Cloud providers the user can pick. engine tells the main process how to build the client:
// "gemini" uses Google's SDK; everything else is OpenAI-compatible with its own base URL.
const CLOUD_PROVIDERS = [
  { id: "openai", label: "OpenAI", engine: "openai", baseURL: undefined as string | undefined, defaultModel: "gpt-4o-mini", transcribeModel: "whisper-1", keyUrl: "platform.openai.com/api-keys" },
  { id: "openrouter", label: "OpenRouter", engine: "openai", baseURL: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", transcribeModel: undefined, keyUrl: "openrouter.ai/keys" },
  { id: "gemini", label: "Google Gemini", engine: "gemini", baseURL: undefined, defaultModel: "gemini-3.1-flash-lite", transcribeModel: undefined, keyUrl: "aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", engine: "openai", baseURL: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", transcribeModel: "whisper-large-v3", keyUrl: "console.groq.com/keys" },
  { id: "deepseek", label: "DeepSeek", engine: "openai", baseURL: "https://api.deepseek.com", defaultModel: "deepseek-chat", transcribeModel: undefined, keyUrl: "platform.deepseek.com/api_keys" },
  { id: "mistral", label: "Mistral", engine: "openai", baseURL: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", transcribeModel: undefined, keyUrl: "console.mistral.ai/api-keys" },
  { id: "together", label: "Together AI", engine: "openai", baseURL: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", transcribeModel: undefined, keyUrl: "api.together.xyz/settings/api-keys" }
]
const AI_INPUT = "w-full rounded-lg bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:bg-white/[0.08]"

// Compact combobox: shows the current model, opens a small searchable, scrollable list.
const ModelDropdown: React.FC<{
  value: string
  options: string[]
  onChange: (v: string) => void
  loading: boolean
  onRefresh: () => void
  placeholder?: string
}> = ({ value, options, onChange, loading, onRefresh, placeholder }) => {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      const openUp = below < 240 && r.top > below // flip up when there's no room below
      setPos({
        left: r.left,
        width: r.width,
        maxHeight: Math.min(260, (openUp ? r.top : below) - 12),
        ...(openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 })
      })
      setQ("")
    }
    setOpen((o) => !o)
  }
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mt-1 flex gap-2">
      <button ref={btnRef} type="button" onClick={toggle} className={`${AI_INPUT} flex items-center justify-between`}>
        <span className={`truncate ${value ? "text-white" : "text-white/40"}`}>{value || placeholder || "Select a model"}</span>
        <LuChevronDown className="size-4 shrink-0 text-white/40" />
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh models"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/60 hover:bg-white/[0.1] disabled:opacity-50">
        <LuRefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
            className="z-50 flex flex-col overflow-hidden rounded-xl bg-[#232325] p-1 shadow-2xl ring-1 ring-white/10">
            {options.length > 6 && (
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…"
                className="mb-1 w-full shrink-0 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[12px] text-white outline-none placeholder:text-white/30" />
            )}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-2.5 py-2 text-[12px] text-white/40">{loading ? "Loading…" : "No models"}</p>
              ) : filtered.map((o) => (
                <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-white/85 hover:bg-white/[0.07]">
                  <span className="truncate">{o}</span>
                  {o === value && <LuCheck className="size-4 shrink-0 text-[#0a84ff]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const AIModelSettings: React.FC = () => {
  const [kind, setKind] = useState<"cloud" | "local">("cloud")
  const [providerId, setProviderId] = useState("openai")
  const [model, setModel] = useState(CLOUD_PROVIDERS[0].defaultModel)
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
  const [ollamaModel, setOllamaModel] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle")
  const [error, setError] = useState("")
  const [transcribeKey, setTranscribeKey] = useState("")
  const [hasTranscribeKey, setHasTranscribeKey] = useState(false)
  const provider = CLOUD_PROVIDERS.find((p) => p.id === providerId) || CLOUD_PROVIDERS[0]

  useEffect(() => {
    window.electronAPI.invoke("get-ai-config").then((c: any) => {
      if (!c) return
      setHasTranscribeKey(!!c.hasTranscribeKey)
      if (c.kind === "local") {
        setKind("local"); setOllamaUrl(c.ollamaUrl || "http://localhost:11434"); setOllamaModel(c.model || "")
      } else {
        setKind("cloud")
        if (CLOUD_PROVIDERS.some((p) => p.id === c.provider)) setProviderId(c.provider)
        setModel(c.model || ""); setHasKey(!!c.hasKey)
      }
    }).catch(() => {})
  }, [])

  const loadModels = (keyOverride?: string) => {
    const payload = kind === "local"
      ? { engine: "ollama", ollamaUrl }
      : { engine: provider.engine, baseURL: provider.baseURL, apiKey: keyOverride ?? apiKey }
    setLoadingModels(true)
    window.electronAPI.invoke("list-models", payload)
      .then((list: any) => setModels(Array.isArray(list) ? list : []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false))
  }
  // Refresh the model list when the provider or cloud/local mode changes (saved key is used server-side).
  useEffect(() => { loadModels() }, [providerId, kind, ollamaUrl])

  const pickProvider = (id: string) => {
    setProviderId(id)
    setModel(CLOUD_PROVIDERS.find((x) => x.id === id)!.defaultModel)
    setHasKey(false) // a different provider needs its own key
    setModels([])
    setStatus("idle")
  }

  const save = async () => {
    setStatus("saving"); setError("")
    const cfg: any = kind === "local"
      ? { kind: "local", engine: "ollama", provider: "ollama", apiKey: "", model: ollamaModel, ollamaUrl }
      : { kind: "cloud", engine: provider.engine, provider: provider.id, apiKey, baseURL: provider.baseURL, model, transcribeModel: provider.transcribeModel }
    // Optional dedicated fast speech-to-text (Groq), independent of the chat provider above.
    if (transcribeKey || hasTranscribeKey) {
      cfg.transcribeBaseURL = "https://api.groq.com/openai/v1"
      cfg.transcribeModel = "whisper-large-v3-turbo"
      if (transcribeKey) cfg.transcribeApiKey = transcribeKey
    }
    const r = await window.electronAPI.invoke("set-ai-config", cfg).catch((e: any) => ({ success: false, error: String(e) }))
    if (r?.success) { setStatus("ok"); setApiKey(""); if (transcribeKey) setHasTranscribeKey(true); setTranscribeKey(""); if (kind === "cloud") setHasKey(true) }
    else { setStatus("error"); setError(r?.error || "Could not connect to the provider") }
  }

  const canSave = kind === "local" ? true : !!apiKey || hasKey

  return (
    <div className="space-y-3 rounded-xl bg-white/[0.035] p-4">
      <div className="flex gap-1 rounded-lg bg-white/[0.05] p-1">
        {(["cloud", "local"] as const).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setStatus("idle") }}
            className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${kind === k ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white"}`}>
            {k === "cloud" ? "Cloud" : "Local"}
          </button>
        ))}
      </div>

      {kind === "cloud" ? (
        <>
          <div>
            <label className="text-[12px] text-white/55">Provider</label>
            <select value={providerId} onChange={(e) => pickProvider(e.target.value)} className={`mt-1 ${AI_INPUT}`}>
              {CLOUD_PROVIDERS.map((p) => <option key={p.id} value={p.id} className="bg-[#1c1c1e]">{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] text-white/55">API key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => apiKey && loadModels(apiKey)}
              placeholder={hasKey ? "•••••• saved — type to replace" : "Paste your API key"} className={`mt-1 ${AI_INPUT}`} />
            {provider.keyUrl && <p className="mt-1 text-[11px] text-white/35">Get a key at {provider.keyUrl}</p>}
          </div>
          <div>
            <label className="text-[12px] text-white/55">Model</label>
            <ModelDropdown value={model} options={model && !models.includes(model) ? [model, ...models] : models} onChange={setModel} loading={loadingModels} onRefresh={() => loadModels()} />
            {!models.length && <p className="mt-1 text-[11px] text-white/35">{loadingModels ? "Loading models…" : "Enter your API key, then refresh to load the model list."}</p>}
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="text-[12px] text-white/55">Ollama URL</label>
            <input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" className={`mt-1 ${AI_INPUT}`} />
          </div>
          <div>
            <label className="text-[12px] text-white/55">Model</label>
            <ModelDropdown value={ollamaModel} options={ollamaModel && !models.includes(ollamaModel) ? [ollamaModel, ...models] : models} onChange={setOllamaModel} loading={loadingModels} onRefresh={() => loadModels()} placeholder="Select a model…" />
            <p className="mt-1 text-[11px] text-white/35">{loadingModels ? "Loading models…" : "Runs on your machine with Ollama — no API key needed."}</p>
          </div>
        </>
      )}

      <div className="border-t border-white/[0.06] pt-3">
        <label className="text-[12px] text-white/55">Speech-to-text (optional)</label>
        <input type="password" value={transcribeKey} onChange={(e) => setTranscribeKey(e.target.value)}
          placeholder={hasTranscribeKey ? "•••••• Groq key saved — type to replace" : "Paste a Groq API key for fast, accurate Listen"}
          className={`mt-1 ${AI_INPUT}`} />
        <p className="mt-1 text-[11px] text-white/35">Uses Groq whisper-large-v3-turbo just for Listen — much faster and more accurate than the default. Get a free key at console.groq.com/keys.</p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={save} disabled={status === "saving" || !canSave}
          className="rounded-lg bg-[#0a84ff] px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50">
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "ok" && <span className="text-[12px] text-emerald-400">Saved and connected.</span>}
        {status === "error" && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
    </div>
  )
}

const General: React.FC = () => {
  const [undetectable, setUndetectable] = useState(false)
  const [openAtLogin, setOpenAtLogin] = useState(false)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [micId, setMicId] = useState("")

  useEffect(() => {
    window.electronAPI
      .invoke("get-general-settings")
      .then((s: { undetectability: boolean; openAtLogin: boolean }) => {
        setUndetectable(s.undetectability)
        setOpenAtLogin(s.openAtLogin)
      })
      .catch(() => undefined)
    try {
      setMicId(localStorage.getItem("ocMicId") || "")
    } catch {
      /* ignore */
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) => setMics(d.filter((x) => x.kind === "audioinput")))
      .catch(() => undefined)
  }, [])

  const changeMic = (id: string) => {
    setMicId(id)
    try {
      localStorage.setItem("ocMicId", id)
    } catch {
      /* ignore */
    }
  }

  const toggleUndetectable = (v: boolean) => {
    setUndetectable(v)
    window.electronAPI.invoke("set-undetectability", v)
  }
  const toggleOpenAtLogin = (v: boolean) => {
    setOpenAtLogin(v)
    window.electronAPI.invoke("set-open-at-login", v)
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-7 px-8 py-6">
      {/* Header card */}
      <div className="rounded-2xl bg-white/[0.035] px-6 py-7 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-[18px] bg-gradient-to-b from-[#b0b0b5] to-[#77777e] shadow-lg">
          <LuSettings className="size-8 text-white" />
        </div>
        <h1 className="mt-4 font-semibold text-[22px] text-white">General</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-white/55 leading-snug">
          Manage how Open Cluely works on your Mac, including software updates and audio.
        </p>
      </div>

      <section className="space-y-2">
        <SectionTitle>Software Update</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={LuInfo}
            title="Open Cluely"
            description={`Version ${pkg.version}`}
            control={<span className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 text-[12px] text-white/80"><span aria-hidden>✓</span> Up to date</span>}
          />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Preferences</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={undetectable ? LuEyeOff : LuEye}
            title="Undetectability"
            description="Hide Open Cluely from screen sharing and recordings."
            control={<Switch checked={undetectable} onChange={toggleUndetectable} />}
          />
          <Row
            icon={LuPower}
            title="Open at login"
            description="Automatically open Open Cluely when you log in."
            control={<Switch checked={openAtLogin} onChange={toggleOpenAtLogin} />}
          />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Audio</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={LuMic}
            title="Microphone"
            description="Input used for Listen sessions. Pick BlackHole to capture call audio."
            control={
              <select
                aria-label="Microphone"
                value={micId}
                onChange={(e) => changeMic(e.target.value)}
                className="h-8 max-w-[180px] rounded-lg bg-white/[0.08] px-2 text-[12px] text-white/80 outline-none"
              >
                <option value="">Default microphone</option>
                {mics.map((m, i) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>AI Model</SectionTitle>
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-4 py-3">
          <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.045]">
            <LuCpu className="size-4 text-white/50" />
          </div>
          <p className="text-[11px] text-white/40 leading-[1.4]">Choose a cloud provider and enter its API key, or run locally with Ollama.</p>
        </div>
        <AIModelSettings />
      </section>

      <section className="space-y-2">
        <SectionTitle>Quit</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={LuPower}
            title="Quit Open Cluely"
            description="Fully close the app and the floating widget."
            control={
              <button
                onClick={() => window.electronAPI.quitApp()}
                className="inline-flex h-7 items-center rounded-md bg-red-500/20 px-3 text-[12px] text-red-200 hover:bg-red-500/30"
              >
                Quit
              </button>
            }
          />
        </div>
      </section>
    </div>
  )
}

const Modes: React.FC = () => {
  const [state, setState] = useState<ModesState | null>(null)
  const [selectedId, setSelectedId] = useState<string>("")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.electronAPI.invoke("modes-get").then((s: ModesState) => {
      setState(s)
      setSelectedId(s.activeId || s.modes[0]?.id || "")
    })
  }, [])

  // Persist (debounced) whenever modes change.
  const update = (next: ModesState) => {
    setState(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => window.electronAPI.invoke("modes-save", next), 400)
  }

  if (!state) return <div className="px-8 py-6 text-[13px] text-white/40">Loading…</div>

  const selected = state.modes.find((m) => m.id === selectedId) || state.modes[0]
  const isGeneral = selected.id === "general"
  const patchSelected = (patch: Partial<Mode>) =>
    update({ ...state, modes: state.modes.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)) })

  const addMode = () => {
    const id = crypto.randomUUID()
    update({ ...state, modes: [...state.modes, { id, name: "New Mode", instructions: "", files: [] }] })
    setSelectedId(id)
  }
  const deleteMode = (id: string) => {
    if (state.modes.length <= 1) return
    const modes = state.modes.filter((m) => m.id !== id)
    const activeId = state.activeId === id ? modes[0].id : state.activeId
    update({ ...state, modes, activeId })
    if (selectedId === id) setSelectedId(modes[0].id)
  }
  const setActive = (id: string) => {
    update({ ...state, activeId: id })
    window.electronAPI.invoke("modes-set-active", id)
  }
  const addFile = async () => {
    const f: RefFile | null = await window.electronAPI.invoke("pick-reference-file")
    if (f && f.name) patchSelected({ files: [...selected.files, f] })
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Mode list */}
      <div className="w-[200px] shrink-0 overflow-y-auto border-r border-white/[0.06] px-3 py-5">
        <button type="button" onClick={addMode} className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.05] hover:text-white">
          <LuPlus className="size-4" /> New Mode
        </button>
        {state.modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${selected.id === m.id ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
          >
            <LuSlidersHorizontal className="size-3.5 shrink-0 text-white/45" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-white/90">{m.name}</span>
            {state.activeId === m.id && <LuCheck className="size-3.5 shrink-0 text-[#0a84ff]" />}
          </button>
        ))}
      </div>

      {/* Right panel: General is a read-only preview; other modes are editable */}
      {isGeneral ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
            <h2 className="font-semibold text-[20px] text-white">General</h2>
            <p className="mt-2 text-[14px] text-white/55 leading-6">Flexible help for everyday conversations. Open Cluely uses the conversation and any screen context you share to help you think, write, and respond.</p>
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h3 className="font-semibold text-[15px] text-white">Instructions</h3>
              <p className="mt-1.5 text-[13px] text-white/45 leading-6">Open Cluely's default behavior, with no custom prompt.</p>
            </div>
            <div className="mt-5 border-t border-white/[0.08] pt-5">
              <h3 className="font-semibold text-[15px] text-white">Reference files</h3>
              <p className="mt-1.5 text-[13px] text-white/45 leading-6">No files attached. Create a mode to add your own documents and context.</p>
            </div>
            <p className="mt-6 border-t border-white/[0.06] pt-5 text-[12px] text-white/30 leading-5">For a specific task, choose a template on the left or start with New Mode.</p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.08] px-7 py-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white/80">Previewing General</p>
              <p className="text-[11px] text-white/40">Activate to use it in your conversations.</p>
            </div>
            {state.activeId === "general" ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#0a84ff]"><LuCheck className="size-4" /> Active</span>
            ) : (
              <button type="button" onClick={() => setActive("general")} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0a84ff] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:brightness-110">
                <LuCheck className="size-4" /> Use this mode
              </button>
            )}
          </div>
        </div>
      ) : (
      <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
        <p className="text-[13px] text-white/55">Tailor Open Cluely's responses with instructions and reference files.</p>

        <div className="mt-5">
          <label className="text-[12px] font-medium text-white/55">Mode name</label>
          <input
            value={selected.name}
            onChange={(e) => patchSelected({ name: e.target.value })}
            className="mt-1.5 w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[14px] text-white outline-none focus:bg-white/[0.07]"
          />
        </div>

        <div className="mt-5">
          <label className="text-[12px] font-medium text-white/55">Instructions</label>
          <textarea
            value={selected.instructions}
            onChange={(e) => patchSelected({ instructions: e.target.value })}
            rows={7}
            placeholder="e.g. I am a candidate in a job interview. Help me answer clearly…"
            className="mt-1.5 w-full resize-none rounded-xl bg-white/[0.05] px-3.5 py-3 text-[14px] text-white/90 leading-6 outline-none placeholder:text-white/30 focus:bg-white/[0.07]"
          />
        </div>

        <div className="mt-5">
          <label className="text-[12px] font-medium text-white/55">Files</label>
          <p className="mt-0.5 text-[11px] text-white/35">PDF, text, Markdown, and code files.</p>
          <div className="mt-2 space-y-2">
            {selected.files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                  <LuFileText className="size-4 text-white/60" />
                </div>
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{f.name}</span>
                <button type="button" aria-label="Remove file" onClick={() => patchSelected({ files: selected.files.filter((_, j) => j !== i) })} className="text-white/40 hover:text-white">
                  <LuX className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addFile} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-[13px] text-white/60 hover:bg-white/[0.03] hover:text-white">
            <LuPaperclip className="size-4" /> Add reference file
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white/80">Using {selected.name}</p>
            <p className="text-[11px] text-white/40">This mode guides Open Cluely's responses.</p>
          </div>
          {state.activeId === selected.id ? (
            <div className="flex shrink-0 items-center gap-2">
              {state.modes.length > 1 && (
                <button type="button" aria-label="Delete mode" onClick={() => deleteMode(selected.id)} className="grid size-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-red-300"><LuTrash2 className="size-4" /></button>
              )}
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#0a84ff]"><LuCheck className="size-4" /> Active</span>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {state.modes.length > 1 && (
                <button type="button" aria-label="Delete mode" onClick={() => deleteMode(selected.id)} className="grid size-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-red-300"><LuTrash2 className="size-4" /></button>
              )}
              <button type="button" onClick={() => setActive(selected.id)} className="shrink-0 whitespace-nowrap rounded-lg bg-white/[0.1] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/[0.15]">Use this mode</button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

const Placeholder: React.FC<{ item: (typeof NAV)[number] }> = ({ item }) => (
  <div className="mx-auto w-full max-w-[560px] px-8 py-6">
    <div className="rounded-2xl bg-white/[0.035] px-6 py-7 text-center">
      <div className={`mx-auto grid size-16 place-items-center rounded-[18px] bg-gradient-to-b ${item.gradient} shadow-lg`}>
        <item.icon className="size-8 text-white" />
      </div>
      <h1 className="mt-4 font-semibold text-[22px] text-white">{item.label}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-white/55 leading-snug">{item.description}</p>
      <p className="mt-4 text-[12px] text-white/35">Coming soon.</p>
    </div>
  </div>
)

const initialPage = ((): Page => {
  const t = new URLSearchParams(window.location.search).get("tab")
  return NAV.some((n) => n.page === t) ? (t as Page) : "general"
})()

const Settings: React.FC = () => {
  const [page, setPage] = useState<Page>(initialPage)
  const active = NAV.find((n) => n.page === page)!

  useEffect(() => {
    // Switch tab when the overlay asks an already-open Settings window to show a specific page.
    const cb = (_e: unknown, tab: string) => { if (NAV.some((n) => n.page === tab)) setPage(tab as Page) }
    const off = (window as any).electronAPI?.onSettingsTab?.(cb)
    return () => off?.()
  }, [])

  return (
    <div className="flex h-screen w-screen select-none bg-[#1c1c1e] text-white">
      {/* Sidebar */}
      <aside className="flex w-[244px] shrink-0 flex-col border-r border-white/[0.06] bg-[#161618] px-3 pb-3 pt-10">
        <div className="app-region-drag absolute left-0 top-0 h-10 w-full" />
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/40">
          <LuSearch className="size-3.5" />
          <input className="w-full bg-transparent text-[12px] text-white/80 placeholder:text-white/35 outline-none" placeholder="Search" />
        </div>
        <div className="mb-3 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-[#6a6c75] to-[#3a3b40] text-[12px] font-semibold">OC</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Open Cluely</p>
            <p className="truncate text-[11px] text-white/45">Local settings</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.page}
              type="button"
              onClick={() => setPage(n.page)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${page === n.page ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
            >
              <div className={`grid size-7 shrink-0 place-items-center rounded-[7px] bg-gradient-to-b ${n.gradient}`}>
                <n.icon className="size-4 text-white" />
              </div>
              <span className="truncate text-[13px] font-medium text-white/90">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] pt-2 text-[12px] text-white/40">Open Cluely</div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1 overflow-hidden pt-10">
        {page === "general" ? (
          <div className="h-full overflow-y-auto"><General /></div>
        ) : page === "modes" ? (
          <Modes />
        ) : (
          <div className="h-full overflow-y-auto"><Placeholder item={active} /></div>
        )}
      </main>
    </div>
  )
}

export default Settings
