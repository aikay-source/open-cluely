// Modes: user-defined instructions + reference files that steer responses, stored in
// userData/modes.json. The active mode's text is prepended to every chat/ask prompt.
import { app } from "electron"
import fs from "fs"
import path from "path"

export interface RefFile {
  name: string
  text: string
}
export interface Mode {
  id: string
  name: string
  instructions: string
  files: RefFile[]
}
interface ModesState {
  modes: Mode[]
  activeId: string
}

const DEFAULTS: ModesState = {
  activeId: "general",
  modes: [
    { id: "general", name: "General", instructions: "", files: [] },
    {
      id: "interview",
      name: "Interview",
      instructions:
        "I am a candidate in a job interview. Help me perform well across behavioral, technical, product, role-fit, and follow-up questions. Use the job description, resume, notes, and any attached files as ground truth when available. Do not fabricate experience, credentials, companies, numbers, or project details. If context is missing, give me an answer structure I can quickly fill in.",
      files: []
    }
  ]
}

function file(): string {
  return path.join(app.getPath("userData"), "modes.json")
}

export const ModesStore = {
  read(): ModesState {
    try {
      const state = JSON.parse(fs.readFileSync(file(), "utf8")) as ModesState
      if (!state.modes?.length) return DEFAULTS
      return state
    } catch {
      ModesStore.write(DEFAULTS)
      return DEFAULTS
    }
  },
  write(state: ModesState): void {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    fs.writeFileSync(file(), JSON.stringify(state))
  },
  setActive(id: string): ModesState {
    const state = ModesStore.read()
    if (state.modes.some((m) => m.id === id)) {
      state.activeId = id
      ModesStore.write(state)
    }
    return state
  },
  // Prompt prefix for the active mode (instructions + reference file text); "" when none.
  activePrefix(): string {
    const state = ModesStore.read()
    const m = state.modes.find((x) => x.id === state.activeId)
    if (!m) return ""
    const parts: string[] = []
    if (m.instructions.trim()) parts.push(m.instructions.trim())
    for (const f of m.files) parts.push(`--- Reference file: ${f.name} ---\n${f.text}`)
    return parts.join("\n\n")
  }
}
