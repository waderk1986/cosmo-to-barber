import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { degToRad } from 'three/src/math/MathUtils.js'
import { GetStartedButton } from '@/components/ui/get-started-button'

// ── TYPES ─────────────────────────────────────────────────────────────

type UniformValue = THREE.IUniform<unknown> | unknown

interface ExtendMaterialConfig {
  header: string
  vertexHeader?: string
  fragmentHeader?: string
  material?: THREE.MeshPhysicalMaterialParameters & { fog?: boolean }
  uniforms?: Record<string, UniformValue>
  vertex?: Record<string, string>
  fragment?: Record<string, string>
}

type ShaderWithDefines = THREE.ShaderLibShader & {
  defines?: Record<string, string | number | boolean>
}

// ── EXTEND MATERIAL (verbatim from 21st.dev) ──────────────────────────

function extendMaterial<T extends THREE.Material = THREE.Material>(
  BaseMaterial: new (params?: THREE.MaterialParameters) => T,
  cfg: ExtendMaterialConfig,
): THREE.ShaderMaterial {
  const physical = THREE.ShaderLib.physical as ShaderWithDefines
  const {
    vertexShader: baseVert,
    fragmentShader: baseFrag,
    uniforms: baseUniforms,
  } = physical
  const baseDefines = physical.defines ?? {}

  const uniforms: Record<string, THREE.IUniform> =
    THREE.UniformsUtils.clone(baseUniforms)

  const defaults = new BaseMaterial(cfg.material || {}) as T & {
    color?: THREE.Color
    roughness?: number
    metalness?: number
    envMap?: THREE.Texture
    envMapIntensity?: number
  }

  if (defaults.color) uniforms.diffuse.value = defaults.color
  if ('roughness' in defaults) uniforms.roughness.value = defaults.roughness
  if ('metalness' in defaults) uniforms.metalness.value = defaults.metalness
  if ('envMap' in defaults) uniforms.envMap.value = defaults.envMap
  if ('envMapIntensity' in defaults)
    uniforms.envMapIntensity.value = defaults.envMapIntensity

  Object.entries(cfg.uniforms ?? {}).forEach(([key, u]) => {
    uniforms[key] =
      u !== null && typeof u === 'object' && 'value' in u
        ? (u as THREE.IUniform<unknown>)
        : ({ value: u } as THREE.IUniform<unknown>)
  })

  let vert = `${cfg.header}\n${cfg.vertexHeader ?? ''}\n${baseVert}`
  let frag = `${cfg.header}\n${cfg.fragmentHeader ?? ''}\n${baseFrag}`

  for (const [inc, code] of Object.entries(cfg.vertex ?? {})) {
    vert = vert.replace(inc, `${inc}\n${code}`)
  }

  for (const [inc, code] of Object.entries(cfg.fragment ?? {})) {
    frag = frag.replace(inc, `${inc}\n${code}`)
  }

  return new THREE.ShaderMaterial({
    defines: { ...baseDefines },
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    lights: true,
    fog: !!cfg.material?.fog,
  })
}

// ── HELPERS ───────────────────────────────────────────────────────────

const hexToNormalizedRGB = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const r = Number.parseInt(clean.substring(0, 2), 16)
  const g = Number.parseInt(clean.substring(2, 4), 16)
  const b = Number.parseInt(clean.substring(4, 6), 16)
  return [r / 255, g / 255, b / 255]
}

// ── NOISE GLSL (verbatim from 21st.dev) ───────────────────────────────

const noise = `
float random (in vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z)); float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz)); float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}
`

// ── GEOMETRY ──────────────────────────────────────────────────────────

