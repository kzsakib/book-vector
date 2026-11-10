import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint, PALETTE } from '../lib/theme'
import { atlasView, registerViewCommands } from '../lib/view'
import { useAtlas } from '../store/atlas'
import { useReducedMotion } from '../hooks/useReducedMotion'
import ArcLinks from './ArcLinks'
import BookDots from './BookDots'
import ClusterLabels from './ClusterLabels'
import Picking from './Picking'
import SelectedPin from './SelectedPin'

const FOV = 30
const START_DIR = new THREE.Vector3(0.46, 0.34, 0.82).normalize()
/** 0.44 * the shorter side of the free rectangle, per the layout brief. */
const FRAME_FRACTION = 0.44

export default function GlobeScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [3, 2.4, 7], fov: FOV, near: SPHERE_RADIUS * 0.02, far: SPHERE_RADIUS * 30 }}
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="A pale clay globe covered in small pastel spheres. Each sphere is a book; similar books sit together. Use the filters, search, or the hidden book list to explore."
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
  const autoRotate = useAtlas((state) => state.autoRotate)
  const [idle, setIdle] = useState(true)
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const resume = useRef(0)

  // A non-passive listener keeps wheel and ctrl+wheel (pinch) from bubbling to
  // the page while OrbitControls still receives the same event.
  useEffect(() => {
    const element = gl.domElement
    const stop = (event: WheelEvent) => event.preventDefault()
    element.addEventListener('wheel', stop, { passive: false })
    return () => element.removeEventListener('wheel', stop)
  }, [gl])

  const rotating = autoRotate && idle && !reduced

  useEffect(() => {
    if (!idle) {
      resume.current = window.setTimeout(() => setIdle(true), 4000)
      return () => window.clearTimeout(resume.current)
    }
    return undefined
  }, [idle])

  useEffect(() => {
    registerViewCommands({
      zoom: (factor) => {
        const distance = THREE.MathUtils.clamp(
          camera.position.length() / factor,
          SPHERE_RADIUS * 1.12,
          SPHERE_RADIUS * 4.2,
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
      {/* Soft studio: large key from the top-left, cool fill, faint rim. */}
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#FFFFFF', '#CBD3E0', 0.55]} />
      <directionalLight position={[-5, 5.5, 5.5]} intensity={2.15} color="#FFFAF4" />
      <directionalLight position={[4, -2, 3]} intensity={0.35} color="#D9E3FF" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.4}
          position={[-5, 5, 4]}
          rotation={[0, Math.PI / 5, 0]}
          scale={[10, 10, 1]}
          color="#fff8ef"
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[6, 1, 3]}
          rotation={[0, -Math.PI / 4, 0]}
          scale={[8, 8, 1]}
          color="#dfe8ff"
        />
        <Lightformer
          form="ring"
          intensity={0.8}
          position={[0, -2, -6]}
          scale={9}
          color="#ffffff"
        />
      </Environment>

      <Rings />
      <Graticule />
      <Globe />
      <BookDots />
      <ClusterLabels />
      <ArcLinks />
      <SelectedPin />

      <Picking />
      <Framing fov={FOV} />
      <CameraRig />
      <PerfGuard />
      <AutoRotateLoop active={rotating} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={SPHERE_RADIUS * 1.12}
        maxDistance={SPHERE_RADIUS * 4.2}
        minPolarAngle={0.22}
        maxPolarAngle={Math.PI - 0.22}
        autoRotate={rotating}
        autoRotateSpeed={0.5}
        onStart={() => setIdle(false)}
        onChange={() => invalidate()}
      />
    </>
  )
}

/** Two faint decorative rings, camera-locked behind the globe. */
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
      {[1.18, 1.34].map((factor) => (
        <mesh key={factor} renderOrder={-6}>
          <ringGeometry args={[SPHERE_RADIUS * factor, SPHERE_RADIUS * factor + 0.005, 160]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0.42}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Latitude/longitude every 30°, so rotation and depth stay legible. */
function Graticule() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const radius = SPHERE_RADIUS * 1.001
    const segments = 96

    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = THREE.MathUtils.degToRad(90 - lat)
      const r = Math.sin(phi) * radius
      const y = Math.cos(phi) * radius
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2
        const b = ((i + 1) / segments) * Math.PI * 2
        positions.push(Math.cos(a) * r, y, Math.sin(a) * r)
        positions.push(Math.cos(b) * r, y, Math.sin(b) * r)
      }
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const theta = THREE.MathUtils.degToRad(lon)
      for (let i = 0; i < segments; i++) {
        const p1 = (i / segments) * Math.PI
        const p2 = ((i + 1) / segments) * Math.PI
        positions.push(
          Math.sin(p1) * Math.cos(theta) * radius,
          Math.cos(p1) * radius,
          Math.sin(p1) * Math.sin(theta) * radius,
        )
        positions.push(
          Math.sin(p2) * Math.cos(theta) * radius,
          Math.cos(p2) * radius,
          Math.sin(p2) * Math.sin(theta) * radius,
        )
      }
    }

    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return buffer
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry} renderOrder={-1}>
      <lineBasicMaterial color="#7C8AA0" transparent opacity={0.16} depthWrite={false} />
    </lineSegments>
  )
}

