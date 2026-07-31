import { sections, type Section } from "@/lib/mini-data";

export const MINI_CATALOGUE_FRONT_PAGE_COUNT = 3;
export const MINI_NUMBERED_SECTION_PAGE_COUNT = 2;

const numberedSections = sections.filter((section) => /^\d+$/.test(section.code));
const appendixPageIndexes: Record<string, number[]> = {
  Apx1: [39],
  Apx2: [40],
};

export function getMiniSectionForPdf(sectionCode: string): Section | null {
  return sections.find((section) => section.code.toLowerCase() === sectionCode.toLowerCase()) || null;
}

export function miniSectionPdfPageIndexes(sectionCode: string) {
  const section = getMiniSectionForPdf(sectionCode);
  if (!section) return null;

  if (/^\d+$/.test(section.code)) {
    const numberedIndex = numberedSections.findIndex((item) => item.code === section.code);
    if (numberedIndex < 0) return null;
    const start = MINI_CATALOGUE_FRONT_PAGE_COUNT + numberedIndex * MINI_NUMBERED_SECTION_PAGE_COUNT;
    return [start, start + 1];
  }

  return appendixPageIndexes[section.code] || null;
}

export function miniSectionPdfFilename(section: Section) {
  const label = section.label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `m-machine-mini-section-${section.code.toLowerCase()}${label ? `-${label}` : ""}.pdf`;
}
