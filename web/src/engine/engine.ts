import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { geoAlbersUsa } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import usTopo from "us-atlas/states-10m.json";
import { THEMES, type SceneTheme, type ThemeName } from "./theme";
import { GeoGround, gpuTier } from "./geo";

export type ArcSpec = {
  id: number;
  o: number;
  d: number;
  width: number; // 0..1
  lift: number; // 0..1
  color: string;
  alpha: number;
};
// "callout" is a tour stop's takeaway, pinned to the state it is about.
export type Label = { state: number; text: string; tone: "amber" | "teal" | "plain" | "rose" | "sky" | "callout" };
export type Hit = { kind: "state"; state: number } | { kind: "arc"; id: number } | null;

const SCALE = 1 / 48;
const CX = 487.5;
const CY = 305;
const BASE = 0.12;
const WALL_SHADE = 0.72;
const SEGMENTS = 40;
const CAPACITY = 4096;


const ARC_VERT = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  attribute vec3 iStart;
  attribute vec3 iEnd;
  attribute float iLift;
  attribute float iWidth;
  attribute vec3 iColor;
  attribute float iAlpha;
  attribute float iPhase;
  varying float vT;
  varying float vSide;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    vec3 mid = (iStart + iEnd) * 0.5 + vec3(0.0, iLift * 2.0, 0.0);
    float t = aT;
    float u = 1.0 - t;
    vec3 p = u * u * iStart + 2.0 * u * t * mid + t * t * iEnd;
    vec3 tan = 2.0 * u * (mid - iStart) + 2.0 * t * (iEnd - mid);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 tv = (modelViewMatrix * vec4(tan, 0.0)).xyz;
    vec2 side = normalize(vec2(-tv.y, tv.x) + 1e-6);
    float taper = 0.35 + 0.65 * sin(3.14159 * t);
    mv.xy += side * aSide * iWidth * taper;
    gl_Position = projectionMatrix * mv;
    vT = t; vSide = aSide; vColor = iColor; vAlpha = iAlpha; vPhase = iPhase;
  }
`;
const ARC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uBase;
  uniform float uPulse;
  uniform float uDash;
  uniform vec2 uAlphaMix;
  varying float vT;
  varying float vSide;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vPhase;
  void main() {
    float edge = 1.0 - vSide * vSide;
    float f = fract((vT * 2.0 - uTime * 0.18) * uDash * 0.5 + vPhase);
    float pulse = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.08, 0.32, f));
    vec3 c = vColor * (uBase + uPulse * pulse);
    gl_FragColor = vec4(c, vAlpha * edge * (uAlphaMix.x + uAlphaMix.y * pulse));
  }
`;

