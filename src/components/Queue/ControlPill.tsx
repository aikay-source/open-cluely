import React from "react"
import { LuSparkles, LuSquare, LuX } from "react-icons/lu"

// Styling observed in Cluely 2.1.28 control window (163x50 px pill).
const PILL_SHADOW = "0 0 0 1px rgba(207, 226, 255, 0.24), 0 -0.5px 0 0 rgba(255, 255, 255, 0.8)"
const GRAY =
  "bg-[linear-gradient(#2e3039,#272a31)] shadow-[0_85px_34px_#00000005,0_48px_29px_#00000014,0_21px_21px_#00000021,0_5px_12px_#00000029,inset_0_-1px_#16171a,inset_0_0.5px_#afb3c4]"
const BLUE =
  "bg-[linear-gradient(#0544a9,#022c70)] shadow-[0_0_0_0.5px_#0c44a1,0_85px_34px_#00000005,0_48px_29px_#00000014,0_21px_21px_#00000021,0_5px_12px_#00000029,inset_0_-1px_#022c70,inset_0_0.5px_#81b6ff]"

const MicIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
    <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
    <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
  </svg>
)

interface Props {
  chatOpen: boolean
  isThinking: boolean
  isListening: boolean
  onToggleChat: () => void
  onStartListening: () => void
  onStopListening: () => void
}

const ControlPill: React.FC<Props> = ({ chatOpen, isThinking, isListening, onToggleChat, onStartListening, onStopListening }) => (
  <div className="h-[50px] w-[163px] shrink-0 bg-transparent p-[2px]">
    <main
      className="app-region-drag group relative h-full w-full select-none overflow-hidden rounded-full bg-transparent"
      style={{ boxShadow: PILL_SHADOW }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[hsla(252,10%,10%,0.8)] transition duration-75 group-hover:brightness-[3]" />
      <div className="pointer-events-none absolute inset-y-0 left-[12px] flex items-center text-white">
        <LuSparkles className="size-[22px] shrink-0" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end gap-1.5 pr-[9px] pl-2">
        <button
          className="pointer-events-auto relative flex h-8 w-[66px] shrink-0 items-center justify-center overflow-visible rounded-full font-semibold text-white text-xs transition duration-150 hover:scale-105 hover:brightness-125"
          onClick={onToggleChat}
          tabIndex={-1}
          type="button"
        >
          <span aria-hidden className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200 ease-out ${GRAY} ${chatOpen ? "opacity-100" : "opacity-0"}`} />
          <span aria-hidden className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-200 ease-out ${BLUE} ${chatOpen ? "opacity-0" : "opacity-100"}`} />
          <span className="relative z-10 flex items-center gap-1">
            {chatOpen ? <LuX className="size-3.5" /> : <LuSparkles className="size-3" />}
            {chatOpen ? "Hide" : <span className={isThinking ? "animate-pulse" : ""}>Ask</span>}
          </span>
        </button>
        <button
          aria-label={isListening ? "Stop session" : "Start session"}
          className={`pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full text-white transition duration-150 hover:scale-105 hover:brightness-125 disabled:opacity-60 ${GRAY}`}
          onClick={isListening ? onStopListening : onStartListening}
          tabIndex={-1}
          type="button"
        >
          {isListening ? <LuSquare className="size-3 fill-current" /> : <MicIcon className="size-[18px]" />}
        </button>
      </div>
    </main>
  </div>
)

export default ControlPill
