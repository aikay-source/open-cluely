import React, { useEffect, useState } from "react"
import {
  LuSettings,
  LuCalendar,
  LuSlidersHorizontal,
  LuKeyboard,
  LuUser,
  LuShield,
  LuCreditCard,
  LuInfo,
  LuEye,
  LuEyeOff,
  LuPower,
  LuSearch
} from "react-icons/lu"

// Settings window matching Cluely's General screen (classes extracted from its bundle).
type Page = "general" | "calendar" | "modes" | "shortcuts" | "account" | "security" | "billing" | "about"

const NAV: { page: Page; label: string; icon: React.ComponentType<{ className?: string }>; gradient: string; description: string }[] = [
  { page: "general", label: "General", icon: LuSettings, gradient: "from-[#b0b0b5] to-[#77777e]", description: "Manage how Open Cluely works on your Mac, including software updates, language, and audio." },
  { page: "calendar", label: "Calendar", icon: LuCalendar, gradient: "from-[#ff757d] to-[#ee3b48]", description: "Connect your calendar to see upcoming meetings and get reminders before they start." },
  { page: "modes", label: "Modes", icon: LuSlidersHorizontal, gradient: "from-[#a58bff] to-[#7860df]", description: "Customize how Open Cluely responds with instructions and reference files." },
  { page: "shortcuts", label: "Keyboard Shortcuts", icon: LuKeyboard, gradient: "from-[#a0a1a8] to-[#6a6c75]", description: "Control Open Cluely from your keyboard." },
  { page: "account", label: "Account", icon: LuUser, gradient: "from-[#67b8ff] to-[#3385ea]", description: "Manage your personal information and connected accounts." },
  { page: "security", label: "Security", icon: LuShield, gradient: "from-[#ff9f6b] to-[#f5653c]", description: "Review the permissions Open Cluely uses." },
  { page: "billing", label: "Billing", icon: LuCreditCard, gradient: "from-[#5fd07a] to-[#34b85a]", description: "Manage your plan and payment details." },
  { page: "about", label: "About", icon: LuInfo, gradient: "from-[#67b8ff] to-[#3385ea]", description: "About Open Cluely." }
]

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#0a84ff]" : "bg-white/15"}`}
  >
    <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-[2px]"}`} />
  </button>
)

const Row: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; description: string; control: React.ReactNode; first?: boolean }> = ({
  icon: Icon,
  title,
  description,
  control,
  first
}) => (
  <div className={`flex items-center justify-between gap-3 py-3.5 ${first ? "" : "border-t border-white/[0.06]"}`}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.045]">
        <Icon className="size-4 text-white/50" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-[13px] text-white/90">{title}</p>
        <div className="mt-0.5 text-[11px] text-white/40 leading-[1.4]">{description}</div>
      </div>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
)

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-medium text-[12px] text-white/55">{children}</h2>
)

const General: React.FC = () => {
  const [undetectable, setUndetectable] = useState(false)
  const [openAtLogin, setOpenAtLogin] = useState(false)

  useEffect(() => {
    window.electronAPI
      .invoke("get-general-settings")
      .then((s: { undetectability: boolean; openAtLogin: boolean }) => {
        setUndetectable(s.undetectability)
        setOpenAtLogin(s.openAtLogin)
      })
      .catch(() => undefined)
  }, [])

  const toggleUndetectable = (v: boolean) => {
    setUndetectable(v)
    window.electronAPI.invoke("set-undetectability", v)
  }
  const toggleOpenAtLogin = (v: boolean) => {
    setOpenAtLogin(v)
    window.electronAPI.invoke("set-open-at-login", v)
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-7 px-8 py-6">
      {/* Header card */}
      <div className="rounded-2xl bg-white/[0.035] px-6 py-7 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-[18px] bg-gradient-to-b from-[#b0b0b5] to-[#77777e] shadow-lg">
          <LuSettings className="size-8 text-white" />
        </div>
        <h1 className="mt-4 font-semibold text-[22px] text-white">General</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-white/55 leading-snug">
          Manage how Open Cluely works on your Mac, including software updates and audio.
        </p>
      </div>

      <section className="space-y-2">
        <SectionTitle>Software Update</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={LuInfo}
            title="Open Cluely"
            description="Version 1.0.0"
            control={<span className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] px-2.5 text-[12px] text-white/80"><span aria-hidden>✓</span> Up to date</span>}
          />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Preferences</SectionTitle>
        <div className="rounded-xl bg-white/[0.035] px-4">
          <Row
            first
            icon={undetectable ? LuEyeOff : LuEye}
            title="Undetectability"
            description="Hide Open Cluely from screen sharing and recordings."
            control={<Switch checked={undetectable} onChange={toggleUndetectable} />}
          />
          <Row
            icon={LuPower}
            title="Open at login"
            description="Automatically open Open Cluely when you log in."
            control={<Switch checked={openAtLogin} onChange={toggleOpenAtLogin} />}
          />
        </div>
      </section>
    </div>
  )
}

const Placeholder: React.FC<{ item: (typeof NAV)[number] }> = ({ item }) => (
  <div className="mx-auto w-full max-w-[560px] px-8 py-6">
    <div className="rounded-2xl bg-white/[0.035] px-6 py-7 text-center">
      <div className={`mx-auto grid size-16 place-items-center rounded-[18px] bg-gradient-to-b ${item.gradient} shadow-lg`}>
        <item.icon className="size-8 text-white" />
      </div>
      <h1 className="mt-4 font-semibold text-[22px] text-white">{item.label}</h1>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-white/55 leading-snug">{item.description}</p>
      <p className="mt-4 text-[12px] text-white/35">Coming soon.</p>
    </div>
  </div>
)

const Settings: React.FC = () => {
  const [page, setPage] = useState<Page>("general")
  const active = NAV.find((n) => n.page === page)!

  return (
    <div className="flex h-screen w-screen select-none bg-[#1c1c1e] text-white">
      {/* Sidebar */}
      <aside className="flex w-[244px] shrink-0 flex-col border-r border-white/[0.06] bg-[#161618] px-3 pb-3 pt-10">
        <div className="app-region-drag absolute left-0 top-0 h-10 w-full" />
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-white/40">
          <LuSearch className="size-3.5" />
          <input className="w-full bg-transparent text-[12px] text-white/80 placeholder:text-white/35 outline-none" placeholder="Search" />
        </div>
        <div className="mb-3 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-[#6a6c75] to-[#3a3b40] text-[12px] font-semibold">OC</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Open Cluely</p>
            <p className="truncate text-[11px] text-white/45">Local settings</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.page}
              type="button"
              onClick={() => setPage(n.page)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${page === n.page ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
            >
              <div className={`grid size-7 shrink-0 place-items-center rounded-[7px] bg-gradient-to-b ${n.gradient}`}>
                <n.icon className="size-4 text-white" />
              </div>
              <span className="truncate text-[13px] font-medium text-white/90">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] pt-2 text-[12px] text-white/40">Open Cluely</div>
      </aside>

      {/* Content */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-6">
        {page === "general" ? <General /> : <Placeholder item={active} />}
      </main>
    </div>
  )
}

export default Settings
