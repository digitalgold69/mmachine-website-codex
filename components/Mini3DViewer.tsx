"use client";

/**
 * Mini3DViewer — three.js interactive Classic Mini.
 *
 * Loads /public/models/mini.glb, rotates so the grille lands at +X, scales
 * to length 3.0, drops onto ground.
 *
 * EXTERIOR click zones are invisible AABB volumes used only for raycaster
 * hit detection — the highlight itself is painted by a shader injection on
 * the body material so only the actual car surface within the zone goes
 * the brand accent colour. Four circular cut-outs carve wheel arches out of the highlight.
 *
 * INTERIOR / chassis sections use a visible overlay group (subframes,
 * bulkheads, floor pans, inner wings, toeboard). Mode toggle fades the
 * body to X-ray in Interior mode.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { getSection, sections } from "@/lib/mini-data";

type Props = {
  selectedSection: string;
  onSelect: (code: string) => void;
};

type Mode = "exterior" | "interior";

// Default camera (driver-side front 3/4).
const DEFAULT_VIEW: [number, number, number] = [Math.PI * 0.28, Math.PI * 0.42, 6.2];

// ---------------------------------------------------------------------------
// EXTERIOR click zones — AABB + expected surface normal direction.
// Car is normalised to length 3.0 along X, grille at +X, driver side at +Z.
// ---------------------------------------------------------------------------
type ZoneDef = {
  code: string;
  label: string;
  box: [number, number, number, number, number, number]; // xmin,ymin,zmin,xmax,ymax,zmax
  normal: [number, number, number];
  normalTol?: number;
  shape?: number;
};

const MAX_HIGHLIGHT_ZONES = 8;
// Keep the model URL versioned because /models/* is intentionally cached long-term.
const MINI_MODEL_URL = "/models/mini.glb?v=c656145df084";

const EXTERIOR_ZONES: ZoneDef[] = [
  // Grille face — faces forward (±X)
  { code: "170", label: "Front panel",       box: [ 1.33, 0.24, -0.62,  1.52, 0.82,  0.62], normal: [ 1, 0, 0], normalTol: 0.18 },
  // Bonnet top — faces up
  { code: "160", label: "Bonnet",            box: [ 0.58, 0.72, -0.56,  1.31, 1.02,  0.56], normal: [ 0, 1, 0], normalTol: 0.28 },
  // Traveller roof — faces up
  { code: "160", label: "Roof",              box: [-1.28, 1.10, -0.54,  0.60, 1.40,  0.54], normal: [ 0, 1, 0], normalTol: 0.34 },
  // Side panels use shader-side shaped masks, not plain box paint.
  { code: "130", label: "Front wing (L)",    box: [ 0.72, 0.25, -0.76,  1.50, 0.88, -0.45], normal: [ 0, 0, 1], normalTol: 0.48, shape: 1 },
  { code: "130", label: "Front wing (R)",    box: [ 0.72, 0.25,  0.45,  1.50, 0.88,  0.76], normal: [ 0, 0, 1], normalTol: 0.48, shape: 1 },
  // Door L/R
  { code: "150", label: "Door (L)",          box: [-0.08, 0.22, -0.76,  1.04, 0.81, -0.45], normal: [ 0, 0, 1], normalTol: 0.58, shape: 2 },
  { code: "150", label: "Door (R)",          box: [-0.08, 0.22,  0.45,  1.04, 0.81,  0.76], normal: [ 0, 0, 1], normalTol: 0.58, shape: 2 },
  // Quarter panel L/R
  { code: "140", label: "Quarter panel (L)", box: [-1.48, 0.22, -0.76, -0.15, 0.82, -0.45], normal: [ 0, 0, 1], normalTol: 0.58, shape: 3 },
  { code: "140", label: "Quarter panel (R)", box: [-1.48, 0.22,  0.45, -0.15, 0.82,  0.76], normal: [ 0, 0, 1], normalTol: 0.58, shape: 3 },
  // Rear panel — faces backward
  { code: "120", label: "Rear panel",        box: [-1.53, 0.24, -0.62, -1.31, 0.88,  0.62], normal: [ 1, 0, 0], normalTol: 0.18 },
];

const INTERIOR_CODES = new Set([
  "210", "220", "230", "310", "320", "330", "340", "350",
  "410", "420", "430", "510",
]);

// Wheel-arch cutouts (carve circular holes from the highlight).
// Format: [x, y, z, radius].
const WHEEL_ARCHES: [number, number, number, number][] = [
  [ 1.02, 0.27, -0.59, 0.33],
  [ 1.02, 0.27,  0.59, 0.33],
  [-0.90, 0.27, -0.59, 0.33],
  [-0.90, 0.27,  0.59, 0.33],
];

// ---------------------------------------------------------------------------

export default function Mini3DViewer({ selectedSection, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const modeRef = useRef<Mode>("exterior");
  const applyModeRef = useRef<((mode: Mode) => void) | null>(null);
  const highlightCodeRef = useRef<((code: string) => void) | null>(null);
  const clearHighlightRef = useRef<(() => void) | null>(null);

  const [mode, setMode] = useState<Mode>("exterior");
  const [modelStatus, setModelStatus] = useState<"loading" | "placeholder" | "loaded">("loading");
  const [hovered, setHovered] = useState<{ code: string; label: string; x: number; y: number } | null>(null);

  // Section chip / model click → mode and highlight sync.
  useEffect(() => {
    if (selectedSection === "all") {
      clearHighlightRef.current?.();
      return;
    }

    const nextMode = INTERIOR_CODES.has(selectedSection) ? "interior" : "exterior";
    modeRef.current = nextMode;
    setMode(nextMode);
    applyModeRef.current?.(nextMode);
    highlightCodeRef.current?.(selectedSection);
  }, [selectedSection]);

  useEffect(() => {
    modeRef.current = mode;
    applyModeRef.current?.(mode);
  }, [mode]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    // --- Scene --------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#F5EFE0");

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    setCameraFromSpherical(camera, DEFAULT_VIEW);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    // --- Lighting -----------------------------------------------------------
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dfca, 0.75));

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(4, 7, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff3d8, 0.7);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(0, 4, -6);
    scene.add(rim);

    // --- Ground -------------------------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12, 32),
      new THREE.ShadowMaterial({ opacity: 0.3 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 32),
      new THREE.MeshStandardMaterial({ color: 0xe8dfca, roughness: 1, metalness: 0 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.002;
    scene.add(pad);

    // --- Controls -----------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.0;
    controls.maxDistance = 12.0;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 0.6, 0);
    controls.autoRotate = false;
    renderer.domElement.style.touchAction = "pan-y";
    controls.update();
    controlsRef.current = controls;
    controls.addEventListener("start", () => wakeRender(900));
    controls.addEventListener("change", () => wakeRender(450));
    controls.addEventListener("end", () => wakeRender(650));

    // --- Car container ------------------------------------------------------
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // --- Body highlight uniforms (shader-injected paint on body) -----------
    const wheelVec4s = WHEEL_ARCHES.map(
      ([wx, wy, wz, wr]) => new THREE.Vector4(wx, wy, wz, wr)
    );
    const highlightUniforms = {
      uZoneMins: { value: Array.from({ length: MAX_HIGHLIGHT_ZONES }, () => new THREE.Vector3(0, 0, 0)) },
      uZoneMaxs: { value: Array.from({ length: MAX_HIGHLIGHT_ZONES }, () => new THREE.Vector3(0, 0, 0)) },
      uZoneNormals: { value: Array.from({ length: MAX_HIGHLIGHT_ZONES }, () => new THREE.Vector3(0, 1, 0)) },
      uZoneTols: { value: Array.from({ length: MAX_HIGHLIGHT_ZONES }, () => 0.45) },
      uZoneShapes: { value: Array.from({ length: MAX_HIGHLIGHT_ZONES }, () => 0) },
      uZoneCount: { value: 0 },
      uWheelArches: { value: wheelVec4s },
      uWheelZTol: { value: 0.46 },
    };

    const injectHighlightShader = (mat: THREE.Material) => {
      const std = mat as THREE.MeshStandardMaterial;
      if (!("onBeforeCompile" in std)) return;
      std.onBeforeCompile = (shader) => {
        shader.uniforms.uZoneMins = highlightUniforms.uZoneMins;
        shader.uniforms.uZoneMaxs = highlightUniforms.uZoneMaxs;
        shader.uniforms.uZoneNormals = highlightUniforms.uZoneNormals;
        shader.uniforms.uZoneTols = highlightUniforms.uZoneTols;
        shader.uniforms.uZoneShapes = highlightUniforms.uZoneShapes;
        shader.uniforms.uZoneCount = highlightUniforms.uZoneCount;
        shader.uniforms.uWheelArches = highlightUniforms.uWheelArches;
        shader.uniforms.uWheelZTol = highlightUniforms.uWheelZTol;

        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             varying vec3 vCarPos;
             varying vec3 vCarNormal;`
          )
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
             vCarPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
             vCarNormal = normalize(mat3(modelMatrix) * objectNormal);`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform vec3 uZoneMins[${MAX_HIGHLIGHT_ZONES}];
             uniform vec3 uZoneMaxs[${MAX_HIGHLIGHT_ZONES}];
             uniform vec3 uZoneNormals[${MAX_HIGHLIGHT_ZONES}];
             uniform float uZoneTols[${MAX_HIGHLIGHT_ZONES}];
             uniform float uZoneShapes[${MAX_HIGHLIGHT_ZONES}];
             uniform float uZoneCount;
             uniform vec4 uWheelArches[4];
             uniform float uWheelZTol;
             varying vec3 vCarPos;
             varying vec3 vCarNormal;
             float insideBox(vec3 p, vec3 lo, vec3 hi) {
               vec3 a = step(lo, p);
               vec3 b = step(p, hi);
               return a.x * a.y * a.z * b.x * b.y * b.z;
             }
             float aboveLine(vec2 p, vec2 a, vec2 b) {
               vec2 ab = b - a;
               vec2 ap = p - a;
               return step(0.0, ab.x * ap.y - ab.y * ap.x);
             }
             float belowLine(vec2 p, vec2 a, vec2 b) {
               return 1.0 - aboveLine(p, a, b);
             }
             float outsideEllipse(vec2 p, vec2 c, vec2 r) {
               vec2 q = (p - c) / r;
               return step(1.0, dot(q, q));
             }
             float inAnyArch(vec3 p) {
               for (int i = 0; i < 4; i++) {
                 vec4 w = uWheelArches[i];
                 float d = length(p.xy - w.xy);
                 if (d < w.w && abs(p.z - w.z) < uWheelZTol) return 1.0;
               }
               return 0.0;
             }
             float sidePanelMask(vec3 p, vec3 lo, vec3 hi, float shape) {
               if (insideBox(p, lo, hi) < 0.5) return 0.0;
               if (shape < 0.5) return 1.0;

               vec2 xy = p.xy;

               if (shape < 1.5) {
                 float mask = 1.0;
                 mask *= aboveLine(xy, vec2(0.76, 0.80), vec2(1.00, 0.31));  // A-post edge
                 mask *= belowLine(xy, vec2(0.76, 0.88), vec2(1.44, 0.77));  // bonnet/wing crown
                 mask *= aboveLine(xy, vec2(1.10, 0.32), vec2(1.47, 0.36));  // lower wing return
                 mask *= belowLine(xy, vec2(1.42, 0.73), vec2(1.49, 0.42));  // nose/front edge
                 mask *= outsideEllipse(xy, vec2(1.02, 0.27), vec2(0.30, 0.33));
                 mask *= 1.0 - (step(1.28, p.x) * step(0.0, 0.46 - p.y));   // lamp/bumper face
                 return mask;
               }

               if (shape < 2.5) {
                 float mask = 1.0;
                 mask *= aboveLine(xy, vec2(-0.08, 0.24), vec2(0.88, 0.24)); // sill
                 mask *= belowLine(xy, vec2(-0.16, 0.79), vec2(0.78, 0.78)); // window/belt line
                 mask *= belowLine(xy, vec2(-0.08, 0.24), vec2(-0.06, 0.80)); // rear door seam
                 mask *= belowLine(xy, vec2(0.78, 0.80), vec2(1.03, 0.33));  // A-post/front seam
                 mask *= outsideEllipse(xy, vec2(1.02, 0.27), vec2(0.32, 0.34));
                 return mask;
               }

               float mask = 1.0;
               mask *= aboveLine(xy, vec2(-1.46, 0.23), vec2(-0.17, 0.23));  // lower sill
               mask *= belowLine(xy, vec2(-1.38, 0.79), vec2(-0.17, 0.78));  // below rear window
               mask *= belowLine(xy, vec2(-1.47, 0.24), vec2(-1.32, 0.79));  // tail/rear seam
               mask *= aboveLine(xy, vec2(-0.18, 0.23), vec2(-0.16, 0.79));  // door seam
               mask *= outsideEllipse(xy, vec2(-0.90, 0.27), vec2(0.31, 0.34));
               return mask;
             }`
          )
          .replace(
            "#include <dithering_fragment>",
            `#include <dithering_fragment>
             if (uZoneCount > 0.5) {
               float inZone = 0.0;
               vec3 fdx = dFdx(vCarPos);
               vec3 fdy = dFdy(vCarPos);
               vec3 n = normalize(cross(fdx, fdy));
               for (int i = 0; i < ${MAX_HIGHLIGHT_ZONES}; i++) {
                 if (float(i) >= uZoneCount) break;
                 if (sidePanelMask(vCarPos, uZoneMins[i], uZoneMaxs[i], uZoneShapes[i]) > 0.5
                     && abs(dot(n, uZoneNormals[i])) > uZoneTols[i]) inZone = 1.0;
               }
               if (inZone > 0.5 && inAnyArch(vCarPos) > 0.5) inZone = 0.0;
               if (inZone > 0.5) {
                 vec3 accent = vec3(0.87, 0.09, 0.09);
                 gl_FragColor.rgb = mix(gl_FragColor.rgb, accent, 0.60);
                 gl_FragColor.rgb += vec3(0.12, 0.02, 0.02);
               }
             }`
          );
      };
      std.needsUpdate = true;
    };

    // --- Invisible click zones (raycaster targets) --------------------------
    const invisibleZoneMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const exteriorZoneMeshes: THREE.Mesh[] = [];

    for (const z of EXTERIOR_ZONES) {
      const [x1, y1, z1, x2, y2, z2] = z.box;
      const w = Math.max(0.001, x2 - x1);
      const h = Math.max(0.001, y2 - y1);
      const d = Math.max(0.001, z2 - z1);
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, cz = (z1 + z2) / 2;

      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), invisibleZoneMat);
      m.position.set(cx, cy, cz);
      m.renderOrder = 999;
      m.userData = { sectionCode: z.code, label: z.label, kind: "exterior", zone: z };
      carGroup.add(m);
      exteriorZoneMeshes.push(m);
    }

    // --- INTERIOR overlay ---------------------------------------------------
    const interiorGroup = new THREE.Group();
    interiorGroup.visible = false;
    carGroup.add(interiorGroup);

    const keepInteriorOverlayStable = (mat: THREE.MeshStandardMaterial) => {
      mat.depthTest = false;
      mat.depthWrite = false;
      return mat;
    };

    const chassisMat  = keepInteriorOverlayStable(new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.55, metalness: 0.25 }));
    const floorMat    = keepInteriorOverlayStable(new THREE.MeshStandardMaterial({ color: 0x8a7a65, roughness: 0.8,  metalness: 0.1 }));
    const subframeMat = keepInteriorOverlayStable(new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.35, metalness: 0.55 }));
    const bulkheadMat = keepInteriorOverlayStable(new THREE.MeshStandardMaterial({ color: 0x6f5e48, roughness: 0.65, metalness: 0.2 }));
    const interiorHighlightMat = keepInteriorOverlayStable(new THREE.MeshStandardMaterial({
      color: 0xB8860B, roughness: 0.3, metalness: 0.6,
      emissive: 0xB8860B, emissiveIntensity: 0.55,
    }));

    const interiorMeshes: THREE.Mesh[] = [];
    const addInterior = (code: string, label: string, mesh: THREE.Mesh, mat: THREE.Material) => {
      mesh.material = mat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 20;
      mesh.userData = { sectionCode: code, label, kind: "interior", originalMat: mat };
      interiorGroup.add(mesh);
      interiorMeshes.push(mesh);
    };

    // 510 Front subframe
    for (const zs of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.08, 0.08), subframeMat);
      rail.position.set(1.00, 0.20, zs);
      addInterior("510", "Front subframe", rail, subframeMat);
    }
    for (const xs of [0.65, 1.35]) {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.10), subframeMat);
      cr.position.set(xs, 0.20, 0);
      addInterior("510", "Front subframe", cr, subframeMat);
    }
    // 510 Rear subframe
    for (const zs of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.08, 0.08), subframeMat);
      rail.position.set(-1.00, 0.20, zs);
      addInterior("510", "Rear subframe", rail, subframeMat);
    }
    for (const xs of [-0.65, -1.35]) {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.10), subframeMat);
      cr.position.set(xs, 0.20, 0);
      addInterior("510", "Rear subframe", cr, subframeMat);
    }
    // 210 Inner wings
    for (const zs of [-0.40, 0.40]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.45, 0.05), chassisMat);
      wing.position.set(1.00, 0.55, zs);
      addInterior("210", "Inner wing", wing, chassisMat);
    }
    // 220 Front bulkhead (lower)
    {
      const bh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.15), bulkheadMat);
      bh.position.set(0.65, 0.55, 0);
      addInterior("220", "Front bulkhead (lower)", bh, bulkheadMat);
    }
    // 230 Front bulkhead (upper scuttle)
    {
      const bh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.05, 1.15), bulkheadMat);
      bh.position.set(0.70, 0.92, 0);
      addInterior("230", "Front bulkhead (upper)", bh, bulkheadMat);
    }
    // 350 Toeboard
    {
      const tb = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 1.05), floorMat);
      tb.position.set(0.50, 0.30, 0);
      tb.rotation.z = -Math.PI * 0.18;
      addInterior("350", "Toeboard", tb, floorMat);
    }
    // 310 Front floor
    {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.04, 1.10), floorMat);
      fp.position.set(0.20, 0.22, 0);
      addInterior("310", "Front floor pan", fp, floorMat);
    }
    // 320 Centre floor
    {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 1.10), floorMat);
      fp.position.set(-0.35, 0.22, 0);
      addInterior("320", "Centre floor", fp, floorMat);
    }
    // 330 Rear floor
    {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 1.10), floorMat);
      fp.position.set(-0.85, 0.22, 0);
      addInterior("330", "Rear floor", fp, floorMat);
    }
    // 340 Floor crossmember
    {
      const cm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 1.10), subframeMat);
      cm.position.set(-0.05, 0.18, 0);
      addInterior("340", "Floor crossmember", cm, subframeMat);
    }
    // 420 Rear bulkhead
    {
      const bh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.15), bulkheadMat);
      bh.position.set(-1.05, 0.55, 0);
      addInterior("420", "Rear bulkhead", bh, bulkheadMat);
    }
    // 410 Boot floor
    {
      const bf = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 1.10), floorMat);
      bf.position.set(-1.25, 0.30, 0);
      addInterior("410", "Boot floor", bf, floorMat);
    }
    // 430 Rear end assembly
    {
      const rea = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.30, 1.15), chassisMat);
      rea.position.set(-1.45, 0.40, 0);
      addInterior("430", "Rear end assembly", rea, chassisMat);
    }

    // --- Body material tracking --------------------------------------------
    let loadedModel: THREE.Object3D | null = null;
    const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
    const fadeState = { current: 1.0, target: 1.0 };
    let rafId = 0;
    let isVisible = true;
    let activeUntil = 0;

    function requestRender() {
      if (!isVisible || rafId) return;
      rafId = requestAnimationFrame(renderFrame);
    }

    function wakeRender(durationMs = 650) {
      activeUntil = performance.now() + durationMs;
      requestRender();
    }

    function renderFrame() {
      rafId = 0;
      if (!isVisible) return;

      const fadeActive = Math.abs(fadeState.current - fadeState.target) > 0.005;
      if (fadeActive) {
        fadeState.current = THREE.MathUtils.lerp(fadeState.current, fadeState.target, 0.12);
        applyFadeToMaterials();
      }

      controls.update();
      renderer.render(scene, camera);

      if (fadeActive || performance.now() < activeUntil) {
        requestRender();
      }
    }

    // --- Loader -------------------------------------------------------------
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const loadFromUrl = (url: string) => {
      setModelStatus("loading");
      loader.load(
        url,
        (gltf) => {
          if (loadedModel) {
            carGroup.remove(loadedModel);
            loadedModel.traverse((o) => disposeObject(o));
            originalMaterials.clear();
          }

          const model = gltf.scene;
          const pre = new THREE.Box3().setFromObject(model);
          const size = pre.getSize(new THREE.Vector3());

          if (size.z > size.x) model.rotation.y = Math.PI / 2;
          model.rotation.y += Math.PI; // Meshy exports grille at -X; flip.

          const TARGET_LENGTH = 3.0;
          const longHoriz = Math.max(size.x, size.z);
          const scale = TARGET_LENGTH / longHoriz;
          model.scale.setScalar(scale);

          model.updateMatrixWorld(true);
          const post = new THREE.Box3().setFromObject(model);
          const postCentre = post.getCenter(new THREE.Vector3());
          model.position.x -= postCentre.x;
          model.position.z -= postCentre.z;
          model.position.y -= post.min.y;

          model.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const m = obj as THREE.Mesh;
              m.castShadow = false;
              m.receiveShadow = false;
              if (Array.isArray(m.material)) {
                m.material = m.material.map((x) => x.clone());
                (m.material as THREE.Material[]).forEach((mat) => injectHighlightShader(mat));
                originalMaterials.set(m, m.material);
              } else if (m.material) {
                m.material = m.material.clone();
                injectHighlightShader(m.material);
                originalMaterials.set(m, m.material);
              }
            }
          });

          loadedModel = model;
          carGroup.add(model);
          applyModeRef.current?.(modeRef.current);
          setModelStatus("loaded");
          requestRender();
        },
        undefined,
        (err) => {
          console.warn("GLB load failed:", err);
          setModelStatus("placeholder");
          requestRender();
        }
      );
    };

    loadFromUrl(MINI_MODEL_URL);

    // --- Mode change: animate body opacity + toggle overlay ----------------
    const applyMode = (m: Mode) => {
      fadeState.target = m === "interior" ? 0.22 : 1.0;
      interiorGroup.visible = m === "interior";
      wakeRender(1000);
    };
    applyModeRef.current = applyMode;

    const applyFadeToMaterials = () => {
      for (const [mesh] of originalMaterials.entries()) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of mats) {
          const std = material as THREE.MeshStandardMaterial;
          const translucent = fadeState.current < 0.99;
          if (std.transparent !== translucent) {
            std.transparent = translucent;
            std.depthWrite = !translucent;
            std.needsUpdate = true;
          }
          std.opacity = translucent ? fadeState.current : 1.0;
        }
      }
    };

    // --- Body highlight uniforms control -----------------------------------
    const highlightZones = (zones: ZoneDef[]) => {
      const take = zones.slice(0, MAX_HIGHLIGHT_ZONES);
      highlightUniforms.uZoneCount.value = take.length;

      for (let i = 0; i < MAX_HIGHLIGHT_ZONES; i += 1) {
        const z = take[i];
        const min = highlightUniforms.uZoneMins.value[i];
        const max = highlightUniforms.uZoneMaxs.value[i];
        const normal = highlightUniforms.uZoneNormals.value[i];

        if (z) {
          min.set(z.box[0], z.box[1], z.box[2]);
          max.set(z.box[3], z.box[4], z.box[5]);
          normal.set(z.normal[0], z.normal[1], z.normal[2]).normalize();
          highlightUniforms.uZoneTols.value[i] = z.normalTol ?? 0.45;
          highlightUniforms.uZoneShapes.value[i] = z.shape ?? 0;
        } else {
          min.set(0, 0, 0);
          max.set(0, 0, 0);
          normal.set(0, 1, 0);
          highlightUniforms.uZoneTols.value[i] = 0.45;
          highlightUniforms.uZoneShapes.value[i] = 0;
        }
      }
    };
    const clearHighlight = () => {
      highlightUniforms.uZoneCount.value = 0;
      for (const m of interiorMeshes) {
        const orig = (m.userData.originalMat as THREE.Material | undefined);
        if (orig) m.material = orig;
      }
      requestRender();
    };

    // --- Raycasting (click + hover) -----------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getActiveTargets = (): THREE.Mesh[] =>
      modeRef.current === "exterior" ? exteriorZoneMeshes : interiorMeshes;

    const highlightForCode = (code: string) => {
      if (modeRef.current === "exterior") {
        const zs = EXTERIOR_ZONES.filter((z) => z.code === code);
        highlightZones(zs);
      } else {
        for (const m of interiorMeshes) {
          if (m.userData.sectionCode === code) {
            m.material = interiorHighlightMat;
          } else {
            const orig = (m.userData.originalMat as THREE.Material | undefined);
            if (orig) m.material = orig;
          }
        }
      }
      requestRender();
    };
    highlightCodeRef.current = highlightForCode;
    clearHighlightRef.current = clearHighlight;

    if (selectedSection !== "all") {
      const nextMode = INTERIOR_CODES.has(selectedSection) ? "interior" : "exterior";
      modeRef.current = nextMode;
      applyMode(nextMode);
      highlightForCode(selectedSection);
    }

    // Shared raycast: clientX/clientY -> section code+label or null
    const raycastAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(getActiveTargets(), true);
      const hit = hits[0]?.object as THREE.Mesh | undefined;
      const code = hit?.userData?.sectionCode as string | undefined;
      const label = hit?.userData?.label as string | undefined;
      return code && label
        ? { code, label, localX: clientX - rect.left, localY: clientY - rect.top }
        : null;
    };

    const onPointerMove = (e: PointerEvent) => {
      // Touch devices have no hover — let the tap handler drive highlighting
      if (e.pointerType === "touch") return;
      const r = raycastAt(e.clientX, e.clientY);
      if (r) {
        highlightForCode(r.code);
        setHovered({ code: r.code, label: r.label, x: r.localX, y: r.localY });
        renderer.domElement.style.cursor = "pointer";
      } else {
        clearHighlight();
        setHovered(null);
        renderer.domElement.style.cursor = "grab";
      }
    };

    // Track pointer movement ourselves so an OrbitControls drag never becomes
    // a catalogue jump just because the cursor finishes over a clickable zone.
    let pointerStart: { id: number; x: number; y: number; time: number; type: string } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerStart = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
        type: e.pointerType,
      };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerStart || pointerStart.id !== e.pointerId) {
        pointerStart = null;
        return;
      }

      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      const moved = Math.hypot(dx, dy);
      const dt = Date.now() - pointerStart.time;
      const tolerance = pointerStart.type === "touch" ? 14 : 5;
      pointerStart = null;

      if (moved <= tolerance && dt < 700) {
        const r = raycastAt(e.clientX, e.clientY);
        if (r) {
          highlightForCode(r.code);
          setHovered({ code: r.code, label: r.label, x: r.localX, y: r.localY });
          onSelect(r.code);
          setTimeout(() => { setHovered(null); }, 1200);
        } else {
          clearHighlight();
          setHovered(null);
        }
      }
    };

    const onPointerCancel = () => { pointerStart = null; };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);
    renderer.domElement.style.cursor = "grab";
    // Vertical swipes keep scrolling the page; horizontal drags rotate the Mini.
    renderer.domElement.style.touchAction = "pan-y";

    // --- Render scheduling --------------------------------------------------
    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          ([entry]) => {
            isVisible = entry.isIntersecting;
            if (isVisible) requestRender();
          },
          { threshold: 0.05 }
        )
      : null;
    observer?.observe(mount);
    requestRender();

    // --- Resize -------------------------------------------------------------
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      requestRender();
    };
    window.addEventListener("resize", onResize);

    // --- Cleanup ------------------------------------------------------------
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      observer?.disconnect();
      controls.dispose();
      renderer.dispose();
      highlightCodeRef.current = null;
      clearHighlightRef.current = null;
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse(disposeObject);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentSection = getSection(selectedSection);
  const modeLabel = mode === "exterior" ? "EXTERIOR" : "INTERIOR · CHASSIS";

  return (
    <div className="relative rounded-2xl overflow-hidden border border-racing/10 bg-cream-dark">
      <div ref={mountRef} className="h-[360px] w-full select-none sm:h-[440px] lg:h-[560px]" />

      {/* Top-left: status chip */}
      <div className="absolute left-4 top-16 z-10 flex gap-2 sm:top-4">
        <div className="max-w-[calc(100vw-64px)] rounded-md bg-racing/90 px-3 py-1.5 text-[12px] tracking-wider text-cream">
          {modelStatus === "loading"     && "LOADING MODEL…"}
          {modelStatus === "placeholder" && "NO MODEL — DROP mini.glb IN /public/models/"}
          {modelStatus === "loaded"      && `${modeLabel} · DRAG TO ORBIT · CLICK TO FILTER`}
        </div>
      </div>

      {/* Top-right: mode toggle */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <div className="bg-white/95 rounded-lg p-1 flex border border-racing/10 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("exterior")}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold tracking-wider transition-colors ${
              mode === "exterior" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
            }`}
          >
            EXTERIOR
          </button>
          <button
            type="button"
            onClick={() => setMode("interior")}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold tracking-wider transition-colors ${
              mode === "interior" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
            }`}
          >
            INTERIOR
          </button>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute bg-racing text-cream px-3 py-1.5 rounded-md text-[12px] font-mono z-20 pointer-events-none shadow-lg"
          style={{ left: hovered.x + 16, top: hovered.y + 16 }}
        >
          <span className="font-sans font-semibold text-gold">{hovered.code}</span>
          <span className="mx-1.5 opacity-50">·</span>
          {hovered.label}
        </div>
      )}

      {/* Bottom readout bar */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/95 rounded-lg p-3 flex items-center justify-between gap-3 border border-racing/10 shadow-sm z-10">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-muted font-semibold tracking-wider">
            {selectedSection === "all" ? `CATALOGUE · ${modeLabel}` : `SECTION ${selectedSection} · ${modeLabel}`}
          </div>
          <div className="text-sm font-semibold leading-snug text-racing sm:text-base">
            {selectedSection === "all"
              ? `All panels — ${sections.length} sections. Click the Mini to filter, toggle Interior for chassis parts.`
              : currentSection ? currentSection.label : "Unknown"}
          </div>
          {currentSection && selectedSection !== "all" && (
            <div className="text-xs text-ink-muted">{currentSection.subtitle}</div>
          )}
        </div>
        {selectedSection !== "all" && (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="text-xs text-racing hover:text-gold underline whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// HELPERS
// ===========================================================================

function setCameraFromSpherical(
  camera: THREE.PerspectiveCamera,
  [az, pl, d]: [number, number, number],
  target: THREE.Vector3 = new THREE.Vector3(0, 0.6, 0)
) {
  const x = d * Math.sin(pl) * Math.sin(az);
  const y = d * Math.cos(pl);
  const z = d * Math.sin(pl) * Math.cos(az);
  camera.position.set(target.x + x, target.y + y, target.z + z);
  camera.lookAt(target);
}

function disposeObject(obj: THREE.Object3D) {
  const m = obj as THREE.Mesh;
  if (m.isMesh) {
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  }
}
