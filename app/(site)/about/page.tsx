import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About M-Machine — family-run engineering since 1980",
  description: "M-Machine (Craftgrange Limited) has supplied pressed steel panels, engineered parts and engineering metals from Darlington since 1980.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/" className="text-sm text-ink-muted hover:text-racing">← Home</Link>
      <h1 className="font-display text-4xl text-racing mt-2 mb-6">About M-Machine</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-lg text-ink-muted leading-relaxed mb-6">
          We&apos;re a small family-run business trading as M-Machine, registered in the UK as
          Craftgrange Limited (company no. 01476185). We&apos;ve been operating from Darlington since 1980,
          supplying pressed steel panels, engineered parts and engineering metals to restorers,
          workshops, fabricators and the motor trade.
        </p>

        <div className="grid md:grid-cols-2 gap-6 my-10">
          <div className="bg-cream-dark rounded-xl p-6">
            <h3 className="font-display text-xl text-racing mb-3">What we do</h3>
            <ul className="text-sm text-ink-muted space-y-2">
              <li>• Classic Mini pressed panels — Mk1 through Mk5</li>
              <li>• Engineering metals — tool steel, stainless, aluminium, brass</li>
              <li>• Bespoke metal fabrication — one-offs & small batches</li>
              <li>• CNC & manual machining</li>
              <li>• TIG welding & assembly</li>
              <li>• Technical advice on material selection</li>
            </ul>
          </div>

          <div className="bg-cream-dark rounded-xl p-6">
            <h3 className="font-display text-xl text-racing mb-3">How we work</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              We&apos;re proudly old-fashioned about some things. We write orders down so we know
              what&apos;s on the shelf. We answer the phone. We give honest advice even when
              it costs us a sale. What&apos;s listed in our catalogue is stocked in our workshop —
              not drop-shipped from a warehouse you&apos;ve never heard of.
            </p>
          </div>
        </div>

        <h2 className="font-display text-2xl text-racing mb-3">Visit us</h2>
        <p className="text-ink-muted mb-6">
          Unit 3–7 Forge Way, Cleveland Trading Estate, Darlington, County Durham, DL1 2PJ.
          Call the metals &amp; engineering line on <strong>01325 381302</strong>, or
          the Mini pressings and accounts line on <strong>01325 381300</strong>.
        </p>

        <div className="bg-racing text-cream rounded-2xl p-8 text-center my-10">
          <p className="opacity-80 text-sm mb-4">EST. 1980 · FAMILY-RUN · DARLINGTON</p>
          <p className="font-display text-2xl">Four decades, still going strong.</p>
        </div>
      </div>
    </div>
  );
}
