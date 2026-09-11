import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, openGraphImage } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How M-Machine handles personal information submitted through its website, order forms and custom engineering quote forms.",
  alternates: { canonical: absoluteUrl("/privacy") },
  openGraph: {
    title: "Privacy Policy | M-Machine",
    description: "How M-Machine handles personal information submitted through its website.",
    url: absoluteUrl("/privacy"),
    type: "website",
    images: openGraphImage(),
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-racing">Home</Link> / Privacy policy
      </nav>
      <h1 className="font-display text-4xl text-racing">Privacy policy</h1>
      <p className="mt-3 text-sm text-ink-muted">Last updated 11 September 2026</p>

      <div className="mt-9 space-y-9 text-sm leading-7 text-ink-muted">
        <section>
          <h2 className="font-display text-2xl text-racing">Who we are</h2>
          <p className="mt-2">
            M-Machine is operated by Craftgrange Limited, company number 01476185, from Unit 6 Forge Way,
            Cleveland Trading Estate, Darlington, County Durham, DL1 2PJ.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">Information we collect</h2>
          <p className="mt-2">
            When you contact us or request an order or custom engineering quote, we may collect your name,
            company, email address, telephone number, delivery address, order details, messages and any files
            you choose to upload. We also keep the dates and status of requests so we can manage them properly.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">How we use it</h2>
          <p className="mt-2">
            We use this information to answer enquiries, check requirements, prepare quotes and invoices,
            arrange delivery or collection, provide the requested work, keep business and accounting records,
            and protect the website from misuse. We do not sell personal information.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">Storage and service providers</h2>
          <p className="mt-2">
            Website requests and uploaded files are held using secure hosting, database and file-storage services.
            We may also use an email delivery provider to send request notifications and invoices. Providers only
            receive the information needed to deliver their service and are required to handle it appropriately.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">How long we keep information</h2>
          <p className="mt-2">
            We keep information only for as long as it is reasonably needed to deal with the request, provide the
            service, maintain business records, resolve disputes and meet legal or accounting obligations.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">Your choices and rights</h2>
          <p className="mt-2">
            You can ask what personal information we hold about you, request corrections, or ask us to delete it
            where we are not required to retain it. You may also raise a concern with the UK Information
            Commissioner&apos;s Office.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-racing">Cookies and website analytics</h2>
          <p className="mt-2">
            Essential browser storage keeps your basket and cookie choice, and secure cookies support staff
            sign-in. If you accept analytics, we load Google Analytics to measure visits and page views on
            our public website. Google receives technical information such as your IP address, browser and
            device information, along with a cookie identifier and the pages visited. Our page-view tracking
            excludes URL query strings, form contents and dashboard pages. Advertising features are disabled.
          </p>
          <p className="mt-2">
            Analytics is optional and does not load before you accept. We remember your choice for up to
            six months and configure analytics cookies to expire after six months, refreshed by subsequent
            visits. You can withdraw consent using Cookie settings in the footer; this stops tracking and
            removes our Google Analytics cookies from this browser. It does not delete data already collected.
            Google may process data outside the UK. Read more in
            {" "}<a href="https://policies.google.com/privacy" className="underline">Google&apos;s privacy policy</a>.
          </p>
        </section>

        <section className="rounded-xl border-l-4 border-gold bg-cream-dark p-5">
          <h2 className="font-display text-2xl text-racing">Contact us</h2>
          <p className="mt-2">
            Email <a href="mailto:sales@m-machine.co.uk" className="font-semibold text-racing underline">sales@m-machine.co.uk</a>
            {" "}or call <a href="tel:01325381302" className="font-semibold text-racing underline">01325 381302</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
