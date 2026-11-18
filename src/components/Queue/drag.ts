import type React from "react"

// Manual window drag by cursor delta. Bails on typing/scrolling/clicking targets so only the
// empty chrome drags. __ocDragging keeps the overlay's mouse captured during the drag
// (see Queue's click-through handler) so a fast drag can't break mid-way.
export function startWindowDrag(e: React.MouseEvent): void {
  if ((e.target as Element).closest("button, a, input, textarea, select, [contenteditable], .overflow-y-auto")) return
  let lastX = e.screenX
  let lastY = e.screenY
  ;(window as any).__ocDragging = true
  const onMove = (ev: MouseEvent) => {
    window.electronAPI.invoke("move-window-by", ev.screenX - lastX, ev.screenY - lastY)
    lastX = ev.screenX
    lastY = ev.screenY
  }
  const onUp = () => {
    ;(window as any).__ocDragging = false
    document.removeEventListener("mousemove", onMove)
    document.removeEventListener("mouseup", onUp)
  }
  document.addEventListener("mousemove", onMove)
  document.addEventListener("mouseup", onUp)
}
