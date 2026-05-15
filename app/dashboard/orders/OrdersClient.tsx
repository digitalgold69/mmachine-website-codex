"use client";

import { useMemo, useState } from "react";
import type { QuoteItem, QuoteRequest, QuoteStatus } from "@/lib/quote-types";

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `£${value.toFixed(2)}` : "POA";

const lineExVat = (item: QuoteItem) =>
  typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : null;

const totals = (quote: QuoteRequest) => {
  const goods = quote.items.reduce((sum, item) => sum + (lineExVat(item) ?? 0), 0);
  const carriage = quote.carriageExVat ?? 0;
  const extra = quote.extraChargesExVat ?? 0;
  const totalEx = goods + carriage + extra;
  return { goods, carriage, extra, totalEx, totalInc: totalEx * 1.2 };
};

const itemName = (item: QuoteItem) =>
  item.catalogue === "metals"
    ? [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ")
    : item.description;

function cloneQuote(quote: QuoteRequest): QuoteRequest {
  return JSON.parse(JSON.stringify(quote));
}

export default function OrdersClient({
  initialQuotes,
  initialError,
}: {
  initialQuotes: QuoteRequest[];
  initialError: string;
}) {
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedId, setSelectedId] = useState(initialQuotes[0]?.id ?? "");
  const [draft, setDraft] = useState<QuoteRequest | null>(
    initialQuotes[0] ? cloneQuote(initialQuotes[0]) : null
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialError);

  const selected = useMemo(
    () => quotes.find((quote) => quote.id === selectedId) ?? null,
    [quotes, selectedId]
  );

  function selectQuote(id: string) {
    const quote = quotes.find((q) => q.id === id);
    setSelectedId(id);
    setDraft(quote ? cloneQuote(quote) : null);
    setMessage("");
  }

  function patchDraft(patch: Partial<QuoteRequest>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  }

  function patchItem(index: number, patch: Partial<QuoteItem>) {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  async function save(emailCustomer = false) {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, emailCustomer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const updated = data.quote as QuoteRequest;
      setQuotes((current) =>
        current.map((quote) => (quote.id === updated.id ? updated : quote))
      );
      setDraft(cloneQuote(updated));
      setMessage(emailCustomer ? "Quote emailed to customer." : "Quote saved.");
    } catch (err) {
      setMessage((err as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-racing mb-1">Quote requests</h1>
        <p className="text-ink-muted text-sm">
          Review website quote carts, add carriage or notes, then email the buyer.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-lg bg-cream-dark border border-racing/10 p-3 text-sm text-racing">
          {message}
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="bg-white rounded-xl border border-racing/10 overflow-hidden">
          <div className="px-4 py-3 bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
            Requests
          </div>
          <div className="divide-y divide-racing/5">
            {quotes.length === 0 && (
              <div className="p-4 text-sm text-ink-muted">No quote requests yet.</div>
            )}
            {quotes.map((quote) => (
              <button
                type="button"
                key={quote.id}
                onClick={() => selectQuote(quote.id)}
                className={`block w-full text-left p-4 hover:bg-cream-dark/60 ${
                  selectedId === quote.id ? "bg-cream-dark" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-racing">{quote.id}</div>
                  <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                    {quote.status}
                  </span>
                </div>
                <div className="text-sm text-ink mt-1">{quote.customer.name}</div>
                <div className="text-xs text-ink-muted mt-1">
                  {new Date(quote.submittedAt).toLocaleString("en-GB")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {!draft || !selected ? (
          <div className="bg-white rounded-xl border border-racing/10 p-8 text-center text-ink-muted">
            Select a quote request.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-racing/10 p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted">Customer</div>
                <h2 className="font-display text-2xl text-racing">{draft.customer.name}</h2>
                <div className="text-sm text-ink-muted">
                  {draft.customer.email} / {draft.customer.phone}
                </div>
                {draft.customer.company && (
                  <div className="text-sm text-ink-muted">{draft.customer.company}</div>
                )}
              </div>
              <select
                value={draft.status}
                onChange={(e) => patchDraft({ status: e.target.value as QuoteStatus })}
                className="input max-w-[160px]"
              >
                <option value="new">New</option>
                <option value="reviewing">Reviewing</option>
                <option value="quoted">Quoted</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {draft.customer.message && (
              <div className="mb-5 rounded-lg bg-cream-dark p-4 text-sm">
                <div className="label mb-1">Customer note</div>
                <p className="whitespace-pre-wrap">{draft.customer.message}</p>
              </div>
            )}

            <div className="overflow-x-auto border border-racing/10 rounded-lg">
              <table className="w-full min-w-[780px] table-fixed">
                <colgroup>
                  <col className="w-[70px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead className="bg-cream-dark text-xs uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Qty</th>
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-left px-3 py-2">Unit</th>
                    <th className="text-right px-3 py-2">Each ex VAT</th>
                    <th className="text-right px-3 py-2">Line ex VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item, index) => (
                    <tr key={item.key} className="border-t border-racing/5">
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => patchItem(index, { qty: Number(e.target.value) || 1 })}
                          className="input h-9 text-center"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={item.description}
                          onChange={(e) => patchItem(index, { description: e.target.value })}
                          className="input"
                        />
                        <div className="mt-1 text-xs text-ink-muted">{itemName(item)}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={item.unit || ""}
                          onChange={(e) => patchItem(index, { unit: e.target.value })}
                          className="input h-9"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPriceExVat ?? ""}
                          onChange={(e) =>
                            patchItem(index, {
                              unitPriceExVat: e.target.value === "" ? null : Number(e.target.value),
                              unitPriceIncVat: e.target.value === "" ? null : Number(e.target.value) * 1.2,
                            })
                          }
                          className="input h-9 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-racing align-top">
                        {money(lineExVat(item))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="label">Message to customer</label>
                <textarea
                  value={draft.customerMessage || ""}
                  onChange={(e) => patchDraft({ customerMessage: e.target.value })}
                  rows={5}
                  className="input resize-none"
                  placeholder="Add delivery timing, collection notes, payment instructions, etc."
                />
              </div>
              <div>
                <label className="label">Owner notes</label>
                <textarea
                  value={draft.ownerNotes || ""}
                  onChange={(e) => patchDraft({ ownerNotes: e.target.value })}
                  rows={5}
                  className="input resize-none"
                  placeholder="Private notes for the owner dashboard"
                />
              </div>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="label">Carriage ex VAT</label>
                <input
                  type="number"
                  step="0.01"
                  value={draft.carriageExVat ?? ""}
                  onChange={(e) => patchDraft({ carriageExVat: e.target.value === "" ? null : Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Extra charges ex VAT</label>
                <input
                  type="number"
                  step="0.01"
                  value={draft.extraChargesExVat ?? ""}
                  onChange={(e) => patchDraft({ extraChargesExVat: e.target.value === "" ? null : Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div className="lg:col-span-3 bg-cream-dark rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>Goods ex VAT</span><strong>{money(totals(draft).goods)}</strong></div>
                <div className="flex justify-between"><span>Total ex VAT</span><strong>{money(totals(draft).totalEx)}</strong></div>
                <div className="flex justify-between text-racing"><span>Total inc VAT</span><strong>{money(totals(draft).totalInc)}</strong></div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-racing/10 pt-5">
              <button type="button" disabled={saving} onClick={() => save(false)} className="btn-secondary">
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button type="button" disabled={saving} onClick={() => save(true)} className="btn-primary">
                {saving ? "Sending..." : "Email quote to buyer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
