import { useEffect, useRef, useState } from "react"

// Each chunk is a fresh recorder so it is a complete audio file the model can decode.
// Shorter chunks cut the lag between speech and transcript; the previous chunk's tail is fed
// back as context so words split across the boundary still resolve.
const CHUNK_MS = 4000

export const formatElapsed = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

export function useListener(onTranscript: (text: string, atSeconds: number) => void) {
  const [isListening, setIsListening] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const lastText = useRef("") // tail of the last transcript, used to prime the next chunk
  const callback = useRef(onTranscript)
  callback.current = onTranscript

  useEffect(() => {
    if (!isListening) return
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [isListening])

  const recordChunk = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    const chunkStart = Math.round((Date.now() - startedAt.current) / 1000)
    recorder.ondataavailable = (e) => {
      if (e.data.size < 1000) return
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const text = await window.electronAPI.invoke("transcribe-audio", (reader.result as string).split(",")[1], e.data.type, lastText.current)
          if (text) { lastText.current = text; callback.current(text, chunkStart) }
        } catch {
          setError("Transcription failed.")
        }
      }
      reader.readAsDataURL(e.data)
    }
    recorder.onstop = () => {
      if (streamRef.current) recordChunk(stream)
    }
    recorder.start()
    setTimeout(() => recorder.state === "recording" && recorder.stop(), CHUNK_MS)
  }

  const start = async () => {
    try {
      let deviceId = ""
      try { deviceId = localStorage.getItem("ocMicId") || "" } catch { /* ignore */ }
      // Clean up the input so transcription is more accurate on calls.
      const audio: MediaTrackConstraints = {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1
      }
      if (deviceId) audio.deviceId = { exact: deviceId }
      const stream = await navigator.mediaDevices.getUserMedia({ audio })
      streamRef.current = stream
      lastText.current = ""
      startedAt.current = Date.now()
      setError(null)
      recordChunk(stream)
      setIsListening(true)
    } catch {
      setError("Could not start listening.")
    }
  }

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current?.state === "recording" && recorderRef.current.stop()
    setIsListening(false)
  }

  return { isListening, elapsed, error, start, stop }
}
