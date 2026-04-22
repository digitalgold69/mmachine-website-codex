"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sections, getSection, type SectionMode } from "@/lib/mini-data";

type Props = {
  selectedSection: string;
  onSelect: (code: string) => void;
};

// Preset camera angles per section — smoothly glide to these when user clicks a section
// Format: [yaw (horizontal rotation around car), pitch (up/down tilt)]
// yaw = 0 looks at front; PI looks at rear; PI/2 = left side; -PI/2 = right side
const SECTION_VIEWS: Record<string, [number, number]> = {
  "120": [Math.PI * 0.85, 0.05],   // rear panel — slight rear-3/4
  "130": [Math.PI * 0.5, 0.05],    // side repairs — straight side view
  "140": [Math.PI * 0.4, 0.05],    // more side — slightly rear-biased
  "150": [Math.PI * 0.5, 0.05],    // doors — side view
  "160": [-Math.PI * 0.2, 0.15],   // front & roof — front 3/4 high
  "170": [0, 0.05],                // front panel — dead front
  "210": [-Math.PI * 0.25, 0.1],   // front inner wings — front 3/4
  "220": [-Math.PI * 0.3, 0.2],    // bulkhead cooling — front 3/4 high
  "230": [-Math.PI * 0.3, 0.2],    // bulkhead crossmember — front 3/4 high
  "310": [Math.PI * 0.3, 0.4],     // floor panels — looking down from above
  "320": [Math.PI * 0.3, 0.4],     // floor repair — looking down
  "330": [Math.PI * 0.5, 0.4],     // flat floors — side looking down
  "340": [Math.PI * 0.3, 0.4],     // floor assembly — looking down
  "350": [-Math.PI * 0.15, 0.3],   // toeboard — front looking down
  "410": [Math.PI * 0.8, 0.3],     // boot — rear 3/4 looking down
  "420": [Math.PI * 0.7, 0.15],    // rear bulkhead — rear 3/4
  "430": [Math.PI * 0.8, 0.25],    // rear assembly — rear looking into boot
  "510": [Math.PI * 0.2, 0.5],     // subframes — heavy top-down tilt to see under
  "Apx1": [Math.PI * 0.5, 0.1],    // accessories — side view
  "Apx2": [-Math.PI * 0.1, 0.15],  // switch panels — front quarter
};

const DEFAULT_VIEW: [number, number] = [-Math.PI * 0.2, 0.1]; // nice 3/4 hero angle

