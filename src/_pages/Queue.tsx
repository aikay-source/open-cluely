import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "react-query"
import { Toast, ToastTitle, ToastDescription, ToastVariant, ToastMessage } from "../components/ui/toast"
import ControlPill from "../components/Queue/ControlPill"
import ChatPanel, { Message, TranscriptEntry } from "../components/Queue/ChatPanel"
import { useListener } from "../components/Queue/useListener"

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

const ASKS = {
  "💡 Suggest answer":
    "What is the interviewer's latest question? Give a strong spoken answer the user could give right now, in plain words, 60 to 90 seconds when read aloud. Structure it as situation, action, result where that fits.",
  "📝 Notes": "Write brief bullet notes of what has been asked and answered so far, and note any answer that was weak or incomplete.",
  "➡️ Next steps":
    "Based on where this interview is, list what the user should prepare to say next: likely follow-up questions, points not yet made, and one thing to improve in delivery."
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
      const response = await window.electronAPI.invoke("gemini-chat", withTranscript(prompt))
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }])
    } catch (err) {
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: "Error: " + String(err) }])
    } finally {
      setChatLoading(false)
    }
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
      window.electronAPI.onProcessingNoScreenshots(() => showToast("No Screenshots", "There are no screenshots to process.", "neutral")),
      // Cmd+H: analyze the screenshot straight away
      window.electronAPI.onScreenshotTaken(async (data: any) => {
        await refetch()
        setChatOpen(true)
        setPanelView("chat")
        setChatLoading(true)
        try {
          const latest = data?.path || (Array.isArray(data) && data[data.length - 1]?.path)
          if (latest) {
            const response = await window.electronAPI.invoke("analyze-image-file", latest)
            setChatMessages((msgs) => [...msgs, { role: "gemini", text: response.text }])
          }
        } catch (err) {
          setChatMessages((msgs) => [...msgs, { role: "gemini", text: "Error: " + String(err) }])
        } finally {
          setChatLoading(false)
        }
      })
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
        onStartListening={() => {
          listener.start()
          setChatOpen(true)
          setPanelView("transcript")
        }}
        onStopListening={listener.stop}
      />
      {chatOpen && (
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
          onStartListening={() => {
            listener.start()
            setPanelView("transcript")
          }}
          onStopListening={listener.stop}
          mics={listener.mics}
          micId={listener.micId}
          setMicId={listener.setMicId}
          view={panelView}
          setView={setPanelView}
          onNewChat={() => setChatMessages([])}
          onScreenshot={async () => {
            // Self-contained: capture, then analyze, surfacing any error so it's never silent.
            setChatOpen(true)
            setPanelView("chat")
            setSettingsOpen(false)
            setChatLoading(true)
            try {
              const shot = await window.electronAPI.takeScreenshot()
              const response = await window.electronAPI.invoke("analyze-image-file", shot.path)
              setChatMessages((msgs) => [...msgs, { role: "gemini", text: response.text }])
            } catch (err) {
              setChatMessages((msgs) => [...msgs, { role: "gemini", text: "Screenshot failed: " + String(err) }])
            } finally {
              setChatLoading(false)
            }
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((o) => !o)}
          onModelChange={(provider, model) => setChatMessages((msgs) => [...msgs, { role: "gemini", text: `Switched to ${provider}: ${model}.` }])}
          onEscape={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}

export default Queue
