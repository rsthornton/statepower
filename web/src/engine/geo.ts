import * as THREE from "three";

// Ground layers baked by scripts/build_geo_layers.py: land, water depth and relief around the states.
// Decoration only. It is drawn on the ground plane, under the states, and never touches a state's height or top color.

// The baked frame, in projected pixels of geoAlbersUsa().scale(1300).translate([487.5, 305]) (keep in step with the script).
const K = 1300, CX = 487.5, CY = 305, SCALE = 1 / 48;
const PX = { x0: -600, y0: -450, x1: 1600, y1: 1050 };
const AK_BOX = [CX - 0.425 * K, CY + 0.120 * K, CX - 0.214 * K, CY + 0.234 * K];
const HI_BOX = [CX - 0.214 * K, CY + 0.166 * K, CX - 0.115 * K, CY + 0.234 * K];
const uvBox = (b: number[]) => new THREE.Vector4(
  (b[0] - PX.x0) / (PX.x1 - PX.x0), (b[1] - PX.y0) / (PX.y1 - PX.y0), (b[2] - PX.x0) / (PX.x1 - PX.x0), (b[3] - PX.y0) / (PX.y1 - PX.y0));

export type GeoLook = {
  /** Land outside the states, and the land under them. */
  land: string;
  landUS: string;
  /** Water: near the coast and over the deepest sea floor. */
  shallow: string;
  deep: string;
  /** Coastline and inset frame color, and its strength (0..1). */
  coast: string;
  coastAlpha: number;
  /** Hillshade strength on land and sea floor outside the states (0..1, low). */
  relief: number;
  /** Water surface: slow brightness ripple (0..0.05) and sun glint (0..1). Both off under reduced motion or on a weak GPU. */
  shimmer: number;
  glint: number;
};

const VERT = /* glsl */ `
  uniform vec4 uFrame;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vUv = vec2((w.x - uFrame.x) / uFrame.z, (w.z - uFrame.y) / uFrame.w);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMask;
  uniform sampler2D uDepth;
  uniform sampler2D uRelief;
  uniform vec3 uLand, uLandUS, uShallow, uDeep, uCoast, uBg, uSun;
  uniform float uCoastA, uReliefK, uShimmer, uGlint, uTime, uOpacity;
  uniform vec2 uHaze;
  uniform vec4 uAk, uHi;
  varying vec2 vUv;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float frame(vec4 b, vec2 uv) {
    vec2 w = fwidth(uv) * 1.1;
    vec2 lo = smoothstep(w, vec2(0.0), abs(uv - b.xy));
    vec2 hi = smoothstep(w, vec2(0.0), abs(uv - b.zw));
    float inX = step(b.x, uv.x) * step(uv.x, b.z), inY = step(b.y, uv.y) * step(uv.y, b.w);
    return max(max(lo.x, hi.x) * inY, max(lo.y, hi.y) * inX);
  }

  void main() {
    vec3 m = texture2D(uMask, vUv).rgb;
    float depth = texture2D(uDepth, vUv).r;
    float r = texture2D(uRelief, vUv).r - 0.5;
    float land = smoothstep(0.4, 0.6, m.r);

    // Water: shallow shelf to deep basin, lakes shallow, a soft band along every coast, faint sea-floor relief.
    vec3 water = mix(uShallow, uDeep, smoothstep(0.02, 0.8, depth));
    water = mix(water, uShallow, m.b * 0.7);
    float shore = texture2D(uMask, vUv, 3.5).r;
    water = mix(water, uShallow, smoothstep(0.02, 0.45, shore) * 0.45);
    water *= 1.0 + r * uReliefK * 0.6;
    vec2 q = vWorld.xz * 1.4;
    float n = noise(q + vec2(uTime * 0.05, uTime * 0.03)) + noise(q * 2.3 - vec2(uTime * 0.04, -uTime * 0.06));
    water *= 1.0 + (n - 1.0) * uShimmer;
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = normalize(vec3((n - 1.0) * 0.18, 1.0, (noise(q * 1.7 + 3.0 + uTime * 0.05) - 0.5) * 0.36));
    water += uGlint * pow(max(dot(N, normalize(V + uSun)), 0.0), 90.0);

    // Land: flat under the states, hillshaded elsewhere.
    vec3 ground = mix(uLand, uLandUS, m.g) * (1.0 + r * uReliefK * (1.0 - m.g));
    vec3 col = mix(water, ground, land);

    // Coastline (the states draw their own) and the Alaska and Hawaii inset frames.
    float line = 1.0 - smoothstep(0.0, fwidth(m.r) * 1.2 + 1e-4, abs(m.r - 0.5));
    col = mix(col, uCoast, line * uCoastA * (1.0 - m.g) * (1.0 - 0.6 * smoothstep(0.1, 0.5, m.b)));
    col = mix(col, uCoast, max(frame(uAk, vUv), frame(uHi, vUv)) * uCoastA);

    // Atmosphere: distant ground fades into the page color; the frame's edges fade out.
    col = mix(col, uBg, smoothstep(uHaze.x, uHaze.y, length(cameraPosition - vWorld)) * 0.9);
    vec2 e = min(vUv, 1.0 - vUv);
    float fade = smoothstep(0.0, 0.07, min(e.x, e.y * 1.47));
    gl_FragColor = vec4(col, fade * uOpacity);
  }
`;

