// ProcessingHelper.ts

import { AppState } from "./main"
import { LLMHelper } from "./LLMHelper"
import { AIConfigStore, AIConfig } from "./AIConfigStore"
import dotenv from "dotenv"
import os from "os"
import path from "path"

dotenv.config() // dev: project .env (cwd)
// Packaged app has no project .env (cwd is "/"), so also read a fixed per-user file.
// dotenv does not override already-set vars, so the project .env still wins in dev.
dotenv.config({ path: path.join(os.homedir(), ".open-cluely.env") })

const isDev = process.env.NODE_ENV === "development"
const isDevTest = process.env.IS_DEV_TEST === "true"
const MOCK_API_WAIT_TIME = Number(process.env.MOCK_API_WAIT_TIME) || 500

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(appState: AppState) {
    this.appState = appState
    // In-app config (Settings → AI Model) wins; otherwise fall back to .env.
    const saved = AIConfigStore.read()
    try {
      this.llmHelper = saved ? ProcessingHelper.buildFromConfig(saved) : ProcessingHelper.buildFromEnv()
    } catch (err) {
      // A saved config with a missing/invalid key must not brick launch; buildFromEnv never throws.
      console.warn("[ProcessingHelper] Saved AI config failed to load; falling back to env/Ollama.", err)
      this.llmHelper = ProcessingHelper.buildFromEnv()
    }
  }

  private static buildFromConfig(cfg: AIConfig): LLMHelper {
    if (cfg.engine === "ollama") {
      return new LLMHelper(undefined, true, cfg.model || undefined, cfg.ollamaUrl || "http://localhost:11434")
    }
    if (cfg.engine === "gemini") {
      return new LLMHelper(cfg.apiKey, false, undefined, undefined, undefined, cfg.model || undefined)
    }
    // OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, ...)
    return new LLMHelper(undefined, false, undefined, undefined, {
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
      model: cfg.model,
      transcribeModel: cfg.transcribeModel
    })
  }

  private static buildFromEnv(): LLMHelper {
    // Provider precedence: Ollama > OpenAI-compatible > Gemini
    const useOllama = process.env.USE_OLLAMA === "true"
    const openaiKey = process.env.OPENAI_API_KEY
    if (useOllama) {
      return new LLMHelper(undefined, true, process.env.OLLAMA_MODEL, process.env.OLLAMA_URL || "http://localhost:11434")
    }
    if (openaiKey) {
      return new LLMHelper(undefined, false, undefined, undefined, {
        apiKey: openaiKey,
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL,
        transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL
      })
    }
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) return new LLMHelper(apiKey, false)
    // Nothing configured yet: default to local Ollama so the app still launches; the user
    // can pick a cloud provider and enter a key in Settings → AI Model.
    console.warn("[ProcessingHelper] No provider configured; defaulting to local Ollama until set in Settings.")
    return new LLMHelper(undefined, true, undefined, "http://localhost:11434")
  }

  // Swap the active provider at runtime after the user saves Settings → AI Model.
  public applyConfig(cfg: AIConfig): void {
    this.llmHelper = ProcessingHelper.buildFromConfig(cfg)
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return

    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      // Check if last screenshot is an audio file
      const allPaths = this.appState.getScreenshotHelper().getScreenshotQueue();
      const lastPath = allPaths[allPaths.length - 1];
      if (lastPath.endsWith('.mp3') || lastPath.endsWith('.wav')) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START);
        this.appState.setView('solutions');
        try {
          const audioResult = await this.llmHelper.analyzeAudioFile(lastPath);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, audioResult);
          this.appState.setProblemInfo({ problem_statement: audioResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] });
          return;
        } catch (err: any) {
          console.error('Audio processing error:', err);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, err.message);
          return;
        }
      }

      // NEW: Handle screenshot as plain text (like audio)
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")
      this.currentProcessingAbortController = new AbortController()
      try {
        const imageResult = await this.llmHelper.analyzeImageFile(lastPath);
        const problemInfo = {
          problem_statement: imageResult.text,
          input_format: { description: "Generated from screenshot", parameters: [] as any[] },
          output_format: { description: "Generated from screenshot", type: "string", subtype: "text" },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [] as any[],
          validation_type: "manual",
          difficulty: "custom"
        };
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo);
        this.appState.setProblemInfo(problemInfo);
      } catch (error: any) {
        console.error("Image processing error:", error)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
      return;
    } else {
      // Debug mode
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots to process")
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        // Get problem info and current solution
        const problemInfo = this.appState.getProblemInfo()
        if (!problemInfo) {
          throw new Error("No problem info available")
        }

        // Get current solution from state
        const currentSolution = await this.llmHelper.generateSolution(problemInfo)
        const currentCode = currentSolution.solution.code

        // Debug the solution using vision model
        const debugResult = await this.llmHelper.debugSolutionWithImages(
          problemInfo,
          currentCode,
          extraScreenshotQueue
        )

        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS,
          debugResult
        )

      } catch (error: any) {
        console.error("Debug processing error:", error)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        )
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
    }

    this.appState.setHasDebugged(false)
  }

  public async processAudioBase64(data: string, mimeType: string) {
    // Directly use LLMHelper to analyze inline base64 audio
    return this.llmHelper.analyzeAudioFromBase64(data, mimeType);
  }

  // Add audio file processing method
  public async processAudioFile(filePath: string) {
    return this.llmHelper.analyzeAudioFile(filePath);
  }

  public getLLMHelper() {
    return this.llmHelper;
  }
}