/**
 * Lit clay sphere: brighter base, region tints blended into the vertices, a
 * fresnel limb and a thin bright rim on the lit edge.
 */
function Globe() {
  const clusters = useAtlas((state) => state.clusters)

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(SPHERE_RADIUS, 96, 64)
    const position = geo.attributes.position
    const colours = new Float32Array(position.count * 3)
    const base = new THREE.Color(PALETTE.globe)
    const lightSide = new THREE.Color('#F4F6FA')
    const shadeSide = new THREE.Color('#BCC4D2')
    const keyDir = new THREE.Vector3(-0.62, 0.52, 0.58).normalize()
    const tints = clusters.map((cluster) => new THREE.Color(genreTint(cluster.genre)))
    const centroids = clusters.map((cluster) =>
      new THREE.Vector3(...cluster.centroid).normalize(),
    )
    const vertex = new THREE.Vector3()
    const mixed = new THREE.Color()

    for (let i = 0; i < position.count; i++) {
      vertex.set(position.getX(i), position.getY(i), position.getZ(i)).normalize()
      // Diffuse ramp baked in, so the sphere reads as a volume from every angle.
      const light = THREE.MathUtils.clamp(vertex.dot(keyDir), -1, 1) * 0.5 + 0.5
      mixed.copy(shadeSide).lerp(lightSide, Math.pow(light, 0.9))
      mixed.lerp(base, 0.25)

      for (let c = 0; c < centroids.length; c++) {
        const dot = vertex.dot(centroids[c])
        if (dot <= 0.82) continue
        const t = Math.min(1, (dot - 0.82) / 0.18)
        const smooth = t * t * (3 - 2 * t)
        mixed.lerp(tints[c], smooth * 0.2)
      }

      colours[i * 3] = mixed.r
      colours[i * 3 + 1] = mixed.g
      colours[i * 3 + 2] = mixed.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3))
    return geo
  }, [clusters])

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.9,
      metalness: 0,
      vertexColors: true,
    })
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vAtlasPos;\nvarying vec3 vAtlasNormal;',
        )
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvAtlasPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAtlasNormal = normalize(mat3(modelMatrix) * objectNormal);',
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vAtlasPos;\nvarying vec3 vAtlasNormal;',
        )
        .replace(
          '#include <dithering_fragment>',
          [
            '#include <dithering_fragment>',
            'vec3 atlasView = normalize(cameraPosition - vAtlasPos);',
            'float atlasFres = pow(1.0 - clamp(dot(normalize(vAtlasNormal), atlasView), 0.0, 1.0), 2.4);',
            // Limb darkening toward the pale shade of the sphere.
            'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.737, 0.769, 0.824), atlasFres * 0.6);',
            // Thin bright rim just inside the limb, on the lit side only.
            'float atlasRim = smoothstep(0.72, 0.98, atlasFres) * smoothstep(-0.25, 0.55, dot(normalize(vAtlasNormal), vec3(-0.62, 0.52, 0.58)));',
            'gl_FragColor.rgb += vec3(0.16) * atlasRim;',
          ].join('\n'),
        )
    }
    return mat
  }, [])

  return <mesh geometry={geometry} material={material} renderOrder={0} />
}

