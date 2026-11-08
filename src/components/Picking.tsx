import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAtlas } from '../store/atlas'
import { atlas } from '../workers/atlasClient'

const PICK_RADIUS = 0.05
const DRAG_SLOP = 6

/**
 * Picking lives in the worker (kd-tree over bump centres), so hover and click
 * cost nothing on the GPU and never touch the instance meshes.
 */
export default function Picking() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const element = gl.domElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let frame = 0
    let queued: { x: number; y: number } | null = null
    let token = 0
    let down: { x: number; y: number; time: number } | null = null
    let dragging = false

    const rayAt = (clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect()
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      return raycaster.ray
    }

    const pickAt = (clientX: number, clientY: number) => {
      const ray = rayAt(clientX, clientY)
      const { origin, direction } = ray
      const current = ++token
      return atlas
        .pick(
          [origin.x, origin.y, origin.z],
          [direction.x, direction.y, direction.z],
          PICK_RADIUS,
        )
        .then((id) => (current === token ? id : null))
    }

    const hoverAt = (clientX: number, clientY: number) => {
      pickAt(clientX, clientY)
        .then((id) => useAtlas.getState().hover(id))
        .catch(() => {})
    }

    const onPointerMove = (event: PointerEvent) => {
      useAtlas.getState().setPointer({ x: event.clientX, y: event.clientY })
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > DRAG_SLOP) {
        dragging = true
      }
      if (dragging) {
        useAtlas.getState().hover(null)
        return
      }
      queued = { x: event.clientX, y: event.clientY }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (queued) hoverAt(queued.x, queued.y)
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, time: performance.now() }
      dragging = false
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!down) return
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      const elapsed = performance.now() - down.time
      down = null
      if (dragging || moved > DRAG_SLOP || elapsed > 700) {
        dragging = false
        return
      }
      pickAt(event.clientX, event.clientY)
        .then((id) => {
          useAtlas.getState().select(id)
          invalidate()
        })
        .catch(() => {})
    }

    const onDoubleClick = (event: MouseEvent) => {
      pickAt(event.clientX, event.clientY)
        .then((id) => {
          if (id == null) return
          const store = useAtlas.getState()
          store.select(id)
          const clusterId = store.clusterOf?.[id]
          if (clusterId != null) store.flyToCluster(clusterId)
          invalidate()
        })
        .catch(() => {})
    }

    const onPointerLeave = () => {
      useAtlas.getState().hover(null)
      useAtlas.getState().setPointer(null)
    }

    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointerup', onPointerUp)
    element.addEventListener('pointerleave', onPointerLeave)
    element.addEventListener('dblclick', onDoubleClick)
    element.style.cursor = 'grab'

    return () => {
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('pointerleave', onPointerLeave)
      element.removeEventListener('dblclick', onDoubleClick)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [gl, camera, invalidate])

  return null
}