export default function Mini3D({ selectedSection, onSelect }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<SectionMode>("exterior");
  const selectedRef = useRef(selectedSection);
  const hoveredRef = useRef<string | null>(null);
  const modeRef = useRef<SectionMode>(mode);
  const targetViewRef = useRef<[number, number] | null>(null);

  useEffect(() => { selectedRef.current = selectedSection; }, [selectedSection]);
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Whenever selection changes, set a target view (unless it's "all" — then keep current view)
  useEffect(() => {
    if (selectedSection !== "all" && SECTION_VIEWS[selectedSection]) {
      targetViewRef.current = SECTION_VIEWS[selectedSection];
    }
  }, [selectedSection]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth;
    let height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(6, 3.5, 7.5);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Improved lighting for soft highlights on curved surfaces
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(5, 8, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xB8860B, 0.3);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);
    const underLight = new THREE.DirectionalLight(0x6688aa, 0.2);
    underLight.position.set(0, -3, 0);
    scene.add(underLight);

    const car = new THREE.Group();

    // ============================================================
    // PALETTE — British Racing Green with subtle variations per section
    // ============================================================
    const BRG = 0x0F3D2E;           // main body
    const BRG_LIGHT = 0x145140;     // slight highlight for differentiation
    const BRG_DARK = 0x0a2e22;      // shadowed areas
    const ROOF_CREAM = 0xEFE8D5;    // classic contrast roof
    const CHROME = 0xDDD6C4;        // warm chrome
    const BLACK = 0x1a1a1a;         // wheels, rubber
    const DARK_STEEL = 0x2d2d2d;    // underbody steel
    const LIGHT_STEEL = 0x4a4a4a;   // brighter steel for interior
    const GLASS = 0x1f2f2a;         // greenish tinted glass

    // ============================================================
    // HELPERS
    // ============================================================
    type PartMeta = { section: string; layer: "shell" | "interior" | "always"; originalColor: number; clickable: boolean };
    const parts: (THREE.Mesh & { partMeta?: PartMeta })[] = [];

    const makeMat = (color: number, transparent = false, shininess = 45) =>
      new THREE.MeshPhongMaterial({
        color,
        specular: 0x555555,
        shininess,
        emissive: 0x000000,
        transparent,
        opacity: 1,
      });

    const addMesh = (
      geo: THREE.BufferGeometry,
      color: number,
      pos: [number, number, number],
      section: string | null,
      layer: "shell" | "interior" | "always" = "shell",
      rot?: [number, number, number],
      shininess = 45
    ) => {
      const transparent = layer === "shell";
      const m = new THREE.Mesh(geo, makeMat(color, transparent, shininess)) as THREE.Mesh & { partMeta?: PartMeta };
      m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      if (section) {
        m.partMeta = { section, layer, originalColor: color, clickable: true };
        parts.push(m);
      } else {
        m.partMeta = { section: "", layer, originalColor: color, clickable: false };
      }
      car.add(m);
      return m;
    };

    // Rounded-box geometry helper (proper curved-surface Mini look)
    // Uses ExtrudeGeometry with chamfered corners
    const roundedBox = (w: number, h: number, d: number, r = 0.05) => {
      const shape = new THREE.Shape();
      const rr = Math.min(r, w / 2, h / 2);
      shape.moveTo(-w / 2 + rr, -h / 2);
      shape.lineTo(w / 2 - rr, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
      shape.lineTo(w / 2, h / 2 - rr);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
      shape.lineTo(-w / 2 + rr, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
      shape.lineTo(-w / 2, -h / 2 + rr);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
      return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    };

    // ============================================================
    // BUILDING THE CLASSIC MINI
    // Proportions based on the real car: 3.05m long, 1.41m wide, 1.35m tall
    // Scaled to nice 3D units: ~3.5 long, 1.7 wide, 1.55 tall
    // ============================================================

    // === FLOOR PAN (interior, structural) — Section 310 ===
    addMesh(roundedBox(3.0, 1.55, 0.08, 0.1), DARK_STEEL, [0, 0.28, -0.04], "310", "interior", [0, 0, 0]);

    // === TOEBOARD (interior, front of floor) — Section 350 ===
    addMesh(roundedBox(0.45, 1.2, 0.4, 0.05), LIGHT_STEEL, [1.15, 0.5, -0.2], "350", "interior", [0, 0, 0]);

    // === FLOOR REPAIR PANELS (interior, mid-floor) — Section 320 ===
    addMesh(roundedBox(1.4, 0.5, 0.04, 0.05), 0x3a3a3a, [0, 0.34, 0.3], "320", "interior", [0, 0, 0]);
    addMesh(roundedBox(1.4, 0.5, 0.04, 0.05), 0x3a3a3a, [0, 0.34, -0.3], "320", "interior", [0, 0, 0]);

    // === FLAT FLOOR (Van/Traveller area, rear) — Section 330 ===
    addMesh(roundedBox(0.7, 1.3, 0.04, 0.05), 0x444444, [-1.2, 0.32, 0], "330", "interior", [0, 0, 0]);

    // === FLOOR ASSEMBLY / TUNNEL (interior crossmember) — Section 340 ===
    addMesh(new THREE.BoxGeometry(2.8, 0.25, 0.3), LIGHT_STEEL, [0, 0.42, 0], "340", "interior");

    // === SUBFRAMES (front and rear, underneath) — Section 510 ===
    addMesh(roundedBox(0.95, 1.1, 0.12, 0.05), 0x333333, [1.35, 0.2, 0], "510", "interior", [0, 0, 0]);
    addMesh(roundedBox(0.8, 1.05, 0.12, 0.05), 0x333333, [-1.45, 0.2, 0], "510", "interior", [0, 0, 0]);

    // === FRONT BULKHEAD COOLING (radiator area, interior) — Section 220 ===
    addMesh(roundedBox(0.3, 0.85, 0.5, 0.03), 0x555555, [1.05, 0.75, 0], "220", "interior", [0, 0, 0]);

    // === FRONT BULKHEAD CROSSMEMBER — Section 230 ===
    addMesh(new THREE.BoxGeometry(0.55, 1.3, 0.18), 0x666666, [0.95, 0.48, 0], "230", "interior");

    // === FRONT INNER WINGS (interior wheel arches) — Section 210 ===
    addMesh(roundedBox(0.85, 0.5, 0.12, 0.05), BRG_DARK, [1.45, 0.8, 0.52], "210", "interior", [0, 0, 0]);
    addMesh(roundedBox(0.85, 0.5, 0.12, 0.05), BRG_DARK, [1.45, 0.8, -0.52], "210", "interior", [0, 0, 0]);

    // === REAR BULKHEAD (between cabin and boot) — Section 420 ===
    addMesh(new THREE.BoxGeometry(0.1, 1.35, 0.7), 0x444444, [-1.1, 0.8, 0], "420", "interior");

    // === REAR ASSEMBLY — battery box, tank straps — Section 430 ===
    addMesh(roundedBox(0.35, 0.35, 0.28, 0.03), 0x555555, [-1.5, 0.5, 0.4], "430", "interior", [0, 0, 0]);
    addMesh(roundedBox(0.35, 0.35, 0.28, 0.03), 0x555555, [-1.5, 0.5, -0.4], "430", "interior", [0, 0, 0]);

    // === BOOT FLOOR (interior under boot lid) — Section 410 ===
    addMesh(roundedBox(0.55, 1.3, 0.06, 0.05), 0x3a3a3a, [-1.65, 0.55, 0], "410", "interior", [0, 0, 0]);

    // === ACCESSORIES / DASH (interior trim) — Section Apx1 ===
    addMesh(new THREE.BoxGeometry(0.15, 1.3, 0.2), 0x3a2e1a, [0.8, 1.0, 0], "Apx1", "interior");

    // === SWITCH PANELS (centre of dash) — Section Apx2 ===
    addMesh(roundedBox(0.08, 0.35, 0.1, 0.02), 0x4a4a4a, [0.74, 0.95, 0], "Apx2", "interior", [0, 0, 0]);

    // ============================================================
    // EXTERIOR SHELL — the parts visible from outside
    // ============================================================

    // === MAIN BODY TUB (the main body shell side panels) — Section 130 (Side Repairs) ===
    // Use rounded box for softer, more Mini-like proportions
    addMesh(roundedBox(2.6, 1.4, 0.9, 0.15), BRG, [0, 0.82, 0], "130", "shell", [0, 0, 0]);

    // === DOORS (left and right) — Section 150 ===
    // Mini has relatively small doors, slightly curved at top
    const doorGeo = roundedBox(1.15, 0.9, 0.05, 0.08);
    addMesh(doorGeo, BRG, [0.15, 0.75, 0.72], "150", "shell", [0, 0, 0]);
    addMesh(doorGeo, BRG, [0.15, 0.75, -0.72], "150", "shell", [0, Math.PI, -0.05]);

    // Door handles (chrome, visual only)
    addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), CHROME, [-0.15, 0.9, 0.76], null, "shell", [0, 0, Math.PI / 2]);
    addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), CHROME, [-0.15, 0.9, -0.76], null, "shell", [0, 0, Math.PI / 2]);

    // === SIDE SILLS & DOOR STEPS (lower bodyside trim) — Section 130 continuation ===
    addMesh(new THREE.BoxGeometry(2.5, 0.1, 0.2), BRG_DARK, [0, 0.28, 0.78], "130", "shell");
    addMesh(new THREE.BoxGeometry(2.5, 0.1, 0.2), BRG_DARK, [0, 0.28, -0.78], "130", "shell");

    // === QUARTER PANELS (rear side panels, behind doors) — Section 140 ===
    addMesh(roundedBox(0.7, 0.85, 0.06, 0.08), BRG, [-0.95, 0.85, 0.76], "140", "shell", [0, 0, 0]);
    addMesh(roundedBox(0.7, 0.85, 0.06, 0.08), BRG, [-0.95, 0.85, -0.76], "140", "shell", [0, Math.PI, 0]);

    // === BONNET (section 160 — Front & Roof, specifically the bonnet & outer wings) ===
    // Mini bonnet is short and drops down to the grille
    const bonnetShape = new THREE.Shape();
    bonnetShape.moveTo(-0.45, -0.65);
    bonnetShape.lineTo(0.45, -0.65);
    bonnetShape.lineTo(0.45, 0.65);
    bonnetShape.lineTo(-0.45, 0.65);
    bonnetShape.lineTo(-0.45, -0.65);
    const bonnet = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bonnetShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 3 }),
      makeMat(BRG, true, 55)
    ) as THREE.Mesh & { partMeta?: PartMeta };
    bonnet.position.set(1.55, 0.93, 0);
    bonnet.rotation.set(-Math.PI / 2, 0, 0);
    bonnet.rotation.x = -Math.PI / 2 - 0.1; // slight downward slope toward grille
    bonnet.partMeta = { section: "160", layer: "shell", originalColor: BRG, clickable: true };
    parts.push(bonnet);
    car.add(bonnet);

    // === FRONT WINGS (L & R — outer wings, flanking bonnet) — Section 160 continuation ===
    // Wings are one of the defining features of a Classic Mini — they curve over the wheels
    const wingGeo = roundedBox(0.95, 0.75, 0.18, 0.15);
    addMesh(wingGeo, BRG, [1.5, 0.78, 0.69], "160", "shell", [0, 0, 0]);
    addMesh(wingGeo, BRG, [1.5, 0.78, -0.69], "160", "shell", [0, 0, 0]);

    // === ROOF (section 160 — roof) ===
    // Classic Mini roof is slightly domed — use a flattened sphere approach
    const roofGeo = new THREE.BoxGeometry(2.1, 0.08, 1.45);
    addMesh(roofGeo, ROOF_CREAM, [-0.1, 1.54, 0], "160", "shell", [0, 0, 0], 70);
    // Drip rails (little detail)
    addMesh(new THREE.BoxGeometry(2.15, 0.03, 0.03), CHROME, [-0.1, 1.5, 0.74], null, "shell");
    addMesh(new THREE.BoxGeometry(2.15, 0.03, 0.03), CHROME, [-0.1, 1.5, -0.74], null, "shell");

    // === A-PILLARS & C-PILLARS (window frames) — part of section 160 (body shell) ===
    addMesh(new THREE.BoxGeometry(0.08, 0.6, 0.1), BRG, [1.0, 1.22, 0.72], "160", "shell");
    addMesh(new THREE.BoxGeometry(0.08, 0.6, 0.1), BRG, [1.0, 1.22, -0.72], "160", "shell");
    addMesh(new THREE.BoxGeometry(0.08, 0.6, 0.1), BRG, [-1.2, 1.22, 0.72], "160", "shell");
    addMesh(new THREE.BoxGeometry(0.08, 0.6, 0.1), BRG, [-1.2, 1.22, -0.72], "160", "shell");

    // === WINDOWS (glass — visual only, fade with shell) ===
    const windowMat = makeMat(GLASS, true, 100);
    windowMat.opacity = 0.55;
    // Side windows
    const sideWindowGeo = new THREE.BoxGeometry(2.1, 0.55, 0.03);
    const sWindowR = new THREE.Mesh(sideWindowGeo, windowMat.clone());
    sWindowR.position.set(-0.1, 1.22, 0.75);
    (sWindowR as THREE.Mesh & { partMeta?: PartMeta }).partMeta = { section: "", layer: "shell", originalColor: GLASS, clickable: false };
    car.add(sWindowR);
    const sWindowL = new THREE.Mesh(sideWindowGeo, windowMat.clone());
    sWindowL.position.set(-0.1, 1.22, -0.75);
    (sWindowL as THREE.Mesh & { partMeta?: PartMeta }).partMeta = { section: "", layer: "shell", originalColor: GLASS, clickable: false };
    car.add(sWindowL);
    // Windscreen (slightly tilted)
    const wsGeo = new THREE.BoxGeometry(0.03, 0.55, 1.35);
    const ws = new THREE.Mesh(wsGeo, windowMat.clone());
    ws.position.set(1.0, 1.22, 0);
    ws.rotation.z = -0.15;
    (ws as THREE.Mesh & { partMeta?: PartMeta }).partMeta = { section: "", layer: "shell", originalColor: GLASS, clickable: false };
    car.add(ws);
    // Rear window
    const rw = new THREE.Mesh(wsGeo, windowMat.clone());
    rw.position.set(-1.2, 1.22, 0);
    rw.rotation.z = 0.1;
    (rw as THREE.Mesh & { partMeta?: PartMeta }).partMeta = { section: "", layer: "shell", originalColor: GLASS, clickable: false };
    car.add(rw);

    // === FRONT PANEL (section 170 — number plate, grille surround) ===
    // The distinctive Mini front: grille, number plate area
    addMesh(roundedBox(0.08, 1.0, 0.45, 0.08), CHROME, [1.98, 0.7, 0], "170", "shell", [0, 0, 0], 80);
    // Grille slats (chrome bars)
    for (let i = 0; i < 6; i++) {
      const y = 0.5 + i * 0.07;
      addMesh(new THREE.BoxGeometry(0.02, 0.6, 0.03), 0xAAAAAA, [2.02, y, 0], null, "shell", [0, 0, 0], 100);
    }
    // Number plate
    addMesh(roundedBox(0.02, 0.5, 0.15, 0.01), 0xFFFFCC, [2.04, 0.35, 0], null, "shell", [0, 0, 0]);

    // === BOOT LID (section 120 — rear panel, boot lid, tailgate) ===
    // Classic Mini boot lid is small and upright
    addMesh(roundedBox(0.08, 1.3, 0.55, 0.06), BRG, [-1.93, 0.9, 0], "120", "shell", [0, 0, 0]);
    // Rear number plate (on boot)
    addMesh(roundedBox(0.02, 0.5, 0.15, 0.01), 0xFFFFCC, [-1.98, 0.75, 0], null, "shell", [0, 0, 0]);

    // === BUMPERS (chrome, visual) ===
    addMesh(new THREE.CylinderGeometry(0.08, 0.08, 1.55, 12), CHROME, [2.1, 0.4, 0], null, "always", [Math.PI / 2, 0, 0], 90);
    addMesh(new THREE.CylinderGeometry(0.08, 0.08, 1.55, 12), CHROME, [-2.05, 0.4, 0], null, "always", [Math.PI / 2, 0, 0], 90);

    // === HEADLIGHTS (round, chromed bezel) ===
    const headBezelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 24);
    const headGlassGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 24);
    addMesh(headBezelGeo, CHROME, [2.05, 0.85, 0.48], null, "always", [0, 0, Math.PI / 2], 100);
    addMesh(headBezelGeo, CHROME, [2.05, 0.85, -0.48], null, "always", [0, 0, Math.PI / 2], 100);
    addMesh(headGlassGeo, 0xFFF5CC, [2.1, 0.85, 0.48], null, "always", [0, 0, Math.PI / 2], 100);
    addMesh(headGlassGeo, 0xFFF5CC, [2.1, 0.85, -0.48], null, "always", [0, 0, Math.PI / 2], 100);

    // === TAIL LIGHTS (rectangular red) ===
    addMesh(roundedBox(0.05, 0.2, 0.3, 0.02), 0x881111, [-1.98, 0.85, 0.55], null, "always", [0, 0, 0]);
    addMesh(roundedBox(0.05, 0.2, 0.3, 0.02), 0x881111, [-1.98, 0.85, -0.55], null, "always", [0, 0, 0]);

    // === WHEELS (narrow Mini wheels with chrome hubs) ===
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.18, 24);
    const tyreWallGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 24);
    const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.19, 16);
    const hubCapGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16);
    const wheelPositions: [number, number, number][] = [
      [1.2, 0.36, 0.78], [1.2, 0.36, -0.78],
      [-1.35, 0.36, 0.78], [-1.35, 0.36, -0.78],
    ];
    wheelPositions.forEach((p) => {
      addMesh(tyreWallGeo, BLACK, p, null, "always", [Math.PI / 2, 0, 0]);
      addMesh(wheelGeo, BLACK, p, null, "always", [Math.PI / 2, 0, 0]);
      addMesh(hubGeo, CHROME, p, null, "always", [Math.PI / 2, 0, 0], 100);
      addMesh(hubCapGeo, 0xE8E4D8, p, null, "always", [Math.PI / 2, 0, 0], 120);
    });

    // === WHEEL ARCH FLARES (the classic Mini rolled arches) ===
    const archGeo = new THREE.TorusGeometry(0.45, 0.06, 8, 16, Math.PI);
    wheelPositions.forEach((p) => {
      addMesh(archGeo, BRG_DARK, [p[0], p[1] + 0.05, p[2]], null, "shell", [0, p[2] > 0 ? 0 : Math.PI, 0]);
    });

    // === WING MIRRORS ===
    addMesh(new THREE.SphereGeometry(0.06, 8, 6), CHROME, [0.9, 1.0, 0.82], null, "always", [0, 0, 0], 100);
    addMesh(new THREE.SphereGeometry(0.06, 8, 6), CHROME, [0.9, 1.0, -0.82], null, "always", [0, 0, 0], 100);

    scene.add(car);

    // === GROUND SHADOW ===
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // ============================================================
    // INTERACTION — NO AUTO-ROTATE, smooth glides only
    // ============================================================

    let rotY = DEFAULT_VIEW[0];
    let rotX = DEFAULT_VIEW[1];
    let targetY = DEFAULT_VIEW[0];
    let targetX = DEFAULT_VIEW[1];
    let dragging = false;
    let lastX = 0, lastY = 0;
    let dragStart = 0;
    let totalDrag = 0;

    const canvas = renderer.domElement;
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const pickableParts = () => {
      const m = modeRef.current;
      return parts.filter((p) => {
        if (!p.partMeta?.clickable) return false;
        if (m === "exterior") return p.partMeta.layer === "shell";
        return p.partMeta.layer === "interior";
      });
    };

    const pick = (e: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(pickableParts(), false);
      return hits.length ? (hits[0].object as typeof parts[0]).partMeta?.section ?? null : null;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      dragStart = Date.now(); totalDrag = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      // Cancel any pending target-view glide — user takes control
      targetViewRef.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        totalDrag += Math.abs(dx) + Math.abs(dy);
        targetY += dx * 0.01;
        targetX -= dy * 0.008;
        targetX = Math.max(-0.4, Math.min(0.7, targetX));
        lastX = e.clientX; lastY = e.clientY;
      } else {
        const s = pick(e);
        if (s !== hoveredRef.current) {
          setHovered(s);
          canvas.style.cursor = s ? "pointer" : "grab";
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = "grab";
      if (totalDrag < 5 && Date.now() - dragStart < 300) {
        const s = pick(e);
        if (s) onSelect(s);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", () => setHovered(null));

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      // If there's a target view from selection change, glide to it (unless user is dragging)
      if (targetViewRef.current && !dragging) {
        const [ty, tx] = targetViewRef.current;
        // Choose the shortest rotational path to target yaw
        let diff = ty - targetY;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        targetY += diff;
        targetX = tx;
        targetViewRef.current = null; // apply once, then smooth-interpolate to it via the easing below
      }

      // Smooth easing — faster for glides (0.08), slower for drag trail
      const ease = dragging ? 0.18 : 0.08;
      rotY += (targetY - rotY) * ease;
      rotX += (targetX - rotX) * ease;
      car.rotation.y = rotY;
      car.rotation.x = rotX * 0.45;

      // Apply mode + highlights
      const currentMode = modeRef.current;
      const sel = selectedRef.current;
      const hov = hoveredRef.current;

      parts.forEach((m) => {
        const meta = m.partMeta!;
        const mat = m.material as THREE.MeshPhongMaterial;
        const isShell = meta.layer === "shell";

        if (isShell) {
          mat.transparent = true;
          mat.opacity = currentMode === "exterior" ? 1.0 : 0.1;
        }

        if (!meta.clickable) {
          mat.color.setHex(meta.originalColor);
          mat.emissive.setHex(0x000000);
          return;
        }

        const isSelected = sel !== "all" && meta.section === sel;
        const isHover = hov && meta.section === hov;

        if (isSelected) {
          mat.color.setHex(0xB8860B);
          mat.emissive.setHex(0x5a3a0a);
          if (isShell) mat.opacity = currentMode === "exterior" ? 1.0 : 0.7;
        } else if (isHover) {
          mat.color.setHex(meta.originalColor);
          mat.emissive.setHex(0xB8860B);
          if (isShell) mat.opacity = currentMode === "exterior" ? 1.0 : 0.4;
        } else {
          mat.color.setHex(meta.originalColor);
          mat.emissive.setHex(0x000000);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight || 480;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      if (mount.contains(canvas)) mount.removeChild(canvas);
      renderer.dispose();
    };
  }, [onSelect]);

  const selSec = getSection(selectedSection);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-racing/10" style={{ background: "linear-gradient(180deg, #F5EFE0 0%, #EAE0C8 100%)" }}>
      <div ref={mountRef} className="w-full h-[480px]" />

      <div className="absolute top-4 left-4 bg-racing/90 text-cream px-3 py-1.5 rounded-md text-[11px] tracking-wider pointer-events-none">
        DRAG TO ROTATE · CLICK A SECTION
      </div>

      <div className="absolute top-4 right-4 bg-white/95 rounded-lg p-1 flex gap-1 border border-racing/10">
        <button
          onClick={() => setMode("exterior")}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            mode === "exterior" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
          }`}
        >
          Exterior
        </button>
        <button
          onClick={() => setMode("interior")}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            mode === "interior" ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
          }`}
        >
          Interior
        </button>
      </div>

      <div className="absolute bottom-4 left-4 right-4 bg-white/95 rounded-lg p-3 flex items-center justify-between gap-3 border border-racing/10">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-ink-muted font-semibold tracking-wider">
            {selectedSection === "all" ? "CATALOGUE" : `SECTION ${selectedSection}`}
          </div>
          <div className="text-base font-semibold text-racing truncate">
            {selectedSection === "all" ? "All 768 panels — click a section on the Mini" : selSec ? selSec.label : "Unknown"}
          </div>
          {selSec && selectedSection !== "all" && (
            <div className="text-xs text-ink-muted truncate">{selSec.subtitle}</div>
          )}
        </div>
        <button onClick={() => onSelect("all")} className="btn-secondary text-xs py-2 px-3 shrink-0">
          Reset
        </button>
      </div>
    </div>
  );
}