function createStackedPlanesBufferGeometry(
  n: number,
  width: number,
  height: number,
  spacing: number,
  heightSegments: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const numVertices = n * (heightSegments + 1) * 2
  const numFaces = n * heightSegments * 2
  const positions = new Float32Array(numVertices * 3)
  const indices = new Uint32Array(numFaces * 3)
  const uvs = new Float32Array(numVertices * 2)
  let vertexOffset = 0,
    indexOffset = 0,
    uvOffset = 0
  const totalWidth = n * width + (n - 1) * spacing
  const xOffsetBase = -totalWidth / 2

  for (let i = 0; i < n; i++) {
    const xOffset = xOffsetBase + i * (width + spacing)
    const uvXOffset = Math.random() * 300
    const uvYOffset = Math.random() * 300
    for (let j = 0; j <= heightSegments; j++) {
      const y = height * (j / heightSegments - 0.5)
      positions.set([xOffset, y, 0, xOffset + width, y, 0], vertexOffset * 3)
      const uvY = j / heightSegments
      uvs.set(
        [uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset],
        uvOffset,
      )
      if (j < heightSegments) {
        const a = vertexOffset,
          b = vertexOffset + 1,
          c = vertexOffset + 2,
          d = vertexOffset + 3
        indices.set([a, b, c, c, b, d], indexOffset)
        indexOffset += 6
      }
      vertexOffset += 2
      uvOffset += 4
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  return geometry
}

// ── MERGED PLANES ─────────────────────────────────────────────────────

const MergedPlanes = forwardRef<
  THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>,
  {
    material: THREE.ShaderMaterial
    width: number
    count: number
    height: number
  }
>(({ material, width, count, height }, ref) => {
  const mesh = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(
    null!,
  )
  useImperativeHandle(ref, () => mesh.current)
  const geometry = useMemo(
    () => createStackedPlanesBufferGeometry(count, width, height, 0, 100),
    [count, width, height],
  )
  useFrame((_, delta) => {
    mesh.current.material.uniforms.time.value += 0.1 * delta
  })
  return <mesh ref={mesh} geometry={geometry} material={material} />
})
MergedPlanes.displayName = 'MergedPlanes'

// ── BEAMS SCENE ───────────────────────────────────────────────────────

const BeamsScene: FC = () => {
  const meshRef = useRef<
    THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  >(null!)

  const beamMaterial = useMemo(
    () =>
      extendMaterial(THREE.MeshStandardMaterial, {
        header: `
varying vec3 vEye;
varying float vNoise;
varying vec2 vUv;
varying vec3 vPosition;
uniform float time;
uniform float uSpeed;
uniform float uNoiseIntensity;
uniform float uScale;
${noise}`,
        vertexHeader: `
float getPos(vec3 pos) {
  vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
  return cnoise(noisePos);
}
vec3 getCurrentPos(vec3 pos) {
  vec3 newpos = pos;
  newpos.z += getPos(pos);
  return newpos;
}
vec3 getNormal(vec3 pos) {
  vec3 curpos = getCurrentPos(pos);
  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
  vec3 tangentX = normalize(nextposX - curpos);
  vec3 tangentZ = normalize(nextposZ - curpos);
  return normalize(cross(tangentZ, tangentX));
}`,
        fragmentHeader: '',
        vertex: {
          '#include <begin_vertex>': `transformed.z += getPos(transformed.xyz);`,
          '#include <beginnormal_vertex>': `objectNormal = getNormal(position.xyz);`,
        },
        fragment: {
          '#include <dithering_fragment>': `
float randomNoise = noise(gl_FragCoord.xy);
gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;`,
        },
        material: { fog: true },
        uniforms: {
          diffuse: new THREE.Color(...hexToNormalizedRGB('#000000')),
          time: { shared: true, mixed: true, linked: true, value: 0 },
          roughness: 0.3,
          metalness: 0.3,
          uSpeed: { shared: true, mixed: true, linked: true, value: 2.5 },
          envMapIntensity: 10,
          uNoiseIntensity: 2,
          uScale: 0.15,
        },
      }),
    [],
  )

  return (
    <group rotation={[0, 0, degToRad(43)]}>
      <MergedPlanes
        ref={meshRef}
        material={beamMaterial}
        count={15}
        width={2.5}
        height={18}
      />
      <directionalLight color="#ffffff" intensity={1} position={[0, 3, 10]} />
    </group>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────

export default function BeamsHero() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000000',
      }}
    >
      {/* Canvas */}
      {!reduced && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas
            style={{ width: '100%', height: '100%' }}
            dpr={[1, 2]}
            frameloop="always"
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) =>
              gl.setClearColor(new THREE.Color('#000000'), 1)
            }
          >
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={1} />
            <BeamsScene />
            <PerspectiveCamera makeDefault position={[0, 0, 20]} fov={30} />
          </Canvas>
        </div>
      )}

      {/* Grain overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          opacity: 0.35,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundSize: '180px',
        }}
      />

      {/* Gradient overlay for text legibility */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 11,
          pointerEvents: 'none',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 40%, rgba(0,0,0,0.3) 100%)',
        }}
      />

      {/* Hero content */}
      <div
        style={{
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          style={{
            maxWidth: '64rem',
            width: '100%',
            margin: '0 auto',
            padding: '0 1.5rem',
            textAlign: 'center',
          }}
        >
          {/* Badge */}
          <p
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '2rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: '0.375rem',
                height: '0.375rem',
                borderRadius: '9999px',
                background: '#008080',
                display: 'inline-block',
              }}
            />
            Crossover Program — Summer 2026
          </p>

          {/* Heading */}
          <h1
            id="hero-heading"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(4rem, 12vw, 10rem)',
              lineHeight: 0.88,
              letterSpacing: '0.02em',
              margin: '0 0 2rem',
            }}
          >
            <span style={{ color: '#008080', display: 'block' }}>
              Cosmetology
            </span>
            <span style={{ color: '#ffffff', display: 'block' }}>
              to Barbering
            </span>
          </h1>

          {/* Subhead */}
          <p
            style={{
              maxWidth: '42rem',
              margin: '0 auto 3rem',
              fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.65,
            }}
          >
            Two weeks. Dual licensure. A fast track from cosmetology chair to
            barber chair, and the Colorado DORA Barbering License exam.
          </p>

          {/* CTA */}
          <GetStartedButton href="https://tcr.populiweb.com/router/admissions/onlineapplications/index?application_form=14">
            Apply for Summer 2026
          </GetStartedButton>
        </div>

        {/* Stats bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              maxWidth: '64rem',
              margin: '0 auto',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem 1.5rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.04em',
            }}
          >
            <span>2 Weeks</span>
            <span
              aria-hidden="true"
              style={{ color: 'rgba(255,255,255,0.15)' }}
            >
              |
            </span>
            <span>3 Credits</span>
            <span
              aria-hidden="true"
              style={{ color: 'rgba(255,255,255,0.15)' }}
            >
              |
            </span>
            <span>$650 Course Fee</span>
            <span
              aria-hidden="true"
              style={{ color: 'rgba(255,255,255,0.15)' }}
            >
              |
            </span>
            <span>June 15&ndash;26, 2026</span>
            <span
              aria-hidden="true"
              style={{ color: 'rgba(255,255,255,0.15)' }}
            >
              |
            </span>
            <span>Instructor: Sergio Antillon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
