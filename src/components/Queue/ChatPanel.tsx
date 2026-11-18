import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { LuAudioLines, LuCheck, LuCopy, LuCornerDownLeft, LuFileText, LuHistory, LuImage, LuLayoutGrid, LuMessageSquare, LuRefreshCw, LuSettings, LuSparkles, LuWandSparkles } from "react-icons/lu"
import ModelSelector from "../ui/ModelSelector"
import { formatElapsed } from "./useListener"
import { startWindowDrag } from "./drag"

// Layout and classes observed in Cluely 2.1.28 chat window (690px wide, rgba(9,14,15,0.68) panel).
export interface Message { role: "user" | "gemini"; text: string }
export interface TranscriptEntry { at: number; text: string }

const ICON_BUTTON =
  "pointer-events-auto inline-flex size-10 items-center justify-center rounded-xl bg-transparent text-white/55 transition-[background-color,color] duration-150 hover:bg-white/10 hover:text-white/80 disabled:pointer-events-none disabled:opacity-45"
const TOOLBAR_TEXT_BUTTON =
  "group/toolbar-button pointer-events-auto inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-transparent px-3 py-1 font-semibold text-[12px] text-white/72 leading-none transition-[background-color,color,scale] duration-150 hover:bg-white/[0.145] hover:text-white active:scale-[0.96]"
const SECTION_TITLE = "font-semibold text-[12px] text-white/34 uppercase tracking-[0.14em]"
// Cluely's four preset asks. Labels are the keys into Queue's ASKS prompt map.
const CHIPS = [
  { label: "Assist", icon: LuSparkles },
  { label: "What should I say?", icon: LuWandSparkles },
  { label: "Follow-up questions", icon: LuMessageSquare },
  { label: "Recap", icon: LuRefreshCw }
] as const

