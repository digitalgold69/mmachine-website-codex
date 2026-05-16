"use client";

import { useState } from "react";
import { sections, getSection, type SectionMode } from "@/lib/mini-data";

type Props = {
  selectedSection: string;
  onSelect: (code: string) => void;
};

type View = "side" | "front" | "rear" | "top";

// Define which sections highlight which SVG zones on each view
// Each view names a set of <path> IDs that belong to a section
const VIEW_HAS_SECTION: Record<View, string[]> = {
  side: ["120", "130", "140", "150", "160", "130sill", "wheelarch", "150door", "160wing", "160roof"],
  front: ["170", "160", "160wing", "210"],
  rear: ["120", "420"],
  top: ["160", "310", "340", "510", "410", "420", "350", "220", "230"],
};

export default function MiniDiagram({ selectedSection, onSelect }: Props) {
  const [view, setView] = useState<View>("side");
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<SectionMode>("exterior");

  const sel = selectedSection;
  const hov = hovered;

  const zoneFill = (section: string, baseFill: string) => {
    if (sel === section) return "#DF1718";
    if (hov === section) return "#F0443A";
    return baseFill;
  };

  const zoneOpacity = (section: string, isInterior: boolean) => {
    if (mode === "exterior" && isInterior) return 0;
    if (mode === "interior" && !isInterior) return 0.15;
    return 1;
  };

  const zoneStroke = (section: string) => {
    if (sel === section) return "#A30E13";
    if (hov === section) return "#A30E13";
    return "#08241C";
  };

  const interactiveProps = (section: string, isInterior = false) => ({
    onClick: () => onSelect(section),
    onMouseEnter: () => setHovered(section),
    onMouseLeave: () => setHovered(null),
    style: {
      cursor: "pointer",
      transition: "fill 0.15s ease, stroke 0.15s ease, opacity 0.2s ease",
      opacity: zoneOpacity(section, isInterior),
    },
  });

  const selSec = getSection(selectedSection);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-racing/10" style={{ background: "linear-gradient(180deg, #F5EFE0 0%, #EAE0C8 100%)" }}>
      <div className="relative h-[520px] flex items-center justify-center p-6">
        {view === "side" && <SideView interactiveProps={interactiveProps} zoneFill={zoneFill} zoneStroke={zoneStroke} mode={mode} />}
        {view === "front" && <FrontView interactiveProps={interactiveProps} zoneFill={zoneFill} zoneStroke={zoneStroke} mode={mode} />}
        {view === "rear" && <RearView interactiveProps={interactiveProps} zoneFill={zoneFill} zoneStroke={zoneStroke} mode={mode} />}
        {view === "top" && <TopView interactiveProps={interactiveProps} zoneFill={zoneFill} zoneStroke={zoneStroke} mode={mode} />}
      </div>

      {/* Instruction badge */}
      <div className="absolute top-4 left-4 bg-racing/90 text-cream px-3 py-1.5 rounded-md text-[11px] tracking-wider pointer-events-none">
        CLICK A SECTION · SWITCH VIEWS BELOW
      </div>

      {/* Exterior/Interior mode toggle */}
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

      {/* View switcher */}
      <div className="absolute top-20 right-4 bg-white/95 rounded-lg p-1 flex flex-col gap-1 border border-racing/10">
        {(["side", "front", "rear", "top"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded text-[11px] font-semibold tracking-wider transition-colors ${
              view === v ? "bg-racing text-cream" : "text-racing hover:bg-cream-dark"
            }`}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Readout bar */}
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

// ============================================================
// Shared view props
// ============================================================
type ViewProps = {
  interactiveProps: (section: string, isInterior?: boolean) => any;
  zoneFill: (section: string, baseFill: string) => string;
  zoneStroke: (section: string) => string;
  mode: SectionMode;
};

// ============================================================
// SIDE VIEW — the classic Mini silhouette
// This is the primary view: shows most sections
// ============================================================
function SideView({ interactiveProps, zoneFill, zoneStroke, mode }: ViewProps) {
  const BRG = "#0F3D2E";
  const BRG_LIGHT = "#155040";
  const CREAM = "#F5EFE0";
  const DARK = "#08241C";
  const CHROME = "#C4BDA8";
  const STEEL = "#3a3a3a";
  const STEEL_LIGHT = "#5a5a5a";

  return (
    <svg viewBox="0 0 800 400" className="w-full h-full max-h-[460px]" xmlns="http://www.w3.org/2000/svg">
      {/* Ground shadow */}
      <ellipse cx="400" cy="335" rx="320" ry="12" fill="#000" opacity="0.12" />

      {/* ==================== EXTERIOR LAYER ==================== */}

      {/* Main body/sides — Section 130 (SIDE REPAIRS) */}
      <path
        d="M 130 200 Q 130 170 170 160 L 670 160 Q 710 170 710 200 L 710 310 L 130 310 Z"
        fill={zoneFill("130", BRG)}
        stroke={zoneStroke("130")}
        strokeWidth="2"
        {...interactiveProps("130")}
      />

      {/* Roof — Section 160 (FRONT & ROOF) */}
      <path
        d="M 240 95 Q 310 75 400 75 Q 490 75 560 95 L 565 165 L 235 165 Z"
        fill={zoneFill("160", CREAM)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Bonnet slope — Section 160 (continuation) */}
      <path
        d="M 130 200 Q 140 175 170 165 L 240 160 L 245 200 Z"
        fill={zoneFill("160", BRG_LIGHT)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Front wing arch (right side of mini when looking at side view) — Section 160 */}
      <path
        d="M 130 200 L 245 200 L 245 270 Q 215 265 175 270 Q 150 270 130 265 Z"
        fill={zoneFill("160", BRG)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Door — Section 150 (DOORS) */}
      <path
        d="M 275 165 L 275 305 L 475 305 L 475 165 Z"
        fill={zoneFill("150", BRG_LIGHT)}
        stroke={zoneStroke("150")}
        strokeWidth="2"
        {...interactiveProps("150")}
      />

      {/* Quarter panel (behind door) — Section 140 (SIDE REPAIRS Traveller/quarter) */}
      <path
        d="M 475 165 L 475 305 L 590 305 L 590 165 Z"
        fill={zoneFill("140", BRG)}
        stroke={zoneStroke("140")}
        strokeWidth="2"
        {...interactiveProps("140")}
      />

      {/* Rear boot panel / hatch area — Section 120 (REAR PANEL) */}
      <path
        d="M 590 165 L 705 170 L 710 200 L 710 305 L 590 305 Z"
        fill={zoneFill("120", BRG_LIGHT)}
        stroke={zoneStroke("120")}
        strokeWidth="2"
        {...interactiveProps("120")}
      />

      {/* Lower sill strip — Section 130 */}
      <path
        d="M 150 305 L 680 305 L 680 318 L 150 318 Z"
        fill={zoneFill("130", DARK)}
        stroke={zoneStroke("130")}
        strokeWidth="1.5"
        {...interactiveProps("130")}
      />

      {/* Side window (non-interactive glass — fades with shell) */}
      <g style={{ opacity: mode === "interior" ? 0.1 : 1, transition: "opacity 0.2s" }} pointerEvents="none">
        <path d="M 260 100 Q 320 88 395 88 Q 480 88 555 100 L 555 160 L 260 160 Z" fill="#1f2f2a" opacity="0.55" />
        {/* Window frame vertical divider (B-pillar) */}
        <line x1="475" y1="90" x2="475" y2="165" stroke={DARK} strokeWidth="3" />
      </g>

      {/* Wheel arches (outer black trim) */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.15 : 1, transition: "opacity 0.2s" }}>
        <path d="M 155 310 Q 155 240 210 235 Q 265 240 265 310 Z" fill={DARK} />
        <path d="M 555 310 Q 555 240 610 235 Q 665 240 665 310 Z" fill={DARK} />
      </g>

      {/* Wheels */}
      <g pointerEvents="none">
        <circle cx="210" cy="315" r="42" fill="#111" />
        <circle cx="210" cy="315" r="28" fill="#444" />
        <circle cx="210" cy="315" r="18" fill={CHROME} />
        <circle cx="210" cy="315" r="8" fill="#888" />
        <circle cx="610" cy="315" r="42" fill="#111" />
        <circle cx="610" cy="315" r="28" fill="#444" />
        <circle cx="610" cy="315" r="18" fill={CHROME} />
        <circle cx="610" cy="315" r="8" fill="#888" />
      </g>

      {/* Bumpers */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }}>
        <rect x="118" y="255" width="18" height="12" rx="4" fill={CHROME} />
        <rect x="708" y="255" width="18" height="12" rx="4" fill={CHROME} />
      </g>

      {/* Door handle */}
      <rect x="380" y="225" width="28" height="6" rx="2" fill={CHROME} pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Wing mirror */}
      <ellipse cx="268" cy="180" rx="10" ry="7" fill={CHROME} pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Small detail: fuel cap */}
      <circle cx="635" cy="195" r="5" fill={CHROME} pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* ==================== INTERIOR LAYER ==================== */}
      {/* These show when mode=interior */}

      {/* Floor pan (hidden under body) — Section 310 */}
      <path
        d="M 150 290 L 660 290 L 665 315 L 145 315 Z"
        fill={zoneFill("310", STEEL)}
        stroke={zoneStroke("310")}
        strokeWidth="1.5"
        {...interactiveProps("310", true)}
      />

      {/* Toeboard — Section 350 */}
      <path
        d="M 145 240 L 180 225 L 180 290 L 150 290 Z"
        fill={zoneFill("350", STEEL_LIGHT)}
        stroke={zoneStroke("350")}
        strokeWidth="1.5"
        {...interactiveProps("350", true)}
      />

      {/* Front inner wing (partial, inside right wheel arch) — Section 210 */}
      <path
        d="M 155 235 L 265 235 L 260 275 L 155 275 Z"
        fill={zoneFill("210", "#0a2e22")}
        stroke={zoneStroke("210")}
        strokeWidth="1.5"
        {...interactiveProps("210", true)}
      />

      {/* Front bulkhead — Section 230 */}
      <path
        d="M 180 190 L 250 190 L 250 290 L 180 290 Z"
        fill={zoneFill("230", "#4a4a4a")}
        stroke={zoneStroke("230")}
        strokeWidth="1.5"
        {...interactiveProps("230", true)}
      />

      {/* Front bulkhead cooling / radiator area — Section 220 */}
      <path
        d="M 145 200 L 175 195 L 175 265 L 145 265 Z"
        fill={zoneFill("220", "#555")}
        stroke={zoneStroke("220")}
        strokeWidth="1.5"
        {...interactiveProps("220", true)}
      />

      {/* Rear bulkhead — Section 420 */}
      <path
        d="M 500 180 L 540 180 L 540 290 L 500 290 Z"
        fill={zoneFill("420", "#4a4a4a")}
        stroke={zoneStroke("420")}
        strokeWidth="1.5"
        {...interactiveProps("420", true)}
      />

      {/* Boot floor — Section 410 */}
      <path
        d="M 540 270 L 665 270 L 665 295 L 540 295 Z"
        fill={zoneFill("410", "#3a3a3a")}
        stroke={zoneStroke("410")}
        strokeWidth="1.5"
        {...interactiveProps("410", true)}
      />

      {/* Rear assembly (battery/tank area) — Section 430 */}
      <path
        d="M 540 225 L 630 225 L 630 270 L 540 270 Z"
        fill={zoneFill("430", "#555")}
        stroke={zoneStroke("430")}
        strokeWidth="1.5"
        {...interactiveProps("430", true)}
      />

      {/* Subframe front — Section 510 */}
      <path
        d="M 165 295 L 270 295 L 270 320 L 165 320 Z"
        fill={zoneFill("510", "#2a2a2a")}
        stroke={zoneStroke("510")}
        strokeWidth="1.5"
        {...interactiveProps("510", true)}
      />

      {/* Subframe rear — Section 510 */}
      <path
        d="M 560 295 L 660 295 L 660 320 L 560 320 Z"
        fill={zoneFill("510", "#2a2a2a")}
        stroke={zoneStroke("510")}
        strokeWidth="1.5"
        {...interactiveProps("510", true)}
      />

      {/* Floor assembly (tunnel / crossmember) — Section 340 */}
      <path
        d="M 270 270 L 500 270 L 500 295 L 270 295 Z"
        fill={zoneFill("340", "#4a4a4a")}
        stroke={zoneStroke("340")}
        strokeWidth="1.5"
        {...interactiveProps("340", true)}
      />

      {/* Floor repair mid-panel — Section 320 (smaller area inside floor) */}
      <path
        d="M 290 275 L 480 275 L 480 290 L 290 290 Z"
        fill={zoneFill("320", "#555")}
        stroke={zoneStroke("320")}
        strokeWidth="1"
        {...interactiveProps("320", true)}
      />

      {/* Flat floor (van/traveller rear) — Section 330 */}
      <path
        d="M 475 275 L 555 275 L 555 290 L 475 290 Z"
        fill={zoneFill("330", "#5a5a5a")}
        stroke={zoneStroke("330")}
        strokeWidth="1"
        {...interactiveProps("330", true)}
      />

      {/* Dash / accessories — Section Apx1 */}
      <path
        d="M 240 165 L 275 165 L 275 210 L 240 210 Z"
        fill={zoneFill("Apx1", "#3a2e1a")}
        stroke={zoneStroke("Apx1")}
        strokeWidth="1.5"
        {...interactiveProps("Apx1", true)}
      />

      {/* Switch panel — Section Apx2 */}
      <path
        d="M 245 175 L 270 175 L 270 200 L 245 200 Z"
        fill={zoneFill("Apx2", "#4a4a4a")}
        stroke={zoneStroke("Apx2")}
        strokeWidth="1"
        {...interactiveProps("Apx2", true)}
      />
    </svg>
  );
}

// ============================================================
// FRONT VIEW — shows grille, headlights, bonnet, wings
// ============================================================
function FrontView({ interactiveProps, zoneFill, zoneStroke, mode }: ViewProps) {
  const BRG = "#0F3D2E";
  const BRG_LIGHT = "#155040";
  const CREAM = "#F5EFE0";
  const DARK = "#08241C";
  const CHROME = "#C4BDA8";

  return (
    <svg viewBox="0 0 800 400" className="w-full h-full max-h-[460px]" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="400" cy="345" rx="260" ry="10" fill="#000" opacity="0.12" />

      {/* Roof — Section 160 */}
      <path
        d="M 300 70 Q 400 55 500 70 L 490 110 L 310 110 Z"
        fill={zoneFill("160", CREAM)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Windscreen area */}
      <path
        d="M 310 110 L 490 110 L 475 175 L 325 175 Z"
        fill="#1f2f2a"
        opacity={mode === "interior" ? 0.1 : 0.7}
        pointerEvents="none"
        style={{ transition: "opacity 0.2s" }}
      />

      {/* Bonnet (large front panel) — Section 160 */}
      <path
        d="M 300 175 L 500 175 L 510 250 L 290 250 Z"
        fill={zoneFill("160", BRG_LIGHT)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Left front wing (outer) — Section 160 */}
      <path
        d="M 200 190 Q 200 170 230 165 L 300 175 L 290 260 L 200 265 Z"
        fill={zoneFill("160", BRG)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Right front wing (outer) — Section 160 */}
      <path
        d="M 500 175 L 570 165 Q 600 170 600 190 L 600 265 L 510 260 Z"
        fill={zoneFill("160", BRG)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Front panel (grille surround area) — Section 170 */}
      <path
        d="M 320 250 L 480 250 L 485 310 L 315 310 Z"
        fill={zoneFill("170", CHROME)}
        stroke={zoneStroke("170")}
        strokeWidth="2"
        {...interactiveProps("170")}
      />

      {/* Grille slats */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.2 : 1, transition: "opacity 0.2s" }}>
        {[260, 270, 280, 290, 300].map((y) => (
          <rect key={y} x="330" y={y} width="140" height="2" fill="#333" />
        ))}
      </g>

      {/* Headlights */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }}>
        <circle cx="250" cy="230" r="28" fill={CHROME} />
        <circle cx="250" cy="230" r="22" fill="#FFF5CC" />
        <circle cx="250" cy="230" r="8" fill="#fff" opacity="0.6" />
        <circle cx="550" cy="230" r="28" fill={CHROME} />
        <circle cx="550" cy="230" r="22" fill="#FFF5CC" />
        <circle cx="550" cy="230" r="8" fill="#fff" opacity="0.6" />
      </g>

      {/* Number plate */}
      <rect x="355" y="275" width="90" height="22" rx="2" fill="#FFFFCC" pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Bumper */}
      <rect x="175" y="300" width="450" height="14" rx="6" fill={CHROME} pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Wheels (visible at sides) */}
      <g pointerEvents="none">
        <circle cx="180" cy="320" r="25" fill="#111" />
        <circle cx="180" cy="320" r="15" fill={CHROME} />
        <circle cx="620" cy="320" r="25" fill="#111" />
        <circle cx="620" cy="320" r="15" fill={CHROME} />
      </g>

      {/* Wing mirrors */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }}>
        <circle cx="250" cy="155" r="8" fill={CHROME} />
        <circle cx="550" cy="155" r="8" fill={CHROME} />
      </g>

      {/* ==================== INTERIOR LAYER ==================== */}

      {/* Inner wings — Section 210 */}
      <path
        d="M 220 195 L 290 195 L 290 255 L 220 255 Z"
        fill={zoneFill("210", "#0a2e22")}
        stroke={zoneStroke("210")}
        strokeWidth="1.5"
        {...interactiveProps("210", true)}
      />
      <path
        d="M 510 195 L 580 195 L 580 255 L 510 255 Z"
        fill={zoneFill("210", "#0a2e22")}
        stroke={zoneStroke("210")}
        strokeWidth="1.5"
        {...interactiveProps("210", true)}
      />
    </svg>
  );
}

// ============================================================
// REAR VIEW — shows boot lid, rear panel, tail lights, rear bulkhead
// ============================================================
function RearView({ interactiveProps, zoneFill, zoneStroke, mode }: ViewProps) {
  const BRG = "#0F3D2E";
  const BRG_LIGHT = "#155040";
  const CREAM = "#F5EFE0";
  const DARK = "#08241C";
  const CHROME = "#C4BDA8";

  return (
    <svg viewBox="0 0 800 400" className="w-full h-full max-h-[460px]" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="400" cy="345" rx="260" ry="10" fill="#000" opacity="0.12" />

      {/* Roof */}
      <path
        d="M 300 70 Q 400 55 500 70 L 490 110 L 310 110 Z"
        fill={zoneFill("160", CREAM)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Rear window (glass) */}
      <path
        d="M 310 110 L 490 110 L 475 175 L 325 175 Z"
        fill="#1f2f2a"
        opacity={mode === "interior" ? 0.1 : 0.6}
        pointerEvents="none"
        style={{ transition: "opacity 0.2s" }}
      />

      {/* Rear body side panels (quarter panels, part of sides section 140) */}
      <path
        d="M 200 175 Q 200 165 220 160 L 300 175 L 290 260 L 200 265 Z"
        fill={zoneFill("140", BRG)}
        stroke={zoneStroke("140")}
        strokeWidth="2"
        {...interactiveProps("140")}
      />
      <path
        d="M 500 175 L 580 160 Q 600 165 600 175 L 600 265 L 510 260 Z"
        fill={zoneFill("140", BRG)}
        stroke={zoneStroke("140")}
        strokeWidth="2"
        {...interactiveProps("140")}
      />

      {/* Rear panel + boot lid — Section 120 (REAR PANEL) */}
      <path
        d="M 290 175 L 510 175 L 510 270 L 290 270 Z"
        fill={zoneFill("120", BRG_LIGHT)}
        stroke={zoneStroke("120")}
        strokeWidth="2"
        {...interactiveProps("120")}
      />

      {/* Boot lid detail lines */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.2 : 1, transition: "opacity 0.2s" }}>
        <line x1="290" y1="185" x2="510" y2="185" stroke={DARK} strokeWidth="1.5" />
        <line x1="295" y1="230" x2="505" y2="230" stroke={DARK} strokeWidth="1.5" />
      </g>

      {/* Rear valance (bottom strip of rear) */}
      <path
        d="M 200 270 L 600 270 L 600 305 L 200 305 Z"
        fill={zoneFill("120", DARK)}
        stroke={zoneStroke("120")}
        strokeWidth="1.5"
        {...interactiveProps("120")}
      />

      {/* Tail lights */}
      <g pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }}>
        <rect x="220" y="230" width="55" height="30" rx="4" fill="#881111" />
        <rect x="525" y="230" width="55" height="30" rx="4" fill="#881111" />
        <rect x="220" y="232" width="55" height="4" rx="1" fill="#EEB" />
      </g>

      {/* Number plate */}
      <rect x="355" y="230" width="90" height="28" rx="2" fill="#FFFFCC" stroke="#666" strokeWidth="0.5" pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Bumper */}
      <rect x="175" y="295" width="450" height="14" rx="6" fill={CHROME} pointerEvents="none" style={{ opacity: mode === "interior" ? 0.3 : 1, transition: "opacity 0.2s" }} />

      {/* Wheels */}
      <g pointerEvents="none">
        <circle cx="180" cy="320" r="25" fill="#111" />
        <circle cx="180" cy="320" r="15" fill={CHROME} />
        <circle cx="620" cy="320" r="25" fill="#111" />
        <circle cx="620" cy="320" r="15" fill={CHROME} />
      </g>

      {/* ==================== INTERIOR LAYER ==================== */}

      {/* Rear bulkhead — Section 420 */}
      <path
        d="M 310 185 L 490 185 L 490 260 L 310 260 Z"
        fill={zoneFill("420", "#4a4a4a")}
        stroke={zoneStroke("420")}
        strokeWidth="1.5"
        {...interactiveProps("420", true)}
      />

      {/* Boot floor — Section 410 */}
      <path
        d="M 300 260 L 500 260 L 500 275 L 300 275 Z"
        fill={zoneFill("410", "#3a3a3a")}
        stroke={zoneStroke("410")}
        strokeWidth="1.5"
        {...interactiveProps("410", true)}
      />

      {/* Rear assembly — Section 430 (battery/tank area, either side) */}
      <path
        d="M 220 200 L 300 200 L 300 260 L 220 260 Z"
        fill={zoneFill("430", "#555")}
        stroke={zoneStroke("430")}
        strokeWidth="1.5"
        {...interactiveProps("430", true)}
      />
      <path
        d="M 500 200 L 580 200 L 580 260 L 500 260 Z"
        fill={zoneFill("430", "#555")}
        stroke={zoneStroke("430")}
        strokeWidth="1.5"
        {...interactiveProps("430", true)}
      />
    </svg>
  );
}

// ============================================================
// TOP VIEW — looking straight down, shows floor pans, subframes, etc.
// ============================================================
function TopView({ interactiveProps, zoneFill, zoneStroke, mode }: ViewProps) {
  const BRG = "#0F3D2E";
  const BRG_LIGHT = "#155040";
  const CREAM = "#F5EFE0";
  const DARK = "#08241C";
  const CHROME = "#C4BDA8";

  return (
    <svg viewBox="0 0 800 400" className="w-full h-full max-h-[460px]" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="400" cy="360" rx="280" ry="10" fill="#000" opacity="0.1" />

      {/* ==================== EXTERIOR (top-down) ==================== */}

      {/* Body outline / roof (top-down silhouette of the Mini) */}
      <path
        d="M 160 150 Q 160 110 200 100 L 260 92 L 540 92 L 600 100 Q 640 110 640 150 L 640 250 Q 640 290 600 300 L 540 308 L 260 308 L 200 300 Q 160 290 160 250 Z"
        fill={zoneFill("160", CREAM)}
        stroke={zoneStroke("160")}
        strokeWidth="2"
        {...interactiveProps("160")}
      />

      {/* Bonnet outline (front portion) */}
      <path
        d="M 160 150 L 260 150 L 260 250 L 160 250 Z"
        fill={zoneFill("160", BRG_LIGHT)}
        stroke={zoneStroke("160")}
        strokeWidth="1.5"
        fillOpacity={mode === "interior" ? 1 : 0.3}
        {...interactiveProps("160")}
      />

      {/* Rear panel from top — Section 120 */}
      <path
        d="M 540 150 L 640 150 L 640 250 L 540 250 Z"
        fill={zoneFill("120", BRG)}
        stroke={zoneStroke("120")}
        strokeWidth="1.5"
        fillOpacity={mode === "interior" ? 1 : 0.3}
        {...interactiveProps("120")}
      />

      {/* Wheels (top-down — round pills) */}
      <g pointerEvents="none">
        <ellipse cx="225" cy="105" rx="18" ry="10" fill="#111" />
        <ellipse cx="575" cy="105" rx="18" ry="10" fill="#111" />
        <ellipse cx="225" cy="295" rx="18" ry="10" fill="#111" />
        <ellipse cx="575" cy="295" rx="18" ry="10" fill="#111" />
      </g>

      {/* ==================== INTERIOR LAYER (structural from above) ==================== */}

      {/* Main floor pan — Section 310 */}
      <path
        d="M 260 160 L 540 160 L 540 240 L 260 240 Z"
        fill={zoneFill("310", "#3a3a3a")}
        stroke={zoneStroke("310")}
        strokeWidth="1.5"
        {...interactiveProps("310", true)}
      />

      {/* Floor repair panels (the two halves) — Section 320 */}
      <path d="M 275 170 L 395 170 L 395 195 L 275 195 Z" fill={zoneFill("320", "#4a4a4a")} stroke={zoneStroke("320")} strokeWidth="1" {...interactiveProps("320", true)} />
      <path d="M 405 170 L 525 170 L 525 195 L 405 195 Z" fill={zoneFill("320", "#4a4a4a")} stroke={zoneStroke("320")} strokeWidth="1" {...interactiveProps("320", true)} />
      <path d="M 275 205 L 395 205 L 395 230 L 275 230 Z" fill={zoneFill("320", "#4a4a4a")} stroke={zoneStroke("320")} strokeWidth="1" {...interactiveProps("320", true)} />
      <path d="M 405 205 L 525 205 L 525 230 L 405 230 Z" fill={zoneFill("320", "#4a4a4a")} stroke={zoneStroke("320")} strokeWidth="1" {...interactiveProps("320", true)} />

      {/* Flat floor (rear Van/Traveller) — Section 330 */}
      <path
        d="M 540 170 L 620 170 L 620 230 L 540 230 Z"
        fill={zoneFill("330", "#555")}
        stroke={zoneStroke("330")}
        strokeWidth="1.5"
        {...interactiveProps("330", true)}
      />

      {/* Tunnel crossmember running down the centre — Section 340 */}
      <path
        d="M 395 155 L 405 155 L 405 245 L 395 245 Z"
        fill={zoneFill("340", "#5a5a5a")}
        stroke={zoneStroke("340")}
        strokeWidth="1.5"
        {...interactiveProps("340", true)}
      />

      {/* Toeboard (front end of floor) — Section 350 */}
      <path
        d="M 245 160 L 265 160 L 265 240 L 245 240 Z"
        fill={zoneFill("350", "#4a4a4a")}
        stroke={zoneStroke("350")}
        strokeWidth="1.5"
        {...interactiveProps("350", true)}
      />

      {/* Front subframe — Section 510 */}
      <path
        d="M 185 160 L 265 160 L 265 240 L 185 240 Z"
        fill={zoneFill("510", "#2a2a2a")}
        stroke={zoneStroke("510")}
        strokeWidth="1.5"
        {...interactiveProps("510", true)}
      />

      {/* Rear subframe — Section 510 */}
      <path
        d="M 540 160 L 620 160 L 620 240 L 540 240 Z"
        fill={zoneFill("510", "#2a2a2a")}
        stroke={zoneStroke("510")}
        strokeWidth="1.5"
        fillOpacity="0.6"
        {...interactiveProps("510", true)}
      />

      {/* Front bulkhead (running across, behind engine bay) — Section 230 */}
      <path
        d="M 255 158 L 275 158 L 275 242 L 255 242 Z"
        fill={zoneFill("230", "#666")}
        stroke={zoneStroke("230")}
        strokeWidth="1.5"
        {...interactiveProps("230", true)}
      />

      {/* Front bulkhead cooling / rad cowl — Section 220 */}
      <path
        d="M 170 178 L 195 178 L 195 222 L 170 222 Z"
        fill={zoneFill("220", "#555")}
        stroke={zoneStroke("220")}
        strokeWidth="1.5"
        {...interactiveProps("220", true)}
      />

      {/* Rear bulkhead — Section 420 */}
      <path
        d="M 518 158 L 538 158 L 538 242 L 518 242 Z"
        fill={zoneFill("420", "#666")}
        stroke={zoneStroke("420")}
        strokeWidth="1.5"
        {...interactiveProps("420", true)}
      />

      {/* Boot floor — Section 410 */}
      <path
        d="M 540 175 L 620 175 L 620 225 L 540 225 Z"
        fill={zoneFill("410", "#4a4a4a")}
        stroke={zoneStroke("410")}
        strokeWidth="1"
        fillOpacity="0.7"
        {...interactiveProps("410", true)}
      />

      {/* Front inner wings — Section 210 */}
      <path
        d="M 195 160 L 240 160 L 240 175 L 195 175 Z"
        fill={zoneFill("210", "#0a2e22")}
        stroke={zoneStroke("210")}
        strokeWidth="1.5"
        {...interactiveProps("210", true)}
      />
      <path
        d="M 195 225 L 240 225 L 240 240 L 195 240 Z"
        fill={zoneFill("210", "#0a2e22")}
        stroke={zoneStroke("210")}
        strokeWidth="1.5"
        {...interactiveProps("210", true)}
      />
    </svg>
  );
}
