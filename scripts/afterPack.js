// Sign the packaged app so Apple Silicon will run it. Prefer the stable self-signed identity
// (scripts/setup-signing.sh) so macOS keeps Screen Recording / Mic grants across rebuilds;
// fall back to ad-hoc if that identity isn't installed on this machine.
const { execSync } = require("child_process")
const path = require("path")

const IDENTITY = "Open Cluely Self-Signed"

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  let hasIdentity = false
  try {
    hasIdentity = execSync("security find-identity -p codesigning", { encoding: "utf8" }).includes(IDENTITY)
  } catch {}

  const signArg = hasIdentity ? `"${IDENTITY}"` : "-"
  execSync(`codesign --force --deep --sign ${signArg} "${appPath}"`, { stdio: "inherit" })
  console.log(`[afterPack] signed ${path.basename(appPath)} with ${hasIdentity ? IDENTITY : "ad-hoc"}`)
}
