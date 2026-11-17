import React, { useEffect, useRef } from "react"
import { LuAudioLines, LuCopy, LuCornerDownLeft, LuFileText, LuImage, LuSettings } from "react-icons/lu"
import ModelSelector from "../ui/ModelSelector"
import { formatElapsed } from "./useListener"

// Layout and classes observed in Cluely 2.1.28 chat window (690px wide, rgba(9,14,15,0.68) panel).
export interface Message { role: "user" | "gemini"; text: string }
export interface TranscriptEntry { at: number; text: string }

const ICON_BUTTON =
  "pointer-events-auto inline-flex size-10 items-center justify-center rounded-xl bg-transparent text-white/55 transition-[background-color,color] duration-150 hover:bg-white/10 hover:text-white/80 disabled:pointer-events-none disabled:opacity-45"
const TOOLBAR_TEXT_BUTTON =
  "group/toolbar-button pointer-events-auto inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-transparent px-3 py-1 font-semibold text-[12px] text-white/72 leading-none transition-[background-color,color,scale] duration-150 hover:bg-white/[0.145] hover:text-white active:scale-[0.96]"
const SECTION_TITLE = "font-semibold text-[12px] text-white/34 uppercase tracking-[0.14em]"
const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 font-semibold text-[12px] text-white/68 leading-none transition-[background-color,color,scale] duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45"

const Kbd = ({ children, outline }: { children: React.ReactNode; outline?: boolean }) => (
  <span
    className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1.5 font-semibold text-[12px] leading-none ${
      outline ? "h-6 min-w-6 border border-white/[0.2] bg-transparent px-1 text-[11px] text-white/72" : "bg-white/[0.15] text-white/78"
    }`}
  >
    {children}
  </span>
)

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
  mics: MediaDeviceInfo[]
  micId: string
  setMicId: (id: string) => void
  view: "chat" | "transcript"
  setView: (v: "chat" | "transcript") => void
  onNewChat: () => void
  onScreenshot: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  onModelChange: (provider: "ollama" | "gemini", model: string) => void
  onEscape: () => void
}

const ChatPanel: React.FC<Props> = (p) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [p.messages, p.transcript, p.loading])
  useEffect(() => {
    if (!p.loading) inputRef.current?.focus()
  }, [p.loading])

  const hasTranscript = p.transcript.length > 0 || p.isListening

  return (
    <section className="relative w-[690px] overflow-hidden rounded-2xl text-white" style={{ backgroundColor: "rgba(9, 14, 15, 0.68)" }}>
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
            placeholder="Ask anything about the interview, or ⌘ ↵ for help"
            value={p.input}
            disabled={p.loading}
            onChange={(e) => p.setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && p.onEscape()}
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
        <div ref={scrollRef} className="scrollbar-thin max-h-[420px] min-h-0 overflow-y-auto px-4 py-4">
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
        <div ref={scrollRef} className="scrollbar-thin max-h-[420px] min-h-0 overflow-y-auto px-4 py-4">
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

      {hasTranscript && !p.settingsOpen && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {Object.entries(p.asks).map(([label, prompt]) => (
            <button key={label} type="button" disabled={p.loading} className={CHIP} onClick={() => p.onAsk(label, prompt)}>
              {label}
            </button>
          ))}
          {p.listenError && <span className="text-[12px] text-white/50">{p.listenError}</span>}
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
                <Kbd outline>H</Kbd>
              </span>
              <span className="shrink-0 text-white/46">to screenshot or</span>
              <span className="inline-flex shrink-0 items-center gap-0.5">
                <Kbd outline>⌘</Kbd>
                <Kbd outline>B</Kbd>
              </span>
              <span className="min-w-0 truncate text-white/46">to hide</span>
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-0.5">
            <button type="button" aria-label="Analyze screen" title="Take screenshot and analyze" className={ICON_BUTTON} onClick={p.onScreenshot} tabIndex={-1}>
              <LuImage className="size-5" />
            </button>
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
              <>
                <button type="button" aria-label="Listen" title="Start Audio Session" className={ICON_BUTTON} onClick={p.onStartListening} tabIndex={-1}>
                  <LuAudioLines className="size-5" />
                </button>
                {p.mics.length > 1 && (
                  <select
                    aria-label="Audio input"
                    title="Audio input. Pick BlackHole to hear the call audio."
                    className="h-7 max-w-[110px] rounded-md bg-white/[0.08] px-1.5 text-[11px] text-white/60 outline-none"
                    value={p.micId}
                    onChange={(e) => p.setMicId(e.target.value)}
                  >
                    <option value="">Default mic</option>
                    {p.mics.map((m) => (
                      <option key={m.deviceId} value={m.deviceId}>
                        {m.label || "Mic"}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2 pr-3">
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
