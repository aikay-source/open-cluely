
import { BrowserWindow, screen } from "electron"
import { AppState } from "main"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"

const startUrl = isDev
  ? "http://localhost:5180"
  : `file://${path.join(__dirname, "../dist/index.html")}`

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null
  private isWindowVisible: boolean = false
  private windowPosition: { x: number; y: number } | null = null
  private windowSize: { width: number; height: number } | null = null
  private appState: AppState

  // Initialize with explicit number type and 0 value
  private screenWidth: number = 0
  private screenHeight: number = 0
  private lastContentHeight: number = 0
  private menuMinHeight: number = 0 // floor so a downward popover isn't clipped by the content-sized window
  private step: number = 0
  private currentX: number = 0
  private currentY: number = 0

  constructor(appState: AppState) {
    this.appState = appState
  }

  // A normal (framed, resizable) window for Settings — distinct from the overlay.
  public openSettings(tab?: string): void {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      if (tab) this.settingsWindow.webContents.send("settings-tab", tab)
      this.settingsWindow.show()
      this.settingsWindow.focus()
      return
    }
    this.settingsWindow = new BrowserWindow({
      width: 880,
      height: 640,
      minWidth: 720,
      minHeight: 480,
      title: "Open Cluely Settings",
      titleBarStyle: "hidden",
      trafficLightPosition: { x: 16, y: 16 },
      // Windows/Linux "hidden" also removes the min/max/close buttons; overlay the native ones back.
      ...(process.platform !== "darwin"
        ? { titleBarOverlay: { color: "#1c1c1e", symbolColor: "#ffffff" } }
        : {}),
      backgroundColor: "#1c1c1e",
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      }
    })
    const url = startUrl + (startUrl.includes("?") ? "&" : "?") + "window=settings" + (tab ? `&tab=${tab}` : "")
    this.settingsWindow.loadURL(url)
    this.settingsWindow.once("ready-to-show", () => this.settingsWindow?.show())
    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null
    })
  }

  public setContentProtection(enabled: boolean): void {
    this.mainWindow?.setContentProtection(enabled)
  }

  // Grow the overlay to fit a downward popover (0 restores the content height).
  public setMenuMinHeight(h: number): void {
    this.menuMinHeight = Math.max(0, Math.floor(h))
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const b = this.mainWindow.getBounds()
    const target = Math.max(this.lastContentHeight || b.height, this.menuMinHeight)
    this.mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: target })
    this.windowSize = { width: b.width, height: target }
  }

  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // Get current window bounds
    const bounds = this.mainWindow.getBounds()
    const currentX = bounds.x
    const currentY = bounds.y

    // Size and clamp against the display the window is actually on, not always the primary monitor,
    // so resizing the widget (e.g. opening the chat panel) doesn't yank it back to the main screen.
    const workArea = screen.getDisplayMatching(bounds).workArea

    // Use 75% width if debugging has occurred, otherwise use 60%
    const maxAllowedWidth = Math.floor(
      workArea.width * (this.appState.getHasDebugged() ? 0.75 : 0.5)
    )

    // Ensure width doesn't exceed max allowed width and height is reasonable
    const newWidth = Math.min(width + 32, Math.max(maxAllowedWidth, 722)) // 690px chat panel + margin
    this.lastContentHeight = Math.ceil(height)
    const newHeight = Math.max(this.lastContentHeight, this.menuMinHeight)

    // Keep the window within the current display's horizontal range (offsets matter on a 2nd screen)
    const minX = workArea.x
    const maxX = workArea.x + workArea.width - newWidth
    const newX = Math.min(Math.max(currentX, minX), maxX)

    // Update window bounds
    this.mainWindow.setBounds({
      x: newX,
      y: currentY,
      width: newWidth,
      height: newHeight
    })

    // Update internal state
    this.windowPosition = { x: newX, y: currentY }
    this.windowSize = { width: newWidth, height: newHeight }
    this.currentX = newX
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    this.screenWidth = workArea.width
    this.screenHeight = workArea.height

    
    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      width: 400,
      height: 600,
      minWidth: 300,
      minHeight: 200,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: false, // Start hidden, then show after setup
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      fullscreenable: false,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: true,
      resizable: true,
      movable: true,
      x: 100, // Start at a visible position
      y: 100
    }

    this.mainWindow = new BrowserWindow(windowSettings)
    // this.mainWindow.webContents.openDevTools()
    this.mainWindow.setContentProtection(!process.env.ALLOW_CAPTURE) // ALLOW_CAPTURE=1 lets screen tools see the window (dev only)
    // Start click-through; the renderer re-enables the mouse only while the cursor is over UI.
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true })

    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      })
      this.mainWindow.setHiddenInMissionControl(true)
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }
    if (process.platform === "linux") {
      // Linux-specific optimizations for better compatibility
      if (this.mainWindow.setHasShadow) {
        this.mainWindow.setHasShadow(false)
      }
      // Keep window focusable on Linux for proper interaction
      this.mainWindow.setFocusable(true)
    } 
    this.mainWindow.setSkipTaskbar(true)
    this.mainWindow.setAlwaysOnTop(true)

    this.mainWindow.loadURL(startUrl).catch((err) => {
      console.error("Failed to load URL:", err)
    })

    // Show window after loading URL and center it
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        // Center the window first
        this.centerWindow()
        this.mainWindow.show()
        this.mainWindow.focus()
        this.mainWindow.setAlwaysOnTop(true)
        console.log("Window is now visible and centered")
      }
    })

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.currentX = bounds.x
    this.currentY = bounds.y

    this.setupWindowListeners()
    this.isWindowVisible = true
  }

  private setupWindowListeners(): void {
    if (!this.mainWindow) return

    this.mainWindow.on("move", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowPosition = { x: bounds.x, y: bounds.y }
        this.currentX = bounds.x
        this.currentY = bounds.y
      }
    })

    this.mainWindow.on("resize", () => {
      if (this.mainWindow) {
        const bounds = this.mainWindow.getBounds()
        this.windowSize = { width: bounds.width, height: bounds.height }
      }
    })

    this.mainWindow.on("closed", () => {
      this.mainWindow = null
      this.isWindowVisible = false
      this.windowPosition = null
      this.windowSize = null
    })
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  public isVisible(): boolean {
    return this.isWindowVisible
  }

  public hideMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    const bounds = this.mainWindow.getBounds()
    this.windowPosition = { x: bounds.x, y: bounds.y }
    this.windowSize = { width: bounds.width, height: bounds.height }
    this.mainWindow.hide()
    this.isWindowVisible = false
  }

  public showMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    if (this.windowPosition && this.windowSize) {
      this.mainWindow.setBounds({
        x: this.windowPosition.x,
        y: this.windowPosition.y,
        width: this.windowSize.width,
        height: this.windowSize.height
      })
    }

    this.mainWindow.showInactive()

    this.isWindowVisible = true
  }

  public toggleMainWindow(): void {
    if (this.isWindowVisible) {
      this.hideMainWindow()
    } else {
      this.showMainWindow()
    }
  }

  private centerWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    // Get current window size or use defaults
    const windowBounds = this.mainWindow.getBounds()
    const windowWidth = windowBounds.width || 400
    const windowHeight = windowBounds.height || 600

    // Center on the display the window is currently on — not always the primary monitor — so a
    // widget dragged to a second screen stays there when it's brought forward.
    const display = screen.getDisplayMatching(windowBounds)
    const workArea = display.workArea

    // Calculate center position within that display's work area (offsets matter on non-primary screens)
    const centerX = Math.floor(workArea.x + (workArea.width - windowWidth) / 2)
    const centerY = workArea.y + 25 // near the top of whichever screen it's on

    // Set window position
    this.mainWindow.setBounds({
      x: centerX,
      y: centerY,
      width: windowWidth,
      height: windowHeight
    })
    
    // Update internal state
    this.windowPosition = { x: centerX, y: centerY }
    this.windowSize = { width: windowWidth, height: windowHeight }
    this.currentX = centerX
    this.currentY = centerY
  }

  public centerAndShowWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn("Main window does not exist or is destroyed.")
      return
    }

    this.centerWindow()
    this.mainWindow.show()
    this.mainWindow.focus()
    this.mainWindow.setAlwaysOnTop(true)
    this.isWindowVisible = true
    
    console.log(`Window centered and shown`)
  }

  // New methods for window movement
  public moveWindowRight(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.min(
      this.screenWidth - halfWidth,
      this.currentX + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowLeft(): void {
    if (!this.mainWindow) return

    const windowWidth = this.windowSize?.width || 0
    const halfWidth = windowWidth / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentX = Math.max(-halfWidth, this.currentX - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowDown(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.min(
      this.screenHeight - halfHeight,
      this.currentY + this.step
    )
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }

  public moveWindowUp(): void {
    if (!this.mainWindow) return

    const windowHeight = this.windowSize?.height || 0
    const halfHeight = windowHeight / 2

    // Ensure currentX and currentY are numbers
    this.currentX = Number(this.currentX) || 0
    this.currentY = Number(this.currentY) || 0

    this.currentY = Math.max(-halfHeight, this.currentY - this.step)
    this.mainWindow.setPosition(
      Math.round(this.currentX),
      Math.round(this.currentY)
    )
  }
}
