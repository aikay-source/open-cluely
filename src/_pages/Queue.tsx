import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "react-query"
import { Toast, ToastTitle, ToastDescription, ToastVariant, ToastMessage } from "../components/ui/toast"
import ControlPill from "../components/Queue/ControlPill"
import ChatPanel, { Message, TranscriptEntry } from "../components/Queue/ChatPanel"
import History, { Session } from "../components/Queue/History"
import { useListener } from "../components/Queue/useListener"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

// Cluely's four preset asks (keys match the chips in ChatPanel).
const ASKS: Record<string, string> = {
  "Assist":
    "Help me with what's in front of me right now. Using the conversation so far (and anything I describe), explain what's happening, answer the current question, or tell me the best next move — concise and immediately usable.",
  "What should I say?":
    "Based on the live conversation, suggest a strong, natural thing for me to say right now, in my own voice. Give me a few sentences I could say aloud.",
  "Follow-up questions":
    "Based on the conversation so far, list 3 to 5 good follow-up questions I could ask next.",
  "Recap":
    "Summarize the conversation so far as concise bullet points: what's been discussed, what was decided, and what's still open."
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({ title: "", description: "", variant: "neutral" })
  const contentRef = useRef<HTMLDivElement>(null)

  const [chatOpen, setChatOpen] = useState(false)
  const [panelView, setPanelView] = useState<"chat" | "transcript">("chat")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [screenContext, setScreenContext] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const listener = useListener((text, at) => {
    setTranscript((t) => [...t, { at, text }])
    setChatOpen(true)
  })

  const showToast = (title: string, description: string, variant: ToastVariant) => {
    setToastMessage({ title, description, variant })
    setToastOpen(true)
  }

  const { refetch } = useQuery(["screenshots"], () => window.electronAPI.getScreenshots().catch(() => []), {
    staleTime: Infinity,
    cacheTime: Infinity
  })

  const withTranscript = (ask: string) =>
    transcript.length
      ? `Live transcript of a mock interview the user is taking. The interviewer's questions and the user's own answers are both in it.\n---\n${transcript.map((t) => t.text).join(" ")}\n---\n${ask}`
      : ask

  const send = async (label: string, prompt: string) => {
    if (!prompt.trim()) return
    setChatOpen(true)
    setPanelView("chat")
    setSettingsOpen(false)
    setChatMessages((msgs) => [...msgs, { role: "user", text: label }])
    setChatLoading(true)
    setChatInput("")
    try {
      // When screen-context is on, attach a capture of the screen to the ask.
      const channel = screenContext ? "ask-with-screen" : "gemini-chat"
      const response = await window.electronAPI.invoke(channel, withTranscript(prompt))
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }])
    } catch (err) {
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: "Error: " + String(err) }])
    } finally {
      setChatLoading(false)
    }
  }

  const sessionStart = useRef(0)
  const startListening = () => {
    sessionStart.current = Date.now()
    listener.start()
    setChatOpen(true)
    setPanelView("transcript")
  }
  // Stop listening and save the session (with an LLM-generated title + summary) to History.
  const stopAndSave = async () => {
    const started = sessionStart.current
    const entries = transcript
    const msgs = chatMessages
    listener.stop()
    if (entries.length === 0) return
    let title = "Session"
    let summary = ""
    try {
      const text = entries.map((t) => t.text).join(" ")
      const resp: string = await window.electronAPI.invoke(
        "gemini-chat",
        `Write a 3-6 word title for this conversation, then a blank line, then a concise bullet-point summary. Transcript:\n${text}`
      )
      const lines = resp.split("\n")
      title = (lines[0] || "").replace(/^\s*(title[:\-]\s*)/i, "").replace(/^#+\s*|["*]/g, "").trim().slice(0, 80) || title
      summary = lines.slice(1).join("\n").replace(/^\s*(summary[:\-]\s*)/i, "").trim()
    } catch {
      /* keep defaults */
    }
    await window.electronAPI.invoke("sessions-save", {
      id: crypto.randomUUID(),
      title,
      startedAt: started || Date.now(),
      durationMs: Date.now() - (started || Date.now()),
      transcript: entries,
      messages: msgs,
      summary
    })
  }
  const resume = (s: { transcript: TranscriptEntry[]; messages: Message[] }) => {
    setTranscript(s.transcript)
    setChatMessages(s.messages)
    setHistoryOpen(false)
    setChatOpen(true)
    setPanelView("transcript")
  }

  useEffect(() => {
    const updateDimensions = () => {
      if (!contentRef.current) return
      window.electronAPI.updateContentDimensions({ width: contentRef.current.scrollWidth, height: contentRef.current.scrollHeight })
    }
    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) resizeObserver.observe(contentRef.current)
    updateDimensions()

    const cleanupFunctions = [
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", "There was an error processing your screenshots.", "error")
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => showToast("No Screenshots", "There are no screenshots to process.", "neutral"))
    ]
    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [])

  return (
    <div ref={contentRef} className="flex w-[690px] select-none flex-col items-center gap-[6px] pt-[2px] pb-1">
      <Toast open={toastOpen} onOpenChange={setToastOpen} variant={toastMessage.variant} duration={3000}>
        <ToastTitle>{toastMessage.title}</ToastTitle>
        <ToastDescription>{toastMessage.description}</ToastDescription>
      </Toast>
      <ControlPill
        chatOpen={chatOpen}
        isThinking={chatLoading}
        isListening={listener.isListening}
        onToggleChat={() => setChatOpen((o) => !o)}
        onStartListening={startListening}
        onStopListening={stopAndSave}
      />
      {chatOpen && historyOpen ? (
        <History
          onClose={() => setHistoryOpen(false)}
          onResume={(s: Session) => resume(s)}
          onNewChat={() => {
            setHistoryOpen(false)
            setChatMessages([])
            setPanelView("chat")
            setChatOpen(true)
          }}
        />
      ) : chatOpen ? (
        <ChatPanel
          messages={chatMessages}
          loading={chatLoading}
          input={chatInput}
          setInput={setChatInput}
          onSend={() => send(chatInput, chatInput)}
          onAsk={send}
          asks={ASKS}
          transcript={transcript}
          onClearTranscript={() => setTranscript([])}
          isListening={listener.isListening}
          elapsed={listener.elapsed}
          listenError={listener.error}
          onStartListening={startListening}
          onStopListening={stopAndSave}
          onOpenHistory={() => setHistoryOpen(true)}
          view={panelView}
          setView={setPanelView}
          onNewChat={() => setChatMessages([])}
          screenContext={screenContext}
          onToggleScreenContext={() => {
            setScreenContext((v) => {
              if (!v) window.electronAPI.invoke("request-screen-access") // prompt on turning it on
              return !v
            })
          }}
          settingsOpen={false}
          onToggleSettings={() => window.electronAPI.invoke("open-settings")}
          onModelChange={(provider, model) => setChatMessages((msgs) => [...msgs, { role: "gemini", text: `Switched to ${provider}: ${model}.` }])}
          onEscape={() => setChatOpen(false)}
        />
      ) : null}
    </div>
  )
}

export default Queue