const srgb = (hex: string) => { const c = new THREE.Color(hex); c.getRGB(c, THREE.SRGBColorSpace); return new THREE.Vector3(c.r, c.g, c.b); };

/** Rough GPU tier: "low" skips the animated water and loads the smaller mask. */
export function gpuTier(renderer: THREE.WebGLRenderer): "low" | "high" {
  try {
    const q = new URLSearchParams(location.search).get("fx");
    if (q === "low" || q === "high") return q;
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|softpipe|software|mali-[34]|adreno \(tm\) [2-4]/i.test(name)) return "low";
    if (renderer.capabilities.maxTextureSize < 4096) return "low";
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (mem !== undefined && mem < 4) return "low";
  } catch {
    return "low";
  }
  return "high";
}

export class GeoGround {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private loaded = false;
  private shown = 0;
  private enabled = true;
  private look: GeoLook | null = null;

  constructor(private animated: boolean, small: boolean, private onLoad: () => void) {
    const x0 = (PX.x0 - CX) * SCALE, z0 = (PX.y0 - CY) * SCALE;
    const w = (PX.x1 - PX.x0) * SCALE, h = (PX.y1 - PX.y0) * SCALE;
    const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    blank.needsUpdate = true;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uFrame: { value: new THREE.Vector4(x0, z0, w, h) },
        uMask: { value: blank }, uDepth: { value: blank }, uRelief: { value: blank },
        uLand: { value: new THREE.Vector3() }, uLandUS: { value: new THREE.Vector3() }, uShallow: { value: new THREE.Vector3() },
        uDeep: { value: new THREE.Vector3() }, uCoast: { value: new THREE.Vector3() }, uBg: { value: new THREE.Vector3() },
        uSun: { value: new THREE.Vector3(-0.45, 0.8, -0.4).normalize() },
        uCoastA: { value: 0 }, uReliefK: { value: 0 }, uShimmer: { value: 0 }, uGlint: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 },
        uHaze: { value: new THREE.Vector2(60, 140) },
        uAk: { value: uvBox(AK_BOX) }, uHi: { value: uvBox(HI_BOX) },
      },
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x0 + w / 2, -0.004, z0 + h / 2);
    this.mesh.renderOrder = -1;
    this.mesh.visible = false;
    this.load(small);
  }

  private load(small: boolean) {
    const base = `${import.meta.env.BASE_URL}geo/`;
    const files = [small ? "mask-2048.png" : "mask-4096.png", "depth-1024.webp", "relief-2048.webp"];
    const loader = new THREE.TextureLoader();
    Promise.all(files.map((f) => loader.loadAsync(base + f))).then((tex) => {
      for (const t of tex) {
        t.flipY = false;
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = 8;
        t.needsUpdate = true;
      }
      [this.mat.uniforms.uMask.value, this.mat.uniforms.uDepth.value, this.mat.uniforms.uRelief.value] = tex;
      this.loaded = true;
      this.mesh.visible = this.enabled;
      this.onLoad();
    }).catch(() => { /* the plain ground stays: the layers are decoration */ });
  }

  get ready() { return this.loaded; }

  setLook(look: GeoLook, bg: string) {
    this.look = look;
    const u = this.mat.uniforms;
    for (const [k, v] of [["uLand", look.land], ["uLandUS", look.landUS], ["uShallow", look.shallow], ["uDeep", look.deep], ["uCoast", look.coast], ["uBg", bg]] as const) {
      (u[k].value as THREE.Vector3).copy(srgb(v));
    }
    u.uCoastA.value = look.coastAlpha;
    u.uReliefK.value = look.relief;
    this.setAnimated(this.animated);
  }

  setAnimated(on: boolean) {
    this.animated = on;
    if (!this.look) return;
    this.mat.uniforms.uShimmer.value = on ? this.look.shimmer : 0;
    this.mat.uniforms.uGlint.value = on ? this.look.glint : 0;
  }

  get isAnimated() { return this.animated && !!this.look && (this.look.shimmer > 0 || this.look.glint > 0); }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.mesh.visible = on && this.loaded;
  }

  /** Per frame: fade in once loaded, advance the water, and scale the haze to the camera's distance from its target. */
  update(time: number, instant: boolean, camDist: number) {
    if (!this.loaded) return;
    this.shown = instant ? 1 : Math.min(1, this.shown + 0.04);
    const u = this.mat.uniforms;
    u.uOpacity.value = this.shown;
    u.uTime.value = this.animated ? time : 0;
    u.uHaze.value.set(camDist * 1.25, camDist * 3.2);
  }

  dispose() {
    this.mesh.geometry.dispose();
    for (const k of ["uMask", "uDepth", "uRelief"]) (this.mat.uniforms[k].value as THREE.Texture).dispose();
    this.mat.dispose();
  }
}
