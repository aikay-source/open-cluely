import React, { useEffect, useState } from "react"
import { LuArrowLeft, LuFileText, LuPlay, LuPlus, LuCopy, LuCheck } from "react-icons/lu"
import { formatElapsed } from "./useListener"
import { type TranscriptEntry } from "./ChatPanel"

export interface Message {
  role: "user" | "gemini"
  text: string
}
export interface SessionMeta {
  id: string
  title: string
  startedAt: number
  durationMs: number
}
export interface Session extends SessionMeta {
  transcript: TranscriptEntry[]
  messages: Message[]
  summary: string
}

const dayLabel = (ts: number) => {
  const d = new Date(ts)
  const today = new Date()
  const y = new Date()
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === y.toDateString()) return "Yesterday"
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase()
}
const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })

const List: React.FC<{ sessions: SessionMeta[]; onOpen: (id: string) => void }> = ({ sessions, onOpen }) => {
  if (sessions.length === 0) {
    return <div className="flex min-h-[200px] items-center justify-center text-[14px] text-white/40">No past sessions yet.</div>
  }
  const groups: Record<string, SessionMeta[]> = {}
  for (const s of sessions) (groups[dayLabel(s.startedAt)] ||= []).push(s)
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([label, items]) => (
        <div key={label}>
          <p className="mb-1.5 px-1 font-semibold text-[11px] text-white/35 uppercase tracking-[0.1em]">{label}</p>
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                <LuFileText className="size-4 text-white/60" />
              </div>
              <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-white/90">{s.title || "Untitled session"}</span>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50 tabular-nums">
                {formatElapsed(Math.round(s.durationMs / 1000))}
              </span>
              <span className="shrink-0 text-[12px] text-white/40 tabular-nums">{timeLabel(s.startedAt)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

const DetailBody: React.FC<{ session: Session; showTranscript: boolean; copied: boolean; onCopy: () => void }> = ({
  session,
  showTranscript,
  copied,
  onCopy
}) => (
  <div>
    <h1 className="font-semibold text-[26px] text-white leading-tight">{session.title || "Untitled session"}</h1>
    <div className="mt-2 flex items-center gap-2 text-[12px] text-white/45">
      <span>{new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      <span>·</span>
      <span>{formatElapsed(Math.round(session.durationMs / 1000))}</span>
    </div>

    {showTranscript ? (
      <div className="mt-6 space-y-3">
        {session.transcript.map((t, i) => (
          <div key={i} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
            <span className="pt-0.5 font-medium text-[11px] text-white/34 tabular-nums">{formatElapsed(Math.round(t.at))}</span>
            <p className="whitespace-pre-wrap text-[14px] text-white/75 leading-6">{t.text}</p>
          </div>
        ))}
      </div>
    ) : (
      <>
        <div className="mt-6 flex items-center justify-between">
          <p className="font-semibold text-[12px] text-white/35 uppercase tracking-[0.14em]">Summary</p>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/50 hover:text-white"
          >
            {copied ? <LuCheck className="size-3.5" /> : <LuCopy className="size-3.5" />}
            {copied ? "Copied" : "Copy Summary"}
          </button>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-[15px] text-white/80 leading-7">{session.summary || "No summary available."}</div>
      </>
    )}
  </div>
)

const History: React.FC<{ onClose: () => void; onResume: (s: Session) => void; onNewChat: () => void }> = ({ onClose, onResume, onNewChat }) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [detail, setDetail] = useState<Session | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.electronAPI.invoke("sessions-list").then(setSessions).catch(() => setSessions([]))
  }, [])

  const open = async (id: string) => {
    const s = await window.electronAPI.invoke("sessions-get", id)
    if (s) {
      setDetail(s)
      setShowTranscript(false)
      setCopied(false)
    }
  }

  const copySummary = () => {
    if (!detail) return
    navigator.clipboard.writeText(detail.summary || "").then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <section className="flex max-h-[540px] w-[690px] flex-col overflow-hidden rounded-2xl text-white" style={{ backgroundColor: "rgba(9, 14, 15, 0.82)" }}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-white/[0.06] border-b px-3">
        <button type="button" onClick={detail ? () => setDetail(null) : onClose} aria-label="Back" className="grid size-8 place-items-center rounded-lg bg-white/[0.08] text-white/80 hover:bg-white/[0.12]">
          <LuArrowLeft className="size-4" />
        </button>
        <span className="font-semibold text-[13px] text-white/80">{detail ? "Session" : "History"}</span>
      </div>

      <div className="scrollbar-thin min-h-[240px] flex-1 overflow-y-auto p-4">
        {detail ? (
          <DetailBody session={detail} showTranscript={showTranscript} copied={copied} onCopy={copySummary} />
        ) : (
          <List sessions={sessions} onOpen={open} />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-white/[0.08] px-4 py-3">
        {detail ? (
          <>
            <button type="button" onClick={() => setShowTranscript((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white/60 hover:bg-white/[0.06] hover:text-white">
              <LuFileText className="size-4" />
              {showTranscript ? "Show Summary" : "Show Transcript"}
            </button>
            <button type="button" onClick={() => onResume(detail)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[rgba(9,14,15,0.9)] hover:bg-white/90">
              <LuPlay className="size-3.5 fill-current" /> Resume session
            </button>
          </>
        ) : (
          <>
            <span />
            <button type="button" onClick={onNewChat} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 py-1.5 text-[13px] font-semibold text-white/80 hover:bg-white/[0.12]">
              <LuPlus className="size-3.5" /> New chat
            </button>
          </>
        )}
      </div>
    </section>
  )
}

export default History
