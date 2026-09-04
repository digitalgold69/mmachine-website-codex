import type { Section } from "@/lib/mini-data";

export const MANUAL_MINI_SECTION_CODE = "other";

export const manualMiniSection: Section = {
  code: MANUAL_MINI_SECTION_CODE,
  label: "OTHER",
  subtitle: "Manually added Mini panel parts",
  order: 999,
  mode: "exterior",
};
