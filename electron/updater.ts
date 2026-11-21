// Native auto-update. The release workflow publishes latest.yml / latest-mac.yml to GitHub,
// which electron-updater reads via the bundled app-update.yml (from the package.json publish field).
//
// Windows: full silent update — download in the background, install on restart.
// macOS: the app is self-signed, so Squirrel can't apply updates. We only detect a newer
// version and send the user to the download page.
import { app, dialog, shell } from "electron"
import { autoUpdater } from "electron-updater"

const RELEASES_URL = "https://github.com/aikay-source/open-cluely/releases/latest"
const isMac = process.platform === "darwin"

export function initAutoUpdate(): void {
  // Only a packaged app has the update feed; skip in dev.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = !isMac // mac can't self-install, so don't download a disk image it won't use

  autoUpdater.on("update-available", async (info) => {
    if (!isMac) return // Windows: autoDownload handles it; "update-downloaded" fires next
    // Cast: the stale @types/electron in this repo mistypes showMessageBox as returning a number.
    const { response } = (await dialog.showMessageBox({
      type: "info",
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `Open Cluely ${info.version} is available.`,
      detail: "A newer version is ready. Click Download to get it."
    })) as unknown as { response: number }
    if (response === 0) shell.openExternal(RELEASES_URL)
  })

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = (await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `Open Cluely ${info.version} is ready to install.`,
      detail: "Restart the app to finish updating."
    })) as unknown as { response: number }
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    console.error("checkForUpdates failed:", err)
  })
}
