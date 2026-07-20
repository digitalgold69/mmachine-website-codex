import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ArticleContent from "@/components/ArticleContent";
import { articleUrl, articles, getArticle } from "@/lib/articles";
import { absoluteUrl, breadcrumbJsonLd, jsonLdScript, openGraphImage } from "@/lib/seo";

type PageProps = {
  params: Promise<{ articleSlug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((article) => ({ articleSlug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { articleSlug } = await params;
  const article = getArticle(articleSlug);
  if (!article) return {};

  const path = articleUrl(article);
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title: `${article.title} | M-Machine`,
      description: article.description,
      url: absoluteUrl(path),
      type: "article",
      images: openGraphImage(article.image, article.imageAlt),
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { articleSlug } = await params;
  const article = getArticle(articleSlug);
  if (!article) notFound();

  const path = articleUrl(article);
  const related = articles.filter((entry) => entry.slug !== article.slug);
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Engineering Guides", path: "/articles" },
    { name: article.shortTitle, path },
  ]);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: article.description,
    image: absoluteUrl(article.image),
    mainEntityOfPage: absoluteUrl(path),
    author: { "@type": "Organization", name: "M-Machine", url: absoluteUrl("/") },
    publisher: { "@type": "Organization", name: "M-Machine", url: absoluteUrl("/") },
    about: article.category,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(articleSchema)} />

      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/articles" className="hover:text-racing">Engineering Guides</Link>
        <span className="mx-2">/</span>
        <span>{article.shortTitle}</span>
      </nav>

      <article>
        <header className="max-w-4xl mb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <span>{article.category}</span>
            <span aria-hidden="true">&middot;</span>
            <span className="text-ink-muted">{article.readingTime}</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight text-racing mb-4">{article.title}</h1>
          <p className="max-w-3xl text-lg leading-8 text-ink-muted">{article.description}</p>
        </header>

        <div className="relative mb-10 aspect-[1366/300] overflow-hidden rounded-lg bg-cream-dark">
          <Image
            src={article.image}
            alt={article.imageAlt}
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,800px)_280px] lg:justify-between">
          <div className="min-w-0">
            <ArticleContent slug={article.slug} />

            <section className="mt-12 rounded-lg bg-racing p-7 text-cream">
              <h2 className="font-display text-2xl mb-3">Need help choosing a material or process?</h2>
              <p className="mb-5 max-w-2xl text-sm leading-7 text-cream/80">
                Send us the grade, dimensions, drawing or a description of the job. We will help you identify the next step.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact" className="btn-gold">Ask M-Machine</Link>
                <Link href="/catalogue/metals" className="inline-flex items-center rounded-lg border border-cream/40 px-5 py-3 text-sm font-semibold hover:bg-cream hover:text-racing">
                  Browse metals
                </Link>
              </div>
            </section>
          </div>

          <aside className="lg:pt-2">
            <div className="sticky top-28 border-t-4 border-gold bg-cream-dark p-5">
              <h2 className="font-display text-xl text-racing mb-4">More engineering guides</h2>
              <ul className="space-y-4">
                {related.map((entry) => (
                  <li key={entry.slug}>
                    <Link href={articleUrl(entry)} className="group block">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-gold">{entry.category}</span>
                      <span className="mt-1 block text-sm font-semibold leading-6 text-racing group-hover:text-gold">
                        {entry.shortTitle}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/articles" className="mt-5 inline-flex text-sm font-semibold text-racing hover:text-gold">
                View all guides <span aria-hidden="true" className="ml-1">&rarr;</span>
              </Link>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
