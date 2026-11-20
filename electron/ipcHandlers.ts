// ipcHandlers.ts

import { ipcMain, app, dialog, desktopCapturer, systemPreferences } from "electron"
import fs from "fs"
import path from "path"
import { AppState } from "./main"
import { SessionStore, Session } from "./SessionStore"
import { ModesStore, Mode } from "./ModesStore"
import { AIConfigStore, AIConfig } from "./AIConfigStore"

// Extract plain text from a reference file (PDF via pdf-parse, everything else read as text).
async function extractText(filePath: string): Promise<string> {
  if (path.extname(filePath).toLowerCase() === ".pdf") {
    const pdf = require("pdf-parse")
    const data = await pdf(fs.readFileSync(filePath))
    return data.text
  }
  return fs.readFileSync(filePath, "utf8")
}

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  ipcMain.handle("transcribe-audio", (event, data: string, mimeType: string) =>
    appState.processingHelper.getLLMHelper().transcribeAudio(data, mimeType)
  )

  // Prepend the active mode's instructions + reference files to a prompt.
  const withMode = (message: string) => {
    const prefix = ModesStore.activePrefix()
    return prefix ? `${prefix}\n\n---\n\n${message}` : message
  }

  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().chatWithGemini(withMode(message));
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error);
      throw error;
    }
  });

  // Ask with the current screen attached (screen-context toggle ON).
  // Deliberately NOT wrapped in withMode: the screen is the task, and a mode persona
  // (e.g. "I am in a behavioral interview") hijacks it into asking questions instead of solving.
  ipcMain.handle("ask-with-screen", async (event, message: string) => {
    let imageBase64: string
    try {
      const screenshotPath = await appState.takeScreenshot()
      imageBase64 = (await fs.promises.readFile(screenshotPath)).toString("base64")
    } catch {
      return "I couldn't capture your screen. Turn on Open Cluely under System Settings → Privacy & Security → Screen Recording, then try again."
    }
    return appState.processingHelper.getLLMHelper().askWithImage(message, imageBase64)
  });

  // Warm up ScreenCaptureKit (and prompt if needed) when the screen-context toggle turns on.
  ipcMain.handle("request-screen-access", async () => {
    if (process.platform === "darwin" && systemPreferences.getMediaAccessStatus("screen") === "granted") {
      // Already granted: a 1px capture primes ScreenCaptureKit so the first real capture isn't blank.
      await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {})
      return
    }
    try {
      await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    } catch {
      /* macOS shows its own prompt */
    }
  });

  // Modes (instructions + reference files that steer responses)
  ipcMain.handle("modes-get", () => ModesStore.read())
  ipcMain.handle("modes-save", (_e, state: { modes: Mode[]; activeId: string }) => {
    ModesStore.write(state)
    return state
  })
  ipcMain.handle("modes-set-active", (_e, id: string) => ModesStore.setActive(id))
  ipcMain.handle("pick-reference-file", async () => {
    // Cast around the stale @types/electron in devDependencies (it mistypes showOpenDialog).
    const r = (await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Documents", extensions: ["pdf", "txt", "md", "markdown", "csv", "json", "js", "ts", "tsx", "py", "java", "go", "rb", "rs", "c", "cpp", "h", "html", "css"] }
      ]
    } as any)) as unknown as { canceled: boolean; filePaths: string[] }
    if (r.canceled || !r.filePaths[0]) return null
    try {
      const p = r.filePaths[0]
      const text = (await extractText(p)).slice(0, 200000) // cap very large files
      return { name: path.basename(p), text }
    } catch (error: any) {
      return { name: "", text: "", error: String(error?.message || error) }
    }
  })

  // Settings window + General preferences
  ipcMain.handle("open-settings", (_e, tab?: string) => appState.openSettings(tab))
  ipcMain.handle("set-overlay-min-height", (_e, h: number) => appState.setMenuMinHeight(h))
  ipcMain.handle("get-general-settings", () => ({
    undetectability: appState.getUndetectability(),
    openAtLogin: app.getLoginItemSettings().openAtLogin
  }))
  ipcMain.handle("set-undetectability", (_e, enabled: boolean) => appState.setUndetectability(enabled))
  ipcMain.handle("set-open-at-login", (_e, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })

  // History: persisted listening sessions
  ipcMain.handle("sessions-list", () => SessionStore.list())
  ipcMain.handle("sessions-get", (_e, id: string) => SessionStore.get(id))
  ipcMain.handle("sessions-save", (_e, session: Session) => SessionStore.save(session))
  ipcMain.handle("sessions-delete", (_e, id: string) => SessionStore.delete(id))

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Overlay click-through: renderer turns the mouse on only while the cursor is over UI,
  // so clicks land on whatever is behind the window's transparent areas.
  ipcMain.handle("set-ignore-mouse-events", (_e, ignore: boolean) => {
    appState.getMainWindow()?.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : undefined)
  })

  // Drag the overlay by a cursor delta (CSS -webkit-app-region drag doesn't work with the
  // click-through forwarding above, so the pill drives this manually).
  ipcMain.handle("move-window-by", (_e, dx: number, dy: number) => {
    const w = appState.getMainWindow()
    if (!w) return
    const [x, y] = w.getPosition()
    w.setPosition(Math.round(x + dx), Math.round(y + dy))
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // List the models a provider offers (OpenAI-compatible /models, Gemini list endpoint, or
  // Ollama /api/tags). Uses the given key, or the saved one when the field is left blank.
  ipcMain.handle("list-models", async (_e, cfg: Partial<AIConfig>) => {
    const timeout = () => AbortSignal.timeout(8000) // don't let a wrong/slow endpoint hang the UI
    try {
      let apiKey = cfg.apiKey
      if (!apiKey && cfg.engine !== "ollama") apiKey = AIConfigStore.read()?.apiKey || ""
      if (cfg.engine === "ollama") {
        const r = await fetch(`${cfg.ollamaUrl || "http://localhost:11434"}/api/tags`, { signal: timeout() })
        const d: any = await r.json()
        return (d.models || []).map((m: any) => m.name)
      }
      if (cfg.engine === "gemini") {
        if (!apiKey) return []
        // Key in a header, not the query string, so it stays out of URLs/logs.
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          headers: { "x-goog-api-key": apiKey },
          signal: timeout()
        })
        const d: any = await r.json()
        return (d.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
          .map((m: any) => String(m.name).replace(/^models\//, ""))
          .sort()
      }
      if (!apiKey) return []
      const base = cfg.baseURL || "https://api.openai.com/v1"
      const r = await fetch(`${base.replace(/\/$/, "")}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: timeout()
      })
      const d: any = await r.json()
      return (d.data || []).map((m: any) => m.id).sort()
    } catch {
      return []
    }
  })

  // AI provider config (Settings → AI Model). The key is never returned to the renderer.
  ipcMain.handle("get-ai-config", () => {
    const cfg = AIConfigStore.read()
    if (!cfg) return null
    const { apiKey, ...rest } = cfg
    return { ...rest, hasKey: !!apiKey }
  })
  ipcMain.handle("set-ai-config", async (_e, cfg: AIConfig) => {
    try {
      // Keep the saved key when the user edits without re-entering it.
      if (!cfg.apiKey && cfg.engine !== "ollama") {
        const prev = AIConfigStore.read()
        if (prev?.apiKey) cfg.apiKey = prev.apiKey
      }
      // Never persist a cloud provider without a key — it would throw when rebuilt on next launch.
      if (!cfg.apiKey && cfg.engine !== "ollama") {
        return { success: false, error: "An API key is required for cloud providers." }
      }
      AIConfigStore.write(cfg)
      appState.processingHelper.applyConfig(cfg)
      return await appState.processingHelper.getLLMHelper().testConnection()
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // LLM Model Management Handlers
  ipcMain.handle("get-current-llm-config", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      return {
        provider: llmHelper.getCurrentProvider(),
        model: llmHelper.getCurrentModel(),
        isOllama: llmHelper.isUsingOllama()
      };
    } catch (error: any) {
      console.error("Error getting current LLM config:", error);
      throw error;
    }
  });

  ipcMain.handle("get-available-ollama-models", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const models = await llmHelper.getOllamaModels();
      return models;
    } catch (error: any) {
      console.error("Error getting Ollama models:", error);
      throw error;
    }
  });

  ipcMain.handle("switch-to-ollama", async (_, model?: string, url?: string) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToOllama(model, url);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching to Ollama:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("switch-to-gemini", async (_, apiKey?: string) => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      await llmHelper.switchToGemini(apiKey);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching to Gemini:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("test-llm-connection", async () => {
    try {
      const llmHelper = appState.processingHelper.getLLMHelper();
      const result = await llmHelper.testConnection();
      return result;
    } catch (error: any) {
      console.error("Error testing LLM connection:", error);
      return { success: false, error: error.message };
    }
  });
}
