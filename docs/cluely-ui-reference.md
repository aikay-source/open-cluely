# Cluely 2.1.28 overlay UI — reference extracted from the shipped app

Source: `/Applications/Cluely (New).app/Contents/Resources/app.asar` (sha256 `aa2434cb…bcd88`), read statically with REA on 2026-11-17. Nothing was executed. Class strings below are quoted from the bundle's React output; they're Tailwind 4 classes and map 1:1 onto our Tailwind 3 setup.

## Window architecture (`dist-electron/main.js`)
- **Control pill**: 163 × 50 px, `transparent`, `frame:false`, `hasShadow:false`, `alwaysOnTop`, `type:"panel"`, `hiddenInMissionControl`. Placed top-centre of the display: `x = centre`, `y = workArea.y + 25`.
- **Chat window**: 690 px wide, same flags, placed `6 px` below the pill and centred under it. Collapsed height 104 px (120 px in "invisible" mode); expanded height is user-resizable, min 350, max 760. Dashboard mode max 760.
- Settings window is the only one using `electron-liquid-glass` (`cornerRadius: 20, tintColor: "#292626bb"`, fallback `#242424`). The overlay windows use plain CSS backgrounds, not native glass.
- System audio on macOS comes from the bundled `audiotee` binary (`app.asar.unpacked/node_modules/electron-liquid-glass/../audiotee-0.0.7`); on Windows from `getDisplayMedia({audio:true})` + an AudioWorklet.

## Base styles (`dist/assets/index-*.css`)
- Font: `-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", sans-serif`; `-webkit-font-smoothing: antialiased`; `user-select: none` on body.
- shadcn-style oklch tokens; dark `--primary: oklch(68% .15 237)` (the blue used for user bubbles at 30 %), `--radius: .625rem`.
- Only one `backdrop-filter` rule in the whole sheet — the look comes from translucent dark fills, not blur.

## Control pill (`control-*.js`)
```
wrapper   h-screen w-screen bg-transparent p-[2px]
main      relative rounded-full overflow-hidden
          box-shadow: 0 0 0 1px rgba(207,226,255,0.24), 0 -0.5px 0 0 rgba(255,255,255,0.8)
fill      absolute inset-0 rounded-full bg-[hsla(252,10%,10%,0.8)]  (hover: brightness-300)
logo      absolute left-[12px], 26 px, white
controls  absolute inset-0 flex items-center justify-end gap-1.5 pr-[9px] pl-2
Ask/Hide  h-8 w-[66px] rounded-full font-semibold text-xs text-white
          idle:   bg-[linear-gradient(#0544a9,#022c70)]
                  shadow: 0 0 0 0.5px #0c44a1, 0 85px 34px #00000005, 0 48px 29px #00000014,
                          0 21px 21px #00000021, 0 5px 12px #00000029, inset 0 -1px #022c70, inset 0 0.5px #81b6ff
                  sparkles icon size-3 + "Ask" (text shimmers while a reply streams)
          open:   bg-[linear-gradient(#2e3039,#272a31)]
                  shadow: …same drop stack…, inset 0 -1px #16171a, inset 0 0.5px #afb3c4
                  X icon size-3.5 + "Hide"
Session   size-8 rounded-full, grey gradient + grey shadow stack
          idle: microphone (heroicons mini) size-4.5 — listening: square size-3
```

## Chat window (`route-D_Y2pChL.js`, `chat-*.js`)
```
frame        rounded-2xl, background rgba(9, 14, 15, 0.68)   (dashboard: rgb(0,0,0))
input bar    min-h-14 rounded-t-2xl bg-white/[0.18]  (dashboard: bg-white/[0.06])
  textarea   min-h-14 py-[18px] pl-4 pr-2 text-[15px] leading-5 text-foreground
  placeholder font-medium text-[15px] text-white/50
             "Ask anything about your screen, or ⌘ ↵ for help"
  submit     absolute right-3 size-8 rounded-lg bg-white/[0.16] text-white hover:bg-white/[0.22]
messages     px-4 py-4 space-y-2
  empty      text-center text-[14px] text-white/45  "Ask anything. This chat is ephemeral and won’t be saved."
  user       max-w-[85%] rounded-2xl bg-primary/30 px-3 py-2 text-[14px] text-white leading-6
  assistant  max-w-[90%] rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] text-white/85 leading-6
             (markdown: h1 18px/95, h2 16px/90, h3 14px/88, pre bg-white/[0.05])
  thinking   size-2.5 rounded-full bg-white/66, opacity keyframes [1,1,0,0,1] over 1 s
toolbar      grid h-12 grid-cols-[1fr_auto_1fr] items-center bg-black/[0.13] text-foreground/70
  left       pl-3 gap-2: settings (size-8 rounded-lg) + hint
             "Press [Tab] to chat or [⌘][Return] for instant help"  text-white/46
  keycap     h-7 min-w-7 rounded-md px-1.5 font-semibold text-[12px]
             soft: bg-white/[0.15] text-white/78 · strong: bg-white/[0.24] text-white/88
             outline: h-6 border border-white/[0.2] text-white/72 text-[11px]
  centre     gap-0.5, icon buttons:
             size-10 rounded-xl text-white/55 hover:bg-white/10 hover:text-white/80
             [screen/image] [eye|hat-glasses = undetectable] [modes grid] | h-5 w-px bg-white/[0.08] | [audio-lines = Listen]
  listening  pause: size-7 rounded-full hover:bg-white/10 (two 4×16 bars)
             stop:  size-[26px] rounded-full bg-white text-[rgba(9,14,15,0.9)] (square size-2.5 rounded-[2px])
             timer: min-w-[2.65rem] font-medium text-[12px] text-white/72 tabular-nums
  right      pr-3: "New Chat [⌘][R]" or "Transcript"/"View Chat" with file-text icon
             h-10 rounded-xl px-3 font-semibold text-[12px] text-white/72 hover:bg-white/[0.145] active:scale-[0.96]
```

## Transcript view (session dashboard, `chat-*.js`)
```
section title  font-semibold text-[12px] text-white/34 uppercase tracking-[0.14em]   ("TRANSCRIPT", "SUMMARY", "BRIEF")
title action   h-8 rounded-lg px-2.5 font-semibold text-[12px] text-white/52 hover:bg-white/[0.08]  ("Copy Transcript")
empty          min-h-[360px] centred, text-[16px] text-white/38 leading-7  "Transcript will appear as people speak."
row            grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3, rows spaced space-y-4
  time         pt-0.5 font-medium text-[11px] text-white/34 tabular-nums leading-5   (mm:ss)
  speaker      mb-1 font-semibold text-[11px] text-white/36 uppercase tracking-[0.14em]   ("ME" / "THEM")
  text         whitespace-pre-wrap text-[16px] text-white/76 leading-7
  pending      "Transcribing..." in .shimmer text-white/42
live row       time "Now", blinking dot size-2.5 bg-white/66, "Currently talking..." text-[13px] text-white/42
brief card     rounded-2xl bg-white/[0.07], header px-5 py-4, body text-[15px] text-white/66 leading-7
```

## What we did not copy
- The Cluely logo asset and name (branding).
- Undetectability (content protection toggle, dotted "invisible" frame).
- Modes, calendar/meetings dashboard, settings window, onboarding.
