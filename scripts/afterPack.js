// electron-builder skips signing without a Developer ID, which leaves the .app with an
// invalid seal that Apple Silicon refuses to launch ("damaged"). Ad-hoc sign the whole
// bundle after packing so the dmg contains a runnable (unsigned-but-valid) app.
const { execSync } = require("child_process")
const path = require("path")

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "inherit" })
  console.log(`[afterPack] ad-hoc signed ${appName}`)
}
