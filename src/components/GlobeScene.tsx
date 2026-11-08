import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { PALETTE } from '../lib/theme'
import { atlasView, registerViewCommands } from '../lib/view'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'
import AmbientThreads from './AmbientThreads'
import ArcLinks from './ArcLinks'
import BookInstances from './BookInstances'
import ClusterLabels from './ClusterLabels'
import HoverRings from './HoverRings'
import Picking from './Picking'
import SelectedPin from './SelectedPin'

const FOV = 32
const START_DIR = new THREE.Vector3(0.46, 0.34, 0.82).normalize()

export default function GlobeScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [3, 2.4, 7], fov: FOV, near: 0.1, far: 60 }}
        style={{ touchAction: 'none' }}
      >
        <color attach="background" args={[PALETTE.canvas]} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}

function Scene() {
  const reduced = useReducedMotion()
  const autoRotate = useAtlas((state) => state.autoRotate)
  const [touched, setTouched] = useState(false)
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)

  const rotating = autoRotate && !touched && !reduced

  // Dock commands: dolly the camera within the framed bounds, or go home.
  useEffect(() => {
    registerViewCommands({
      zoom: (factor) => {
        const base = (camera.userData.baseDistance as number | undefined) ?? 8
        const distance = THREE.MathUtils.clamp(
          camera.position.length() / factor,
          base * 0.62,
          base * 1.9,
        )
        camera.position.setLength(distance)
        camera.lookAt(0, 0, 0)
        camera.updateProjectionMatrix()
        invalidate()
      },
      reset: () => {
        const base = (camera.userData.baseDistance as number | undefined) ?? 8
        camera.position.copy(START_DIR).multiplyScalar(base)
        camera.lookAt(0, 0, 0)
        useAtlas.getState().select(null)
        invalidate()
      },
    })
  }, [camera, invalidate])

  return (
    <>
      {/* three's PBR path divides irradiance by PI, so these are the pale-clay
          equivalents of ambient 0.65 / hemisphere 0.5 / key 1.1. */}
      <ambientLight intensity={1.3} />
      <hemisphereLight args={['#FFFFFF', '#D3D9E3', 0.9]} />
      <directionalLight position={[-4.5, 5.5, 6]} intensity={2.2} color="#FFFAF4" />

      <Rings />
      <Globe />
      <BookInstances />
      <AmbientThreads />
      <ClusterLabels />
      <ArcLinks />
      <SelectedPin />
      <HoverRings />

      <Picking />
      <Framing fov={FOV} />
      <CameraRig />
      <PerfGuard />
      <AutoRotateLoop active={rotating} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.45}
        zoomSpeed={0.8}
        minDistance={2.6}
        maxDistance={16}
        autoRotate={rotating}
        autoRotateSpeed={0.32}
        onChange={() => invalidate()}
        onStart={() => setTouched(true)}
      />
    </>
  )
}

/** Pale concentric rings, camera-locked behind the globe. */
function Rings() {
  const camera = useThree((state) => state.camera)
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    const node = group.current
    if (!node) return
    const distance = camera.position.length()
    node.position.copy(camera.position)
    node.quaternion.copy(camera.quaternion)
    node.children.forEach((child) => {
      child.position.z = -distance
    })
  })

  return (
    <group ref={group} renderOrder={-6}>
      {[1.22, 1.46, 1.72].map((factor, index) => (
        <mesh key={factor} renderOrder={-6}>
          <ringGeometry
            args={[SPHERE_RADIUS * factor, SPHERE_RADIUS * factor + 0.007, 160]}
          />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={index === 1 ? 0.6 : 0.42}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Globe() {
  return (
    <mesh renderOrder={-2}>
      <sphereGeometry args={[SPHERE_RADIUS, 96, 64]} />
      <meshStandardMaterial
        color={PALETTE.globe}
        roughness={1}
        metalness={0}
        emissive={PALETTE.canvas}
        emissiveIntensity={0.42}
      />
    </mesh>
  )
}

/**
 * Frames the sphere so its radius is 0.42 * min(canvas width, canvas height),
 * then keeps that ratio when the cell resizes without discarding user zoom.
 */
function Framing({ fov }: { fov: number }) {
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as
    | (THREE.EventDispatcher & { minDistance: number; maxDistance: number; update: () => void })
    | null
  const invalidate = useThree((state) => state.invalidate)
  const base = useRef(0)

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || size.height <= 0) return
    const half = Math.max(1, size.height / 2)
    const fraction = (0.42 * Math.min(size.width, size.height)) / half
    const tanHalf = Math.tan((fov * Math.PI) / 360)
    const distance = SPHERE_RADIUS / (tanHalf * Math.max(0.2, fraction))

    const previous = base.current
    base.current = distance
    atlasView.baseDistance = distance
    camera.userData.baseDistance = distance

    if (!previous) {
      camera.position.copy(START_DIR).multiplyScalar(distance)
    } else {
      camera.position.setLength(distance * (camera.position.length() / previous))
    }
    camera.lookAt(0, 0, 0)
    if (controls) {
      controls.minDistance = distance * 0.62
      controls.maxDistance = distance * 1.9
      controls.update()
    }
    camera.updateProjectionMatrix()
    invalidate()
  }, [size, camera, controls, fov, invalidate])

  return null
}

/** Keeps rendering while the globe auto-rotates under frameloop="demand". */
function AutoRotateLoop({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useFrame(() => {
    if (active) invalidate()
  })
  return null
}

/** Smooth fly-to for clusters and search results. */
function CameraRig() {
  const focus = useAtlas((state) => state.focus)
  const reduced = useReducedMotion()
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update: () => void } | null
  const invalidate = useThree((state) => state.invalidate)
  const destination = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!focus) return
    const baseDistance = (camera.userData.baseDistance as number | undefined) ?? 8
    const target = new THREE.Vector3(...focus.dir)
      .normalize()
      .multiplyScalar(baseDistance * focus.zoom)
    if (reduced) {
      camera.position.copy(target)
      camera.lookAt(0, 0, 0)
      controls?.update()
      invalidate()
      return
    }
    destination.current = target
    invalidate()
  }, [focus, reduced, camera, controls, invalidate])

  useFrame((_, delta) => {
    const target = destination.current
    if (!target) return
    const t = 1 - Math.exp(-5.5 * Math.min(delta, 0.1))
    camera.position.lerp(target, t)
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(target) < 0.006) {
      camera.position.copy(target)
      camera.lookAt(0, 0, 0)
      destination.current = null
    }
    invalidate()
  })

  return null
}

/** Reports the current zoom level and drops DPR below 45 fps. */
function PerfGuard() {
  const setDpr = useThree((state) => state.setDpr)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update: () => void } | null
  const sample = useRef({ frames: 0, time: 0 })

  useFrame((_, delta) => {
    const baseDistance = (camera.userData.baseDistance as number | undefined) ?? 0
    if (baseDistance > 0) atlasView.zoom = baseDistance / Math.max(0.001, camera.position.length())

    if (delta > 0.25) {
      sample.current.frames = 0
      sample.current.time = 0
      return
    }
    sample.current.frames += 1
    sample.current.time += delta
    if (sample.current.frames >= 90) {
      const fps = sample.current.frames / sample.current.time
      const ratio = gl.getPixelRatio()
      if (fps < 45 && ratio > 1.05) setDpr(Math.max(1, Math.round(ratio - 0.5)))
      sample.current.frames = 0
      sample.current.time = 0
    }
    // Damping needs a follow-up frame after the pointer stops.
    if (controls) controls.update()
  })

  return null
}
