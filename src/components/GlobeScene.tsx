import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'
import ArcLinks from './ArcLinks'
import BookInstances from './BookInstances'
import ClusterLabels from './ClusterLabels'
import Picking from './Picking'
import SelectedPin from './SelectedPin'

const RIM_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const RIM_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
    gl_FragColor = vec4(0.42, 0.47, 0.57, rim * 0.38);
  }
`

export default function GlobeScene() {
  return (
    <div className="absolute inset-0 z-10">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [2.4, 1.6, 6.2], fov: 34, near: 0.1, far: 40 }}
        style={{ touchAction: 'none' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}

function Scene() {
  const reduced = useReducedMotion()
  const [autoRotate, setAutoRotate] = useState(!reduced)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (reduced) setAutoRotate(false)
  }, [reduced])

  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fdfdff', '#c3ccda', 0.55]} />
      <directionalLight position={[-4.5, 5.5, 6]} intensity={1.55} color="#fffaf4" />
      <directionalLight position={[3.5, -2.5, -3]} intensity={0.35} color="#c9d4e6" />

      <Globe />
      <BookInstances />
      <ClusterLabels />
      <ArcLinks />
      <SelectedPin />

      <Picking />
      <CameraRig />
      <PerfGuard />
      <AutoRotateLoop active={autoRotate} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping={!reduced}
        dampingFactor={0.075}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={2.75}
        maxDistance={8.5}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        onChange={() => invalidate()}
        onStart={() => setAutoRotate(false)}
      />
    </>
  )
}

function Globe() {
  return (
    <group>
      <mesh renderOrder={-3}>
        <sphereGeometry args={[SPHERE_RADIUS, 128, 96]} />
        <meshStandardMaterial color="#eef1f6" roughness={0.96} metalness={0} />
      </mesh>
      <mesh scale={1.014} renderOrder={-2}>
        <sphereGeometry args={[SPHERE_RADIUS, 64, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          vertexShader={RIM_VERTEX}
          fragmentShader={RIM_FRAGMENT}
        />
      </mesh>
    </group>
  )
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
  const invalidate = useThree((state) => state.invalidate)
  const controls = useThree((state) => state.controls) as
    | { enabled: boolean; update: () => void }
    | null
  const destination = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!focus) return
    const target = new THREE.Vector3(...focus.dir).normalize().multiplyScalar(focus.distance)
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

/** Drops device pixel ratio when the measured frame rate falls under 45 fps. */
function PerfGuard() {
  const setDpr = useThree((state) => state.setDpr)
  const gl = useThree((state) => state.gl)
  const sample = useRef({ frames: 0, time: 0 })

  useFrame((_, delta) => {
    if (delta > 0.25) {
      sample.current.frames = 0
      sample.current.time = 0
      return
    }
    sample.current.frames += 1
    sample.current.time += delta
    if (sample.current.frames >= 60) {
      const fps = sample.current.frames / sample.current.time
      const ratio = gl.getPixelRatio()
      if (fps < 45 && ratio > 1.05) setDpr(Math.max(1, Math.round(ratio - 0.5)))
      sample.current.frames = 0
      sample.current.time = 0
    }
  })

  return null
}
