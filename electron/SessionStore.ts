// Persist each listening session as a JSON file under userData/sessions, like Cluely's notes.
import { app } from "electron"
import fs from "fs"
import path from "path"

export interface TranscriptEntry {
  at: number
  text: string
}
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

function dir(): string {
  const d = path.join(app.getPath("userData"), "sessions")
  fs.mkdirSync(d, { recursive: true })
  return d
}

export const SessionStore = {
  list(): SessionMeta[] {
    return fs.readdirSync(dir())
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(dir(), f), "utf8")) as Session
          return { id: s.id, title: s.title, startedAt: s.startedAt, durationMs: s.durationMs }
        } catch {
          return null
        }
      })
      .filter((x): x is SessionMeta => x !== null)
      .sort((a, b) => b.startedAt - a.startedAt)
  },
  get(id: string): Session | null {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir(), `${id}.json`), "utf8"))
    } catch {
      return null
    }
  },
  save(session: Session): void {
    fs.writeFileSync(path.join(dir(), `${session.id}.json`), JSON.stringify(session))
  },
  delete(id: string): void {
    try {
      fs.unlinkSync(path.join(dir(), `${id}.json`))
    } catch {
      /* already gone */
    }
  }
}