/**
 * Frames the sphere at 0.44 * the free rectangle, then preserves that ratio on
 * resize and clamps zoom so the whole sphere always fits.
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
    // The canvas already excludes the dock strip, so the sphere is framed in the
    // space it actually occupies: radius = 0.44 * the shorter canvas side.
    const radiusPx = FRAME_FRACTION * Math.min(size.width, size.height)
    const fraction = (2 * radiusPx) / size.height
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
      // Closest zoom still frames most of the sphere; furthest shows the whole globe.
      controls.minDistance = SPHERE_RADIUS * 1.12
      controls.maxDistance = SPHERE_RADIUS * 4.2
      controls.update()
    }
    camera.updateProjectionMatrix()
    invalidate()
  }, [size, camera, controls, fov, invalidate])

  return null
}

function AutoRotateLoop({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate)
  useFrame(() => {
    if (active) invalidate()
  })
  return null
}

/**
 * Great-circle fly-to: slerp the direction and ease the radius over 900ms with
 * power3.inOut. Reduced motion jumps straight there.
 */
function CameraRig() {
  const focus = useAtlas((state) => state.focus)
  const reduced = useReducedMotion()
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update: () => void } | null
  const invalidate = useThree((state) => state.invalidate)
  const flight = useRef<{
    fromDir: THREE.Vector3
    toDir: THREE.Vector3
    fromRadius: number
    toRadius: number
    startedAt: number
  } | null>(null)

  useEffect(() => {
    if (!focus) return
    const baseDistance = (camera.userData.baseDistance as number | undefined) ?? 8
    const toDir = new THREE.Vector3(...focus.dir).normalize()
    const toRadius = THREE.MathUtils.clamp(
      baseDistance * focus.zoom,
      SPHERE_RADIUS * 1.12,
      SPHERE_RADIUS * 4.2,
    )
    if (reduced) {
      camera.position.copy(toDir).multiplyScalar(toRadius)
      camera.lookAt(0, 0, 0)
      controls?.update()
      invalidate()
      return
    }
    flight.current = {
      fromDir: camera.position.clone().normalize(),
      toDir,
      fromRadius: camera.position.length(),
      toRadius,
      startedAt: performance.now(),
    }
    invalidate()
  }, [focus, reduced, camera, controls, invalidate])

  useFrame(() => {
    const current = flight.current
    if (!current) return
    const t = THREE.MathUtils.clamp((performance.now() - current.startedAt) / 900, 0, 1)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const dir = current.fromDir.clone().lerp(current.toDir, eased).normalize()
    const radius = THREE.MathUtils.lerp(current.fromRadius, current.toRadius, eased)
    camera.position.copy(dir.multiplyScalar(radius))
    camera.lookAt(0, 0, 0)
    controls?.update()
    if (t >= 1) flight.current = null
    invalidate()
  })

  return null
}

/** Publishes zoom for labels and drops DPR below 45 fps. */
function PerfGuard() {
  const setDpr = useThree((state) => state.setDpr)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { update: () => void } | null
  const sample = useRef({ frames: 0, time: 0 })
  const lastDistance = useRef(0)
  const invalidate = useThree((state) => state.invalidate)

  useFrame((_, delta) => {
    const baseDistance = (camera.userData.baseDistance as number | undefined) ?? 0

    // Demand rendering stops damping mid-flight; keep frames coming while the
    // camera is still easing so zoom and rotation settle at their clamps.
    const distance = camera.position.length()
    if (Math.abs(distance - lastDistance.current) > 0.0004) {
      lastDistance.current = distance
      invalidate()
    }
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
    if (controls) controls.update()
  })

  return null
}
