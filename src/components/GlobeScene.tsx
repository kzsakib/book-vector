import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SPHERE_RADIUS } from '../data/format'
import { genreTint, PALETTE } from '../lib/theme'
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
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [3, 2.4, 7], fov: FOV, near: 0.1, far: 60 }}
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="A pale clay globe covered in thousands of pastel bumps. Each bump is a book; similar books sit together. Use the filters, search, or the hidden book list to explore."
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
  const [idle, setIdle] = useState(true)
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)
  const resume = useRef(0)

  const rotating = autoRotate && idle && !reduced

  // Resume the idle drift once the user has stopped touching the globe.
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
      {/* Soft studio: a large key from the top-left, a cool fill, a faint rim. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#FFFFFF', '#D6DCE6', 0.7]} />
      <directionalLight position={[-4.5, 5.5, 6]} intensity={1.9} color="#FFFAF4" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.2}
          position={[-5, 5, 4]}
          rotation={[0, Math.PI / 5, 0]}
          scale={[10, 10, 1]}
          color="#fff8ef"
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[6, 1, 3]}
          rotation={[0, -Math.PI / 4, 0]}
          scale={[8, 8, 1]}
          color="#dfe8ff"
        />
        <Lightformer
          form="ring"
          intensity={0.9}
          position={[0, -2, -6]}
          scale={9}
          color="#ffffff"
        />
      </Environment>

      <Rings />
      <Globe />
      <GroundShadow />
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
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        minDistance={2.6}
        maxDistance={16}
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

/** Blurred radial pool of shade under the globe. */
function GroundShadow() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(128, 64, 4, 128, 64, 124)
      gradient.addColorStop(0, 'rgba(74, 88, 116, 0.42)')
      gradient.addColorStop(0.55, 'rgba(74, 88, 116, 0.18)')
      gradient.addColorStop(1, 'rgba(74, 88, 116, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 256, 128)
    }
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])

  return (
    <mesh
      position={[0, -SPHERE_RADIUS * 1.34, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={-3}
    >
      <planeGeometry args={[SPHERE_RADIUS * 3.4, SPHERE_RADIUS * 1.9]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.9} />
    </mesh>
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
      {[1.24, 1.5, 1.8].map((factor, index) => (
        <mesh key={factor} renderOrder={-6}>
          <ringGeometry args={[SPHERE_RADIUS * factor, SPHERE_RADIUS * factor + 0.006, 160]} />
          <meshBasicMaterial
            color={index === 1 ? '#F7F9FC' : '#FFFFFF'}
            transparent
            opacity={index === 1 ? 0.7 : 0.5}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Sphere with genre regions blended into the surface (vertex colours) and a
 * fresnel limb darkening injected into the standard material, so the globe
 * reads as a lit volume rather than a flat disc.
 */
function Globe() {
  const clusters = useAtlas((state) => state.clusters)

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(SPHERE_RADIUS, 96, 64)
    const position = geo.attributes.position
    const colours = new Float32Array(position.count * 3)
    const base = new THREE.Color(PALETTE.globe)
    const tints = clusters.map((cluster) => new THREE.Color(genreTint(cluster.genre)))
    const centroids = clusters.map((cluster) =>
      new THREE.Vector3(...cluster.centroid).normalize(),
    )
    const vertex = new THREE.Vector3()
    const mixed = new THREE.Color()

    for (let i = 0; i < position.count; i++) {
      vertex.set(position.getX(i), position.getY(i), position.getZ(i)).normalize()
      mixed.copy(base)
      let weight = 0
      for (let c = 0; c < centroids.length; c++) {
        const dot = vertex.dot(centroids[c])
        if (dot <= 0.84) continue
        const t = Math.min(1, (dot - 0.84) / 0.16)
        const smooth = t * t * (3 - 2 * t)
        mixed.lerp(tints[c], smooth * 0.34)
        weight += smooth
      }
      if (weight === 0) mixed.copy(base)
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
      roughness: 0.85,
      metalness: 0,
      vertexColors: true,
      emissive: new THREE.Color('#EDF0F5'),
      emissiveIntensity: 0.18,
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
            'float atlasFres = pow(1.0 - clamp(dot(normalize(vAtlasNormal), atlasView), 0.0, 1.0), 2.6);',
            'gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.788, 0.812, 0.855), atlasFres * 0.55);',
            'gl_FragColor.rgb += vec3(0.05) * smoothstep(0.78, 1.0, atlasFres);',
          ].join('\n'),
        )
    }
    return mat
  }, [])

  return <mesh geometry={geometry} material={material} renderOrder={-2} />
}

/**
 * Frames the sphere so its radius is 0.40 * min(canvas width, canvas height),
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
    // Reserve room for the dock and hint so the sphere never sits under them.
    const usableHeight = Math.max(220, size.height - 104)
    const half = usableHeight / 2
    const fraction = (0.4 * Math.min(size.width, usableHeight)) / half
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

/**
 * Fly-to along a great circle: the camera direction slerps while the radius
 * eases, 1.1s with a symmetric power curve. Reduced motion jumps straight there.
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
    const toRadius = baseDistance * focus.zoom
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
    const t = THREE.MathUtils.clamp((performance.now() - current.startedAt) / 1100, 0, 1)
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
    if (controls) controls.update()
  })

  return null
}