// Dot field: each state is a grid of dots at its current height; dot size follows the state's value.
// The same geometry drawn a second time with uFloor = 1 lays a faint, fixed-size footprint on the ground,
// so the gap between floor and top reads as height.
const DOT_SPACING = 0.13;
const DOT_VERT = /* glsl */ `
  attribute float aState;
  attribute vec3 aSeed;
  uniform float uSwarm;
  uniform vec4 uA[51];
  uniform float uSz[51];
  uniform float uPx;
  uniform float uFloor;
  uniform float uSized;
  varying vec3 vC;
  void main() {
    int s = int(aState + 0.5);
    vec3 p = position;
    p.y = mix(uA[s].w + 0.015, 0.006, uFloor);
    // First look at a dot field: dots start scattered above the map and settle, staggered (uSwarm 1 to 0).
    float k = clamp(uSwarm * 1.7 - aSeed.y * 0.7, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    p.xz += aSeed.xz * k * 7.0;
    p.y += k * (1.5 + aSeed.y * 5.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * mix(mix(0.78, 0.28 + 0.72 * uSz[s], uSized), 0.2, uFloor) / -mv.z;
    gl_Position = projectionMatrix * mv;
    vC = uA[s].rgb;
  }
`;
const DOT_FRAG = /* glsl */ `
  uniform float uLift;
  uniform float uRim;
  uniform float uAlpha;
  varying vec3 vC;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float m = 1.0 - smoothstep(0.36, 0.5, r);
    if (m < 0.02) discard;
    vec3 c = mix(vC, vec3(1.0), uLift);
    // Optional dark rim: keeps light dots (the high end of cividis) visible on a light ground without changing their fill.
    c = mix(c, c * 0.42, smoothstep(0.24, 0.36, r) * uRim);
    gl_FragColor = vec4(c, m * uAlpha);
  }
`;
// Solid walls: the state's color at 0.72, darkening toward the base, a soft occlusion band where the wall meets the ground,
// and a thin light rim along the wall's top edge (just under the outline). Walls carry no data; the top fill is untouched.
const SIDE_VERT = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying float vZ;
  void main() {
    vZ = position.z;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const SIDE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform float uH, uBase, uAo, uRimA;
  #include <common>
  #include <fog_pars_fragment>
  varying float vZ;
  void main() {
    float y = vZ * uH;
    vec3 c = uColor * mix(uBase, 1.0, vZ) * mix(1.0 - uAo, 1.0, smoothstep(0.0, 0.14, y));
    float px = fwidth(y) + 1e-5;
    c = mix(c, uRim, (1.0 - smoothstep(px * 0.8, px * 2.2, uH - y)) * uRimA);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
// Curtain walls for dot-field states: the extrusion's sides, transparent, fading from the top edge to the ground.
const WALL_VERT = /* glsl */ `
  varying float vZ;
  void main() {
    vZ = position.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const WALL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec2 uAlpha;
  uniform vec3 uRim;
  uniform float uH, uRimA;
  varying float vZ;
  void main() {
    float a = mix(uAlpha.x, uAlpha.y, vZ * vZ);
    float y = vZ * uH, px = fwidth(y) + 1e-5;
    float rim = (1.0 - smoothstep(px * 0.8, px * 2.2, uH - y)) * uRimA;
    gl_FragColor = vec4(mix(uColor, uRim, rim), max(a, rim));
  }
`;

type StateObj = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; sideMat: THREE.ShaderMaterial; caster: THREE.Mesh; wallMat: THREE.ShaderMaterial; line: THREE.LineSegments; lineMat: THREE.LineBasicMaterial; strong: boolean; h: number; target: number; color: THREE.Color; targetColor: THREE.Color; anchor: THREE.Vector3; size: number; sizeTarget: number };

export class FreightScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  readonly controls: OrbitControls;
  private states: StateObj[] = [];
  private arcMesh: THREE.Mesh;
  private arcGeo: THREE.InstancedBufferGeometry;
  private arcMat: THREE.ShaderMaterial;
  private arcs: ArcSpec[] = [];
  private arcPoints: THREE.Vector3[][] = [];
  private labels: Label[] = [];
  private labelEls: HTMLDivElement[] = [];
  private labelSize: { w: number; h: number }[] | null = null;
  private raf = 0;
  private fly: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number; dur: number } | null = null;
  private t0 = performance.now();
  private fixedTime: number | null;
  private home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  // Overlays drawn over the canvas (legend, tour card, tools), in canvas pixels. Home keeps the states clear of them by
  // fitting the map into what is left and shifting the image there (a principal-point offset, in NDC).
  private occluders: { x: number; y: number; w: number; h: number }[] = [];
  private shift = new THREE.Vector2();
  private shiftTo = new THREE.Vector2();
  private atHome = true;
  private inset = new Set<number>();
  private flat = false;
  private lastStates: [number[], string[], boolean[]] | null = null;
  private ro: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private size = { w: 1, h: 1 };
  readonly projected: ([number, number] | null)[];

  private theme: SceneTheme;
  private hemi = new THREE.HemisphereLight();
  private key = new THREE.DirectionalLight();
  private rim = new THREE.DirectionalLight();
  private sun = new THREE.DirectionalLight();
  private groundMat = new THREE.MeshBasicMaterial();
  private shapes: THREE.Shape[][] = [];
  private dots!: THREE.Points;
  private dotMat!: THREE.ShaderMaterial;
  private floor!: THREE.Points;
  private floorMat!: THREE.ShaderMaterial;
  private field = false;
  private swarm: number | null = null;
  // Solid look: wall shading and rim uniforms shared by every state, the shadow plane, and the shadow caster material.
  private solidU = { uBase: { value: 1 }, uAo: { value: 0 }, uRim: { value: new THREE.Color() }, uRimS: { value: new THREE.Color() }, uRimA: { value: 0 } };
  private casterMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private shadowMat = new THREE.ShadowMaterial({ transparent: true, depthWrite: false });
  private shadows = false;
  private solidOn = true;
  private swarmed = false;
  private geo: GeoGround;
  private shadowPlane: THREE.Mesh | null = null;

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLDivElement, centroids: [number, number][], private fips: string[], fixedTime: number | null, theme: ThemeName) {
    this.fixedTime = fixedTime;
    this.theme = THEMES[theme].scene;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    const tier = gpuTier(this.renderer);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === "low" ? 1.5 : 2));
    this.scene.fog = new THREE.Fog("#000000", 34, 70);
    this.key.position.set(-8, 16, 10);
    this.rim.position.set(10, 6, -12);
    this.scene.add(this.hemi, this.key, this.rim);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), this.groundMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    this.scene.add(plane);
    // Land, water and relief around the states (lazy-loaded; the plain ground shows until then and if loading fails).
    const phone = Math.min(screen.width, screen.height) < 600;
    this.geo = new GeoGround(tier === "high" && fixedTime === null, tier === "low" || phone, () => {});
    this.scene.add(this.geo.mesh);
    // Contact shadows from the key light onto a shadow-only plane over the ground and water. Strong GPUs only;
    // phones get a 1024 map. Re-rendered only when a state's height changes.
    this.shadows = tier === "high";
    if (this.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = false;
      // A shadow-only light, high in the northwest like the hillshade, so shadows fall short and toward the viewer.
      // Its intensity is 0: it adds nothing to any surface's lighting, it only drives the shadow plane.
      this.sun.position.set(-6, 20, -6);
      this.sun.intensity = 0;
      this.sun.castShadow = true;
      this.scene.add(this.sun);
      const sh = this.sun.shadow;
      sh.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
      Object.assign(sh.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
      sh.camera.updateProjectionMatrix();
      sh.bias = -0.0008;
      sh.radius = 4;
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), this.shadowMat);
      sp.rotation.x = -Math.PI / 2;
      sp.position.y = -0.002;
      sp.receiveShadow = true;
      sp.renderOrder = 0;
      this.shadowPlane = sp;
      this.scene.add(sp);
    }

    const projection = geoAlbersUsa().scale(1300).translate([CX, CY]);
    this.projected = centroids.map(([lat, lon]) => projection([lon, lat]));
    this.buildStates(projection);
    this.buildField();

    this.arcGeo = this.buildArcGeometry();
    this.arcMat = new THREE.ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: { uTime: { value: 0 }, uBase: { value: 1 }, uPulse: { value: 0 }, uDash: { value: 2 }, uAlphaMix: { value: new THREE.Vector2(0.8, 0.4) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.arcMesh = new THREE.Mesh(this.arcGeo, this.arcMat);
    this.arcMesh.frustumCulled = false;
    this.arcMesh.renderOrder = 2;
    this.scene.add(this.arcMesh);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 80;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("start", () => { this.atHome = false; });
    // Alaska and Hawaii sit in insets far from the mainland in projected space.
    fips.forEach((f, i) => { if (f === "02" || f === "15") this.inset.add(i); });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.setTheme(theme);
    this.resize();
    this.setHome();
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.target);
    this.loop();
  }

  setTheme(name: ThemeName) {
    const t = (this.theme = THEMES[name].scene);
    this.renderer.setClearColor(t.bg);
    this.renderer.toneMapping = t.toneMapped ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(t.bg);
    [fog.near, fog.far] = t.fog;
    this.hemi.color.set(t.hemi[0]);
    this.hemi.groundColor.set(t.hemi[1]);
    this.hemi.intensity = t.hemi[2];
    this.key.color.set(t.key[0]);
    this.key.intensity = t.key[1];
    this.rim.color.set(t.rim[0]);
    this.rim.intensity = t.rim[1];
    this.groundMat.map?.dispose();
    this.groundMat.map = this.groundTexture(t);
    this.geo.setLook(t.geo, t.bg);
    this.arcMat.blending = t.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.arcMat.uniforms.uBase.value = t.arcBase;
    this.arcMat.uniforms.uPulse.value = t.arcPulse;
    this.arcMat.uniforms.uDash.value = t.arcDash ?? 2;
    this.arcMat.uniforms.uAlphaMix.value.set(...(t.arcAlpha ?? [0.8, 0.4]));
    const wasField = this.field;
    this.field = !!t.field;
    if (this.field && !wasField && this.raf) this.startSwarm();
    this.dots.visible = this.field;
    this.dotMat.uniforms.uLift.value = t.dotLift ?? 0;
    this.dotMat.uniforms.uSized.value = t.dotSized === false ? 0 : 1;
    this.dotMat.uniforms.uRim.value = this.floorMat.uniforms.uRim.value = t.dotRim ?? 0;
    this.floorMat.uniforms.uAlpha.value = t.floorDots ?? 0;
    this.floor.visible = this.field && (t.floorDots ?? 0) > 0;
    const blend = t.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    for (const s of this.states) {
      s.mat.visible = s.sideMat.visible = !this.field;
      // Dot-field states keep a vertical cue: transparent curtain walls instead of the solid sides.
      s.mesh.material = [s.mat, this.field && t.walls ? s.wallMat : s.sideMat];
      s.wallMat.uniforms.uAlpha.value.set(...(t.walls ?? [0, 0]));
      s.wallMat.blending = blend;
      s.mat.roughness = t.roughness;
      s.lineMat.color.set(t.edge);
      s.lineMat.opacity = s.strong ? t.edgeStrong : t.edgeOpacity;
    }
    this.applySolid();
    for (const m of [this.groundMat, this.arcMat, this.dotMat, this.floorMat, ...this.states.flatMap((s) => [s.mat, s.lineMat, s.wallMat])]) m.needsUpdate = true;
    this.setArcs(this.arcs);
  }

  private groundTexture(t: SceneTheme): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    const grad = x.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, t.ground[0]);
    grad.addColorStop(0.55, t.ground[1]);
    grad.addColorStop(1, t.ground[2]);
    x.fillStyle = grad;
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = t.grid;
    for (let i = 0; i <= 512; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private toWorld(x: number, y: number, h = 0) {
    return new THREE.Vector3((x - CX) * SCALE, h, (y - CY) * SCALE);
  }

  private buildStates(projection: ReturnType<typeof geoAlbersUsa>) {
    const topo = usTopo as unknown as Topology<{ states: GeometryCollection }>;
    const fc = feature(topo, topo.objects.states) as unknown as { features: Feature<Polygon | MultiPolygon>[] };
    const byFips = new Map<string, Feature<Polygon | MultiPolygon>>();
    for (const f of fc.features) byFips.set(String(f.id), f);
    const fips = this.fips;
    fips.forEach((_, i) => {
      const f = byFips.get(fips[i]);
      const shapes: THREE.Shape[] = [];
      const edges: number[] = [];
      if (f) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const poly of polys) {
          const rings = poly.map((ring) => ring.map((p) => projection(p as [number, number])).filter((p): p is [number, number] => !!p))
            .filter((r) => r.length >= 4);
          if (!rings.length) continue;
          const toV = (r: [number, number][]) => r.map(([x, y]) => new THREE.Vector2((x - CX) * SCALE, -(y - CY) * SCALE));
          const shape = new THREE.Shape(toV(rings[0]));
          for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(toV(hole)));
          shapes.push(shape);
          for (const r of rings) {
            const v = toV(r);
            for (let k = 0; k < v.length - 1; k++) edges.push(v[k].x, v[k].y, 1.002, v[k + 1].x, v[k + 1].y, 1.002);
          }
        }
      }
      this.shapes[i] = shapes;
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
      const mat = new THREE.MeshStandardMaterial({ color: "#808080", roughness: 0.85, metalness: 0.08, emissive: "#000000" });
      // Walls are unlit: border polylines have thousands of tiny facets, and lighting each one striped the walls.
      const look = this.solidU;
      const sideMat = new THREE.ShaderMaterial({
        vertexShader: SIDE_VERT,
        fragmentShader: SIDE_FRAG,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uColor: { value: new THREE.Color("#606060") }, uH: { value: BASE }, uBase: look.uBase, uAo: look.uAo, uRim: look.uRim, uRimA: look.uRimA },
        fog: true,
      });
      const wallMat = new THREE.ShaderMaterial({
        vertexShader: WALL_VERT,
        fragmentShader: WALL_FRAG,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: new THREE.Vector2() }, uH: { value: BASE }, uRim: look.uRimS, uRimA: look.uRimA },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, [mat, sideMat]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.z = BASE;
      mesh.userData.state = i;
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
      const lineMat = new THREE.LineBasicMaterial({ color: "#808080", transparent: true, opacity: 0.4 });
      const line = new THREE.LineSegments(lg, lineMat);
      mesh.add(line);
      // Shadow caster: the same prism, writing no color or depth in the main pass, so dot fields cast the solid volume's
      // shadow too. States never receive shadows; only the ground's shadow plane does.
      const caster = new THREE.Mesh(geo, this.casterMat);
      caster.castShadow = true;
      mesh.add(caster);
      this.scene.add(mesh);
      const p = this.projected[i] ?? [CX, CY];
      this.states.push({ mesh, mat, sideMat, caster, wallMat, line, lineMat, h: BASE, target: BASE, strong: false, color: new THREE.Color("#808080"), targetColor: new THREE.Color("#808080"), anchor: this.toWorld(p[0], p[1]), size: 0, sizeTarget: 0 });
    });
  }

  private buildField() {
    const pos: number[] = [];
    const st: number[] = [];
    this.shapes.forEach((shapes, i) => {
      let n = 0;
      for (const shape of shapes) {
        const { shape: outer, holes } = shape.extractPoints(1);
        const box = new THREE.Box2().setFromPoints(outer);
        const x0 = Math.ceil(box.min.x / DOT_SPACING) * DOT_SPACING, y0 = Math.ceil(box.min.y / DOT_SPACING) * DOT_SPACING;
        for (let x = x0; x <= box.max.x; x += DOT_SPACING) {
          for (let y = y0; y <= box.max.y; y += DOT_SPACING) {
            if (!inside(x, y, outer) || holes.some((h) => inside(x, y, h))) continue;
            pos.push(x, 0, -y); st.push(i); n++;
          }
        }
      }
      if (!n && this.states[i]) { const a = this.states[i].anchor; pos.push(a.x, 0, a.z); st.push(i); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aState", new THREE.Float32BufferAttribute(st, 1));
    const seed = new Float32Array(st.length * 3);
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < st.length; k++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      seed.set([Math.cos(a) * d, rnd(), Math.sin(a) * d], k * 3);
    }
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 3));
    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: {
        uA: { value: Array.from({ length: 51 }, () => new THREE.Vector4()) },
        uSz: { value: new Array(51).fill(0) },
        uPx: { value: 1 },
        uLift: { value: 0.12 },
        uRim: { value: 0 },
        uAlpha: { value: 1 },
        uFloor: { value: 0 },
        uSized: { value: 1 },
        uSwarm: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.dots = new THREE.Points(g, this.dotMat);
    this.dots.frustumCulled = false;
    this.dots.visible = false;
    this.dots.renderOrder = 1;
    this.scene.add(this.dots);
    // Footprint: same dots on the ground, sharing the per-state uniforms.
    const u = this.dotMat.uniforms;
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: { uA: u.uA, uSz: u.uSz, uPx: u.uPx, uLift: u.uLift, uRim: { value: 0 }, uAlpha: { value: 0 }, uFloor: { value: 1 }, uSized: u.uSized, uSwarm: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.floor = new THREE.Points(g, this.floorMat);
    this.floor.frustumCulled = false;
    this.floor.visible = false;
    this.scene.add(this.floor);
  }

  private buildArcGeometry(): THREE.InstancedBufferGeometry {
    const g = new THREE.InstancedBufferGeometry();
    const t: number[] = [];
    const side: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      t.push(i / SEGMENTS, i / SEGMENTS);
      side.push(-1, 1);
      if (i < SEGMENTS) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(t.length * 3).fill(0), 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    g.setIndex(idx);
    const f = (k: number) => new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * k), k).setUsage(THREE.DynamicDrawUsage);
    for (const [name, k] of [["iStart", 3], ["iEnd", 3], ["iLift", 1], ["iWidth", 1], ["iColor", 3], ["iAlpha", 1], ["iPhase", 1]] as const) {
      g.setAttribute(name, f(k));
    }
    g.instanceCount = 0;
    return g;
  }

  stateTop(i: number): THREE.Vector3 {
    const s = this.states[i];
    return s.anchor.clone().setY(s.h + 0.02);
  }

  private arcEnds(a: ArcSpec) {
    return [this.stateTop(a.o), this.stateTop(a.d)];
  }

  private liftOf(a: ArcSpec, p0: THREE.Vector3, p1: THREE.Vector3) {
    // An inset endpoint's distance is an artifact of the layout: cap the lift so the arc stays in frame near the inset.
    if (this.inset.has(a.o) || this.inset.has(a.d)) return 0.3 + Math.min(p0.distanceTo(p1), 4) * 0.12 + a.lift * 0.5;
    return 0.35 + p0.distanceTo(p1) * 0.16 + a.lift * 1.6;
  }

  setArcs(arcs: ArcSpec[]) {
    this.arcs = arcs.slice(0, CAPACITY);
    const attr = (name: string) => this.arcGeo.getAttribute(name) as THREE.InstancedBufferAttribute;
    const start = attr("iStart"), end = attr("iEnd"), lift = attr("iLift"), width = attr("iWidth");
    const color = attr("iColor"), alpha = attr("iAlpha"), phase = attr("iPhase");
    const c = new THREE.Color();
    this.arcs.forEach((a, i) => {
      const [p0, p1] = this.arcEnds(a);
      start.setXYZ(i, p0.x, p0.y, p0.z);
      end.setXYZ(i, p1.x, p1.y, p1.z);
      lift.setX(i, this.liftOf(a, p0, p1));
      width.setX(i, (0.012 + a.width * 0.11) * this.theme.arcWidth);
      c.set(a.color);
      if (this.theme.arcSrgb) c.getRGB(c, THREE.SRGBColorSpace);
      color.setXYZ(i, c.r, c.g, c.b);
      alpha.setX(i, a.alpha);
      phase.setX(i, ((a.o * 37 + a.d * 11) % 100) / 100);
    });
    for (const a of [start, end, lift, width, color, alpha, phase]) a.needsUpdate = true;
    this.arcGeo.instanceCount = this.arcs.length;
    this.refreshArcPoints();
  }

  private refreshArcPoints() {
    this.arcPoints = this.arcs.map((a) => {
      const [p0, p1] = this.arcEnds(a);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      mid.y += this.liftOf(a, p0, p1) * 2;
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
      return curve.getPoints(18);
    });
  }

  private syncArcEnds() {
    const start = this.arcGeo.getAttribute("iStart") as THREE.InstancedBufferAttribute;
    const end = this.arcGeo.getAttribute("iEnd") as THREE.InstancedBufferAttribute;
    const lift = this.arcGeo.getAttribute("iLift") as THREE.InstancedBufferAttribute;
    this.arcs.forEach((a, i) => {
      const [p0, p1] = this.arcEnds(a);
      start.setXYZ(i, p0.x, p0.y, p0.z);
      end.setXYZ(i, p1.x, p1.y, p1.z);
      lift.setX(i, this.liftOf(a, p0, p1));
    });
    start.needsUpdate = end.needsUpdate = lift.needsUpdate = true;
  }

  /** Per-frame easing toward new heights and colors; the tour slows it so GDP visibly morphs into trade prestige. */
  private ease = 0.12;
  setStates(heights: number[], colors: string[], strong: boolean[], ease = 0.12) {
    this.ease = ease;
    this.lastStates = [heights, colors, strong];
    this.states.forEach((s, i) => {
      s.target = BASE + (this.flat ? 0 : Math.max(0, heights[i] ?? 0) * 3.2);
      s.targetColor.set(colors[i]);
      s.sizeTarget = Math.min(1, Math.max(0, heights[i] ?? 0));
      s.strong = !!strong[i];
      s.lineMat.opacity = s.strong ? this.theme.edgeStrong : this.theme.edgeOpacity;
    });
  }

  setLabels(labels: Label[]) {
    this.labels = labels;
    while (this.labelEls.length < labels.length) {
      const el = document.createElement("div");
      el.className = "map-label";
      this.overlay.appendChild(el);
      this.labelEls.push(el);
    }
    this.labelEls.forEach((el, i) => {
      const l = labels[i];
      el.style.display = l ? "block" : "none";
      if (l) {
        // A new callout replays its entrance, so each stop's takeaway arrives with the map's move.
        if (l.tone === "callout" && (el.textContent !== l.text || el.dataset.tone !== "callout")) {
          el.style.animation = "none";
          void el.offsetWidth;
          el.style.animation = "";
        }
        el.textContent = l.text;
        el.dataset.tone = l.tone;
      }
    });
    this.labelSize = null;
  }

  /** Home view: the nearest camera, at a fixed angle, that keeps every state (Alaska and Hawaii included) in frame. */
  private setHome() {
    const box = new THREE.Box3();
    for (const s of this.states) { s.mesh.updateMatrixWorld(); box.expandByObject(s.mesh); }
    if (box.isEmpty()) box.set(new THREE.Vector3(-12, 0, -8), new THREE.Vector3(12, 1, 8));
    box.min.y = 0;
    box.max.y = BASE + 1;
    const target = box.getCenter(new THREE.Vector3()).setY(0);
    const dir = this.flat ? new THREE.Vector3(0, 0.98, 0.01) : new THREE.Vector3(0, 0.82, 0.56);
    const cam = this.camera.clone();
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => new THREE.Vector3(
      k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z));
    cam.updateProjectionMatrix();
    const { w, h } = this.size;
    const pad = 8;
    const occ = this.occluders.map((r) => ({
      x0: ((r.x - pad) / w) * 2 - 1, x1: ((r.x + r.w + pad) / w) * 2 - 1,
      y0: 1 - ((r.y + r.h + pad) / h) * 2, y1: 1 - ((r.y - pad) / h) * 2,
    }));
    const boxes = occ.length ? this.states.map((s) => new THREE.Box3().setFromObject(s.mesh)) : [];
    // Shifts to try, nearest the centre first.
    const grid: THREE.Vector2[] = [];
    if (occ.length) for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) grid.push(new THREE.Vector2(i * 0.05, j * 0.05));
    grid.sort((a, b) => a.lengthSq() - b.lengthSq());
    const v = new THREE.Vector3();
    const fits = (d: number): THREE.Vector2 | null => {
      cam.position.copy(target).addScaledVector(dir, d);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const pts = corners.map((c) => v.copy(c).project(cam).clone());
      if (pts.some((p) => p.z >= 1)) return null;
      if (!occ.length) return pts.every((p) => Math.abs(p.x) < 0.97 && Math.abs(p.y) < 0.9) ? new THREE.Vector2() : null;
      const rects = boxes.map((b) => {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).project(cam);
          x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
        }
        return { x0, x1, y0, y1 };
      });
      const bx0 = Math.min(...pts.map((p) => p.x)), bx1 = Math.max(...pts.map((p) => p.x));
      const by0 = Math.min(...pts.map((p) => p.y)), by1 = Math.max(...pts.map((p) => p.y));
      return grid.find((s) =>
        bx0 + s.x > -0.97 && bx1 + s.x < 0.97 && by0 + s.y > -0.9 && by1 + s.y < 0.9 &&
        rects.every((r) => occ.every((o) => r.x1 + s.x <= o.x0 || r.x0 + s.x >= o.x1 || r.y1 + s.y <= o.y0 || r.y0 + s.y >= o.y1))) ?? null;
    };
    let lo = 6, hi = 80;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    this.shiftTo.copy(fits(hi) ?? new THREE.Vector2());
    if (this.fixedTime !== null) { this.shift.copy(this.shiftTo); this.applyShift(); }
    this.home.target.copy(target);
    this.home.pos.copy(target).addScaledVector(dir, hi);
  }

  /** Overlays covering parts of the canvas, in canvas pixels. Home is refit around them; at home, the camera follows. */
  setOccluders(rects: { x: number; y: number; w: number; h: number }[]) {
    const r = rects.filter((o) => o.w > 0 && o.h > 0).map((o) => ({ x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.w), h: Math.round(o.h) }));
    if (JSON.stringify(r) === JSON.stringify(this.occluders)) return;
    this.occluders = r;
    if (this.atHome) this.flyHome(this.fly ? Math.max(500, this.fly.dur - (performance.now() - this.fly.start)) : 700);
    else this.setHome();
  }

  /** Shift the image so the camera's target lands at the centre of the uncovered part of the canvas. */
  private applyShift() {
    this.camera.updateProjectionMatrix();
    const e = this.camera.projectionMatrix.elements;
    e[8] = -this.shift.x;
    e[9] = -this.shift.y;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  /** For checks: hide or show the dot-field curtain walls, to confirm they add a visible vertical cue. */
  setWallsVisible(v: boolean) {
    for (const s of this.states) s.wallMat.visible = v;
  }

  private applySolid() {
    const t = this.theme.solid, on = this.solidOn, u = this.solidU;
    u.uBase.value = on ? t.base : 1;
    u.uAo.value = on ? t.ao : 0;
    u.uRim.value.set(t.rim);
    u.uRimS.value.copy(u.uRim.value).convertLinearToSRGB();
    u.uRimA.value = on ? t.rimAlpha : 0;
    this.shadowMat.opacity = this.field ? t.shadow * 0.7 : t.shadow;
    if (this.shadowPlane) this.shadowPlane.visible = on;
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** For checks and comparisons: switch the solid look (contact shadows, wall shading, edge rim) on or off. */
  setSolidVisible(v: boolean) {
    this.solidOn = v;
    this.applySolid();
  }

  /** For checks: hide or show the flow arcs, so state tops can be sampled where the arcs meet them. */
  setArcsVisible(v: boolean) {
    this.arcMesh.visible = v;
  }

  /** For checks and comparisons: hide or show the ground layers (land, water, relief). */
  setGeoVisible(v: boolean) {
    this.geo.setEnabled(v);
  }

  geoState() {
    return { ready: this.geo.ready, animated: this.geo.isAnimated, swarmed: this.swarmed, shadows: this.shadows };
  }

  /** Flat 2-D reading: top-down camera, no extrusion, rotation locked to the map plane. */
  setFlat(flat: boolean) {
    if (flat === this.flat) return;
    this.flat = flat;
    this.controls.maxPolarAngle = flat ? 0.001 : Math.PI * 0.46;
    this.controls.enableRotate = !flat;
    if (this.lastStates) this.setStates(...this.lastStates);
    this.flyHome(700);
  }

  flyHome(dur = 1400) {
    this.atHome = true;
    this.setHome();
    this.flyTo(this.home.pos.clone(), this.home.target.clone(), dur);
  }

  /** Dots swarm into place: once per page, the first time a dot field is shown, never with motion reduced. */
  private startSwarm() {
    if (this.swarmed || this.fixedTime !== null) return;
    this.swarmed = true;
    this.swarm = performance.now();
    this.dotMat.uniforms.uSwarm.value = 1;
  }

  /** Opening move on a first visit: start high and turned, settle on the home view. */
  introFlight(dur = 2800) {
    this.atHome = true;
    this.setHome();
    if (this.fixedTime !== null) return this.flyHome(0);
    const off = this.home.pos.clone().sub(this.home.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6).multiplyScalar(1.9);
    this.camera.position.copy(this.home.target).add(off);
    this.controls.target.copy(this.home.target);
    this.flyTo(this.home.pos.clone(), this.home.target.clone(), dur);
    if (this.field) this.startSwarm();
  }

  flyToStates(states: number[], dur = 1600) {
    if (!states.length) return;
    this.atHome = false;
    const pts = states.map((s) => this.stateTop(s));
    const box = new THREE.Box3().setFromPoints(pts);
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 2.5);
    const narrow = this.size.w < 640;
    const dist = Math.min(30, Math.max(narrow ? 16 : 12, span * (narrow ? 3.1 : 2.1) + 6));
    const dir = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (dir.length() < 0.1) dir.set(0, 0, 1);
    dir.normalize();
    const pos = this.flat
      ? center.clone().setY(dist * 0.95).setZ(center.z + 0.01)
      : center.clone().add(dir.multiplyScalar(dist * 0.62)).setY(dist * 0.78);
    this.flyTo(pos, center.setY(0.3), dur);
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    if (this.fixedTime !== null) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.fly = null;
      return;
    }
    this.fly = { from: this.camera.position.clone(), to: pos, tFrom: this.controls.target.clone(), tTo: target, start: performance.now(), dur };
  }

  /** Nearest arc under the pointer, else the state; with statesOnly, the state under the arcs. */
  pick(clientX: number, clientY: number, statesOnly = false): Hit {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    let best = -1;
    let bestD = 9;
    const v = new THREE.Vector3();
    if (!statesOnly) this.arcPoints.forEach((pts, i) => {
      if (this.arcs[i].alpha < 0.08) return;
      let px = 0, py = 0;
      pts.forEach((p, k) => {
        v.copy(p).project(this.camera);
        const x = (v.x * 0.5 + 0.5) * rect.width;
        const y = (-v.y * 0.5 + 0.5) * rect.height;
        if (k > 0) {
          const d = segDist(mx, my, px, py, x, y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        px = x; py = y;
      });
    });
    if (best >= 0) return { kind: "arc", id: this.arcs[best].id };
    this.ndc.set((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.states.map((s) => s.mesh), false)[0];
    return hit ? { kind: "state", state: hit.object.userData.state as number } : null;
  }

  // Screen position (CSS pixels, page coordinates) of an arc's apex or a state's top, for checks.
  arcApex(id: number): { x: number; y: number } | null {
    const i = this.arcs.findIndex((a) => a.id === id);
    if (i < 0) return null;
    return this.toScreen(this.arcPoints[i][9]);
  }

  stateScreen(state: number): { x: number; y: number } {
    return this.toScreen(this.stateTop(state));
  }

  private toScreen(p: THREE.Vector3) {
    const rect = this.canvas.getBoundingClientRect();
    const v = p.clone().project(this.camera);
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyShift();
    const px = h * this.renderer.getPixelRatio();
    this.dotMat.uniforms.uPx.value = (px / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)))) * DOT_SPACING * 0.95;
    this.setHome();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.fly) {
      const k = Math.min(1, (now - this.fly.start) / this.fly.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.fly.from, this.fly.to, e);
      this.controls.target.lerpVectors(this.fly.tFrom, this.fly.tTo, e);
      if (k >= 1) this.fly = null;
    }
    if (this.swarm !== null) {
      const k = Math.min(1, (now - this.swarm) / 2600);
      this.dotMat.uniforms.uSwarm.value = Math.pow(1 - k, 2.2);
      if (k >= 1) this.swarm = null;
    }
    let moved = false;
    for (const s of this.states) {
      const settle = this.fixedTime !== null ? 1 : this.ease;
      if (Math.abs(s.h - s.target) > 1e-4) {
        s.h += (s.target - s.h) * settle;
        s.mesh.scale.z = s.h;
        moved = true;
      }
      s.color.lerp(s.targetColor, settle);
      s.mat.color.copy(s.color);
      (s.sideMat.uniforms.uColor.value as THREE.Color).copy(s.color).multiplyScalar(WALL_SHADE);
      s.sideMat.uniforms.uH.value = s.wallMat.uniforms.uH.value = s.h;
      s.size += (s.sizeTarget - s.size) * settle;
    }
    if (this.field) {
      const A = this.dotMat.uniforms.uA.value as THREE.Vector4[], Z = this.dotMat.uniforms.uSz.value as number[];
      const c = new THREE.Color();
      this.states.forEach((s, i) => {
        c.copy(s.color).convertLinearToSRGB();
        A[i].set(c.r, c.g, c.b, s.h);
        Z[i] = s.size;
        (s.wallMat.uniforms.uColor.value as THREE.Color).copy(c);
      });
    }
    if (moved) {
      this.renderer.shadowMap.needsUpdate = true;
      this.syncArcEnds();
      this.refreshArcPoints();
    }
    if (this.shift.distanceToSquared(this.shiftTo) > 1e-8) {
      if (this.fixedTime !== null) this.shift.copy(this.shiftTo);
      else this.shift.lerp(this.shiftTo, 0.08);
      this.applyShift();
    }
    this.controls.update();
    this.arcMat.uniforms.uTime.value = this.fixedTime ?? (now - this.t0) / 1000;
    this.geo.update((now - this.t0) / 1000, this.fixedTime !== null, this.camera.position.distanceTo(this.controls.target));
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  // Labels come in priority order; one that would overlap an earlier visible label is hidden.
  private placeLabels() {
    const v = new THREE.Vector3();
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    // Measured once per label change, before any transform is written this frame.
    this.labelSize ??= this.labelEls.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
    this.labels.forEach((l, i) => {
      const el = this.labelEls[i];
      v.copy(this.stateTop(l.state)).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * this.size.w;
      const y = (-v.y * 0.5 + 0.5) * this.size.h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -130%)`;
      const { w: bw, h: bh } = this.labelSize![i];
      const r = { x0: x - bw / 2, x1: x + bw / 2, y0: y - bh * 1.3, y1: y - bh * 0.3 };
      const clear = !placed.some((p) => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
      const show = v.z < 1 && clear;
      if (show) placed.push(r);
      el.style.visibility = show ? "visible" : "hidden";
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.geo.dispose();
    this.renderer.dispose();
    this.labelEls.forEach((el) => el.remove());
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inside(x: number, y: number, ring: THREE.Vector2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