const Kbd = ({ children, outline }: { children: React.ReactNode; outline?: boolean }) => (
  <span
    className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1.5 font-semibold text-[12px] leading-none ${
      outline ? "h-6 min-w-6 border border-white/[0.2] bg-transparent px-1 text-[11px] text-white/72" : "bg-white/[0.15] text-white/78"
    }`}
  >
    {children}
  </span>
)

// Toolbar mode switcher: shows the active mode and lets you pick another.
const ModeSwitcher: React.FC = () => {
  const [modes, setModes] = useState<{ id: string; name: string }[]>([])
  const [activeId, setActiveId] = useState("")
  const [open, setOpen] = useState(false)
  // Anchor measured from the button so the downward menu (fixed) escapes the panel's
  // overflow-hidden; while open we grow the window so the menu isn't clipped at the bottom.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const load = () => window.electronAPI.invoke("modes-get").then((s: any) => { setModes(s.modes); setActiveId(s.activeId) })
  useEffect(() => { load() }, [])
  const activeName = modes.find((m) => m.id === activeId)?.name || "General"
  const toggle = () => {
    if (!open && btnRef.current) {
      load()
      const r = btnRef.current.getBoundingClientRect()
      setPos({ left: r.left - 24, top: r.bottom + 8 })
    }
    setOpen((o) => !o)
  }
  // Grow the overlay to fit the open menu; restore on close/unmount.
  useLayoutEffect(() => {
    if (open && pos && menuRef.current) {
      window.electronAPI.invoke("set-overlay-min-height", Math.ceil(pos.top + menuRef.current.offsetHeight + 12))
    } else {
      window.electronAPI.invoke("set-overlay-min-height", 0)
    }
    return () => { window.electronAPI.invoke("set-overlay-min-height", 0) }
  }, [open, pos, modes.length])
  const close = () => setOpen(false)
  return (
    <div className="relative">
      <button ref={btnRef} type="button" aria-label={`Mode: ${activeName}`} title={`Mode: ${activeName}`} className={ICON_BUTTON} onClick={toggle} tabIndex={-1}>
        <LuLayoutGrid className="size-5" />
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={(e) => e.stopPropagation()} onClick={close} />
          <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: pos.left, top: pos.top }}
            className="z-50 w-[200px] rounded-xl bg-[#141416] p-1 shadow-2xl ring-1 ring-white/10"
          >
            <div className="scrollbar-thin max-h-[160px] overflow-y-auto">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { window.electronAPI.invoke("modes-set-active", m.id); setActiveId(m.id); close() }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] text-white/90 hover:bg-white/[0.07]"
                >
                  <span className="truncate">{m.name}</span>
                  {m.id === activeId && <LuCheck className="size-4 shrink-0 text-white" />}
                </button>
              ))}
            </div>
            <div className="my-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => { window.electronAPI.invoke("open-settings", "modes"); close() }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-white/90 hover:bg-white/[0.07]"
            >
              <LuLayoutGrid className="size-4 text-white/70" /> Manage
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface Props {
  messages: Message[]
  loading: boolean
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onAsk: (label: string, prompt: string) => void
  asks: Record<string, string>
  transcript: TranscriptEntry[]
  onClearTranscript: () => void
  isListening: boolean
  elapsed: number
  listenError: string | null
  onStartListening: () => void
  onStopListening: () => void
  view: "chat" | "transcript"
  setView: (v: "chat" | "transcript") => void
  onNewChat: () => void
  onOpenHistory: () => void
  screenContext: boolean
  onToggleScreenContext: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  onModelChange: (provider: "ollama" | "gemini", model: string) => void
  onEscape: () => void
}

const ChatPanel: React.FC<Props> = (p) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  // Stick to the bottom only when the user is already there, so scrolling up to read stays put.
  const onScroll = () => {
    const el = scrollRef.current
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  useEffect(() => {
    if (atBottom.current) scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [p.messages, p.transcript, p.loading])
  useEffect(() => {
    if (!p.loading) inputRef.current?.focus()
  }, [p.loading])

  const hasTranscript = p.transcript.length > 0 || p.isListening

  return (
    <section data-clickable onMouseDown={startWindowDrag} className="relative w-[690px] overflow-hidden rounded-2xl text-white" style={{ backgroundColor: "rgba(9, 14, 15, 0.68)" }}>
      <form
        className="relative z-10 shrink-0"
        onSubmit={(e) => {
          e.preventDefault()
          p.onSend()
        }}
      >
        <div className="relative min-h-14 overflow-hidden rounded-t-2xl bg-white/[0.18]">
          <input
            ref={inputRef}
            className="min-h-14 w-[calc(100%-3.5rem)] bg-transparent py-[18px] pr-2 pl-4 text-[15px] text-white leading-5 outline-none placeholder:font-medium placeholder:text-white/50"
            placeholder={p.screenContext ? "Ask anything about your screen" : "Ask or search anything"}
            value={p.input}
            disabled={p.loading}
            onChange={(e) => p.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") return p.onEscape()
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault()
                p.onAsk("Assist", p.asks["Assist"])
              }
            }}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={p.loading || !p.input.trim()}
            className="absolute top-1/2 right-3 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white/[0.16] text-white transition-colors hover:bg-white/[0.22] disabled:opacity-45"
          >
            <LuCornerDownLeft className="size-3.5 stroke-[2.25]" />
          </button>
        </div>
      </form>

      {p.settingsOpen ? (
        <div className="px-4 py-4">
          <ModelSelector onModelChange={p.onModelChange} onChatOpen={() => undefined} />
        </div>
      ) : p.view === "transcript" ? (
        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin max-h-[420px] min-h-0 overflow-y-auto px-4 py-4">
          <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
            <h3 className={SECTION_TITLE}>Transcript</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={p.transcript.length === 0}
                onClick={() => navigator.clipboard.writeText(p.transcript.map((t) => `[${formatElapsed(t.at)}] ${t.text}`).join("\n"))}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-transparent px-2.5 font-semibold text-[12px] text-white/52 leading-none transition-[background-color,color,scale] duration-150 hover:bg-white/[0.08] hover:text-white/76 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
              >
                <LuCopy className="size-3.5 stroke-[2.25]" />
                Copy Transcript
              </button>
              <button
                type="button"
                disabled={p.transcript.length === 0}
                onClick={p.onClearTranscript}
                className="inline-flex h-8 items-center rounded-lg px-2.5 font-semibold text-[12px] text-white/52 hover:bg-white/[0.08] hover:text-white/76 disabled:pointer-events-none disabled:opacity-35"
              >
                Clear
              </button>
            </div>
          </div>
          {p.transcript.length === 0 && !p.isListening ? (
            <div className="flex min-h-[360px] items-center justify-center text-center">
              <p className="text-[16px] text-white/38 leading-7">Transcript will appear as people speak.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {p.transcript.map((t, i) => (
                <div key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
                  <span className="pt-0.5 font-medium text-[11px] text-white/34 tabular-nums leading-5">{formatElapsed(t.at)}</span>
                  <div className="min-w-0">
                    <p className="mb-1 font-semibold text-[11px] text-white/36 uppercase leading-none tracking-[0.14em]">Heard</p>
                    <p className="whitespace-pre-wrap text-[16px] text-white/76 leading-7">{t.text}</p>
                  </div>
                </div>
              ))}
              {p.isListening && (
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
                  <span className="pt-0.5 font-medium text-[11px] text-white/34 tabular-nums leading-5">Now</span>
                  <div className="min-w-0">
                    <p className="mb-1 font-semibold text-[11px] text-white/36 uppercase leading-none tracking-[0.14em]">Heard</p>
                    <div className="flex min-h-7 items-center gap-2">
                      <span role="status" aria-label="Voice activity" className="size-2.5 animate-pulse rounded-full bg-white/66" />
                      <span className="font-medium text-[13px] text-white/42 leading-5">Listening...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div ref={scrollRef} onScroll={onScroll} className="scrollbar-thin max-h-[420px] min-h-0 overflow-y-auto px-4 py-4">
          {p.messages.length === 0 && !p.loading ? (
            <div className="flex h-full min-h-[160px] items-center justify-center">
              <p className="text-center text-[14px] text-white/45">Ask anything. This chat is ephemeral and won’t be saved.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {p.messages.map((m, i) => (
                <div key={i} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] whitespace-pre-line rounded-2xl bg-[oklch(68%_0.15_237_/_0.3)] px-3 py-2 text-[14px] text-white leading-6">{m.text}</div>
                  ) : (
                    <div className="max-w-[90%] whitespace-pre-line rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] text-white/85 leading-6">{m.text}</div>
                  )}
                </div>
              ))}
              {p.loading && (
                <div className="flex w-full justify-start px-1 py-2">
                  <span className="size-2.5 animate-pulse rounded-full bg-white/66" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!p.settingsOpen && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 text-[13px] text-white/70">
          {CHIPS.map((c, i) => (
            <React.Fragment key={c.label}>
              {i > 0 && <span aria-hidden className="text-white/20">·</span>}
              <button
                type="button"
                disabled={p.loading}
                onClick={() => p.onAsk(c.label, p.asks[c.label])}
                className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-white disabled:opacity-50"
              >
                <c.icon className="size-3.5" /> {c.label}
              </button>
            </React.Fragment>
          ))}
          {p.listenError && <span className="ml-auto text-[12px] text-white/50">{p.listenError}</span>}
        </div>
      )}

      <div className="relative z-10 flex w-full shrink-0 flex-col">
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center bg-black/[0.13] text-white/70">
          <div className="flex min-w-0 items-center justify-start gap-2 pl-3">
            <button
              type="button"
              aria-label="Open Settings"
              aria-pressed={p.settingsOpen}
              onClick={p.onToggleSettings}
              className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 hover:text-white/80 ${p.settingsOpen ? "bg-white/10 text-white" : "text-white/55"}`}
            >
              <LuSettings className="size-4" />
            </button>
            <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[12px]">
              <span className="shrink-0 text-white/46">Press</span>
              <span className="inline-flex shrink-0 items-center gap-0.5">
                <Kbd outline>⌘</Kbd>
                <Kbd outline>B</Kbd>
              </span>
              <span className="min-w-0 truncate text-white/46">to hide</span>
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-0.5">
            <button
              type="button"
              aria-label="Use screen as context"
              aria-pressed={p.screenContext}
              title={p.screenContext ? "Screen is used as context (on)" : "Use screen as context (off)"}
              className={`${ICON_BUTTON} ${p.screenContext ? "bg-white/10 text-white" : ""}`}
              onClick={p.onToggleScreenContext}
              tabIndex={-1}
            >
              <LuImage className="size-5" />
            </button>
            <ModeSwitcher />
            <div aria-hidden className="h-5 w-px bg-white/[0.08]" />
            {p.isListening ? (
              <div className="ml-2 flex h-10 items-center justify-center">
                <div className="z-20 flex h-9 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Stop recording"
                    title="Stop recording"
                    onClick={p.onStopListening}
                    className="pointer-events-auto inline-flex size-[26px] items-center justify-center rounded-full bg-white text-[rgba(9,14,15,0.9)] transition-[background-color,color] duration-150 hover:bg-white/90"
                  >
                    <span aria-hidden className="size-2.5 rounded-[2px] bg-current" />
                  </button>
                  <span className="min-w-[2.65rem] text-left font-medium text-[12px] text-white/72 tabular-nums leading-none">{formatElapsed(p.elapsed)}</span>
                </div>
              </div>
            ) : (
              <button type="button" aria-label="Listen" title="Start Audio Session" className={ICON_BUTTON} onClick={p.onStartListening} tabIndex={-1}>
                <LuAudioLines className="size-5" />
              </button>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 pr-3">
            <button type="button" aria-label="History" className={`${TOOLBAR_TEXT_BUTTON} pr-2`} onClick={p.onOpenHistory} tabIndex={-1}>
              <LuHistory className="size-4 stroke-[2.25]" />
              <span className="whitespace-nowrap">History</span>
            </button>
            {hasTranscript ? (
              <button type="button" className={TOOLBAR_TEXT_BUTTON} onClick={() => p.setView(p.view === "transcript" ? "chat" : "transcript")} tabIndex={-1}>
                <LuFileText className="size-4 stroke-[2.25]" />
                <span>{p.view === "transcript" ? "View Chat" : "View Transcript"}</span>
              </button>
            ) : (
              <button type="button" aria-label="New Chat" className={`${TOOLBAR_TEXT_BUTTON} pr-1.5`} onClick={p.onNewChat} tabIndex={-1}>
                <span className="whitespace-nowrap">New Chat</span>
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  <Kbd>⌘</Kbd>
                  <Kbd>R</Kbd>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ChatPanel
