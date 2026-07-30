export type Guide = {
  id: string;
  href: string;
  title: string;
  shortTitle: string;
  description: string;
  category: string;
  image: string;
  imageAlt: string;
  readingTime: string;
};

export type Article = Omit<Guide, "id" | "href"> & {
  slug: string;
};

export const articles: Article[] = [
  {
    slug: "reverse-engineering-worn-parts",
    title: "Reverse Engineering Worn Parts: From Sample to Finished Component",
    shortTitle: "Reverse engineering worn parts",
    description:
      "How a worn, obsolete or damaged component can be measured, interpreted and remade as a useful machined replacement.",
    category: "Custom Engineering",
    image: "/articles/reverse-engineering-worn-parts/hero.jpg",
    imageAlt: "Thread cutting a replacement component on a lathe",
    readingTime: "9 min read",
  },
  {
    slug: "metal-grades-and-uses",
    title: "Metal Grades and Uses: A Machining Guide",
    shortTitle: "Metal grades and uses",
    description:
      "A practical guide to EN1A, EN3, EN8, EN16, EN19 and EN24 steel grades, including common uses, machining characteristics and finishing advice.",
    category: "Materials",
    image: "/articles/metal-grades/en8d.jpg",
    imageAlt: "EN8 engineering steel and a machined component",
    readingTime: "10 min read",
  },
  {
    slug: "what-en-and-bs970-mean",
    title: "What Do EN and BS970 Steel Grades Mean?",
    shortTitle: "What EN and BS970 mean",
    description:
      "Understand traditional EN steel numbers and how to read BS970 designations such as 080M40, including steel type, supply condition and carbon content.",
    category: "Materials",
    image: "/articles/en-bs970/meaning.jpg",
    imageAlt: "Engineering steel grade reference for EN and BS970 specifications",
    readingTime: "6 min read",
  },
  {
    slug: "heat-treating-tool-steel",
    title: "How to Heat Treat and Temper Tool Steel",
    shortTitle: "Heat treating tool steel",
    description:
      "An introductory workshop guide to hardening and tempering gauge plate, silver steel and O1 tool steel, from pre-heating and quenching to final tempering.",
    category: "Workshop Guides",
    image: "/articles/heat-treatment/hero.jpg",
    imageAlt: "Tool steel being heated in a workshop",
    readingTime: "11 min read",
  },
  {
    slug: "how-to-use-a-dividing-head",
    title: "How to Use a Dividing Head or Rotary Index Table",
    shortTitle: "Using a dividing head",
    description:
      "A practical introduction to dividing heads, rotary tables, hole plates and sector arms, with a worked example for calculating equal divisions.",
    category: "Workshop Guides",
    image: "/articles/dividing-head/hero.jpg",
    imageAlt: "Dividing head and rotary index table in a machine workshop",
    readingTime: "12 min read",
  },
];

export const guides: Guide[] = [
  {
    id: "custom-engineering-guide",
    href: "/custom-engineering/guide",
    title: "Custom Engineering: From Drawing to Finished Part",
    shortTitle: "Custom engineering guide",
    description:
      "See the files we accept, materials we hold and the cutting, folding, machining and fabrication capabilities available for custom parts.",
    category: "Custom Engineering",
    image: "/custom-engineering/cnc-machining.jpg",
    imageAlt: "CNC machining in the M-Machine workshop",
    readingTime: "8 min read",
  },
  ...articles.map((article) => ({
    ...article,
    id: article.slug,
    href: `/articles/${article.slug}`,
  })),
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function articleUrl(article: Article) {
  return `/articles/${article.slug}`;
}

export function guideUrl(guide: Guide) {
  return guide.href;
}
