import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import OpenAI, { toFile } from "openai"
import fs from "fs"

interface OllamaResponse {
  response: string
  done: boolean
}

// Config for any OpenAI-compatible vendor (OpenAI, OpenRouter, Groq, DeepSeek, Together, ...).
export interface OpenAIConfig {
  apiKey: string
  baseURL?: string
  model?: string
  transcribeModel?: string
}

export class LLMHelper {
  private model: GenerativeModel | null = null
  private openai: OpenAI | null = null
  private openaiModel: string = "gpt-4o-mini"
  private openaiTranscribeModel: string = "whisper-1"
  // Default style for chat and screen-context: direct, grounded, no scaffolding.
  private readonly systemPrompt = `You are Open Cluely, a sharp and concise desktop assistant. Answer the user's actual question directly and get to the point. Do not restate the question, do not add a "problem statement" or "context" section, and do not list options or next steps unless the user asks for them. When a screenshot of the user's screen is attached, treat it as exactly what they are looking at right now: read it carefully and ground your answer in what is actually visible — the apps, windows, text, code, or questions on screen. If the user asks what you see, describe it plainly and specifically. Write naturally, like a knowledgeable person glancing at their screen.`
  // Structured, proactive style reserved for live audio (meetings, interviews) where suggested responses help.
  private readonly audioSystemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps.`
  // Persona for "use screen": the user is usually in a live interview/assessment and needs the answer now.
  private readonly screenSystemPrompt = `You are an expert interview and assessment copilot. The user has shared their screen during a live interview or test, and whatever task, question, problem, or prompt is on it is being asked of the user right now. Give the single best answer or solution the user can say or type immediately: the actual answer, working code, the correct choice, or the exact wording a strong candidate would give. Lead with the answer, then at most one or two lines of the key reasoning only if it helps the user defend it. Never describe the screen, never explain how they "could" approach it, never ask clarifying questions, and never hand back a blank template to fill in. If something is ambiguous, state the most reasonable assumption in a few words and answer anyway. For multiple-choice or comparison tasks, give the choice and a one-line why. For coding tasks, give correct, runnable code. Be concise and match the question's own domain and format. The one exception: if the user explicitly asks what you see or what's on their screen, describe what's visible instead of solving.`
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"
  private geminiModel: string = "gemini-3.1-flash-lite"

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string, openaiConfig?: OpenAIConfig, geminiModel?: string) {
    this.useOllama = useOllama
    if (geminiModel) this.geminiModel = geminiModel

    if (openaiConfig) {
      this.openai = new OpenAI({ apiKey: openaiConfig.apiKey, baseURL: openaiConfig.baseURL })
      if (openaiConfig.model) this.openaiModel = openaiConfig.model
      if (openaiConfig.transcribeModel) this.openaiTranscribeModel = openaiConfig.transcribeModel
      console.log(`[LLMHelper] Using OpenAI-compatible provider: ${this.openaiModel}${openaiConfig.baseURL ? ` @ ${openaiConfig.baseURL}` : ""}`)
    } else if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "gemma:latest" // Default fallback
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)

      // Auto-detect and use first available model if specified model doesn't exist
      this.initializeOllamaModel()
    } else if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: this.geminiModel })
      console.log("[LLMHelper] Using Google Gemini")
    } else {
      throw new Error("Provide a Gemini key, an OpenAI-compatible key, or enable Ollama mode")
    }
  }

  // One chat call for any OpenAI-compatible vendor. content is a string or a vision message array.
  private async callOpenAI(content: any, system: string = this.systemPrompt): Promise<string> {
    const result = await this.openai!.chat.completions.create({
      model: this.openaiModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content }
      ]
    })
    return result.choices[0]?.message?.content?.trim() || ""
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Failed to connect to Ollama: ${error.message}. Make sure Ollama is running on ${this.ollamaUrl}`)
    }
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) {
        console.warn("[LLMHelper] No Ollama models found")
        return
      }

      // Check if current model exists, if not use the first available
      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
        console.log(`[LLMHelper] Auto-selected first available model: ${this.ollamaModel}`)
      }

      // Test the selected model works
      const testResult = await this.callOllama("Hello")
      console.log(`[LLMHelper] Successfully initialized with model: ${this.ollamaModel}`)
    } catch (error) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`)
      // Try to use first available model as fallback
      try {
        const models = await this.getOllamaModels()
        if (models.length > 0) {
          this.ollamaModel = models[0]
          console.log(`[LLMHelper] Fallback to: ${this.ollamaModel}`)
        }
      } catch (fallbackError) {
        console.error(`[LLMHelper] Fallback also failed: ${fallbackError.message}`)
      }
    }
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

    console.log("[LLMHelper] Calling Gemini LLM for solution...");
    try {
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.");
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath);
      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType: "audio/mp3"
        }
      };
      const prompt = `${this.audioSystemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio file:", error);
      throw error;
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      const prompt = `${this.audioSystemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      throw error;
    }
  }

  public async transcribeAudio(data: string, mimeType: string): Promise<string> {
    if (this.openai) {
      // Needs a vendor with a Whisper-style transcription endpoint (OpenAI, Groq). Others will error.
      const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "wav"
      const file = await toFile(Buffer.from(data, "base64"), `audio.${ext}`, { type: mimeType })
      const result = await this.openai.audio.transcriptions.create({ file, model: this.openaiTranscribeModel })
      return (result.text || "").trim()
    }
    const prompt = "Transcribe this audio word for word. Return only the spoken words. If there is no clear speech, return an empty string."
    const result = await this.model!.generateContent([prompt, { inlineData: { data, mimeType } }])
    return (await result.response).text().trim()
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      const prompt = `Describe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief.`;
      if (this.openai) {
        const text = await this.callOpenAI([
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageData.toString("base64")}` } }
        ]);
        return { text, timestamp: Date.now() };
      }
      const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } };
      const result = await this.model!.generateContent([`${this.systemPrompt}\n\n${prompt}`, imagePart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing image file:", error);
      throw error;
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      if (this.openai) {
        return this.callOpenAI(message);
      } else if (this.useOllama) {
        return this.callOllama(message);
      } else if (this.model) {
        const result = await this.model.generateContent(message);
        const response = await result.response;
        return response.text();
      } else {
        throw new Error("No LLM provider configured");
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error);
      throw error;
    }
  }

  public async chat(message: string): Promise<string> {
    return this.chatWithGemini(message);
  }

  // Ask with a screenshot of the screen attached as context (screen-context toggle ON).
  // Uses the interview/assessment solver persona (screenSystemPrompt), not the general one.
  public async askWithImage(prompt: string, imageBase64: string): Promise<string> {
    const q = prompt && prompt.trim() ? prompt.trim() : "Solve the task shown on my screen."
    const framed = `This image is my screen right now.\n\n${q}`
    if (this.openai) {
      return this.callOpenAI([
        { type: "text", text: framed },
        { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
      ], this.screenSystemPrompt);
    }
    if (this.useOllama) {
      // Ollama text model can't see images; fall back to text-only with the same persona.
      return this.callOllama(`${this.screenSystemPrompt}\n\n${framed}`);
    }
    const result = await this.model!.generateContent([
      `${this.screenSystemPrompt}\n\n${framed}`,
      { inlineData: { data: imageBase64, mimeType: "image/png" } }
    ]);
    return (await result.response).text();
  }

  public isUsingOllama(): boolean {
    return this.useOllama;
  }

  public async getOllamaModels(): Promise<string[]> {
    if (!this.useOllama) return [];
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) throw new Error('Failed to fetch models');
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error("[LLMHelper] Error fetching Ollama models:", error);
      return [];
    }
  }

  public getCurrentProvider(): "ollama" | "gemini" | "openai" {
    if (this.openai) return "openai";
    return this.useOllama ? "ollama" : "gemini";
  }

  public getCurrentModel(): string {
    if (this.openai) return this.openaiModel;
    return this.useOllama ? this.ollamaModel : this.geminiModel;
  }

  public async switchToOllama(model?: string, url?: string): Promise<void> {
    this.useOllama = true;
    if (url) this.ollamaUrl = url;
    
    if (model) {
      this.ollamaModel = model;
    } else {
      // Auto-detect first available model
      await this.initializeOllamaModel();
    }
    
    console.log(`[LLMHelper] Switched to Ollama: ${this.ollamaModel} at ${this.ollamaUrl}`);
  }

  public async switchToGemini(apiKey?: string): Promise<void> {
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      this.model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    }
    
    if (!this.model && !apiKey) {
      throw new Error("No Gemini API key provided and no existing model instance");
    }
    
    this.useOllama = false;
    console.log("[LLMHelper] Switched to Gemini");
  }

  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.openai) {
        const text = await this.callOpenAI("Hello");
        return text ? { success: true } : { success: false, error: "Empty response from provider" };
      } else if (this.useOllama) {
        const available = await this.checkOllamaAvailable();
        if (!available) {
          return { success: false, error: `Ollama not available at ${this.ollamaUrl}` };
        }
        // Test with a simple prompt
        await this.callOllama("Hello");
        return { success: true };
      } else {
        if (!this.model) {
          return { success: false, error: "No Gemini model configured" };
        }
        // Test with a simple prompt
        const result = await this.model.generateContent("Hello");
        const response = await result.response;
        const text = response.text(); // Ensure the response is valid
        if (text) {
          return { success: true };
        } else {
          return { success: false, error: "Empty response from Gemini" };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
} 