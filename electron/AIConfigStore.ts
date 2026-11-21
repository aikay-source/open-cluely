// AI provider config the user sets in-app (Settings → AI Model), stored in userData/ai-config.json.
// Takes precedence over the .env fallback in ProcessingHelper. The API key stays on this machine
// and is never logged or sent back to the renderer.
import { app } from "electron"
import fs from "fs"
import path from "path"

export interface AIConfig {
  kind: "cloud" | "local"
  engine: "gemini" | "openai" | "ollama" // how ProcessingHelper builds the LLM client
  provider: string // display id: openai | openrouter | gemini | groq | deepseek | mistral | together | ollama
  apiKey: string
  baseURL?: string // for OpenAI-compatible providers
  model: string
  transcribeModel?: string
  // Optional dedicated speech-to-text provider (e.g. Groq whisper-large-v3-turbo), independent
  // of the chat provider. When transcribeApiKey is set, transcription uses this instead.
  transcribeApiKey?: string
  transcribeBaseURL?: string
  ollamaUrl?: string
}

function file(): string {
  return path.join(app.getPath("userData"), "ai-config.json")
}

export const AIConfigStore = {
  read(): AIConfig | null {
    try {
      return JSON.parse(fs.readFileSync(file(), "utf8")) as AIConfig
    } catch {
      return null
    }
  },
  write(cfg: AIConfig): void {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    fs.writeFileSync(file(), JSON.stringify(cfg))
  }
}
