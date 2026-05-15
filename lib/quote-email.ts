import type { QuoteItem, QuoteRequest } from "./quote-types";

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `£${value.toFixed(2)}` : "POA";

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const itemName = (item: QuoteItem) => {
  if (item.catalogue === "metals") {
    return [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ");
  }
  return item.description;
};

const lineExVat = (item: QuoteItem) =>
  typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : null;

const numericTotal = (items: QuoteItem[]) =>
  items.reduce((sum, item) => sum + (lineExVat(item) ?? 0), 0);

export function quoteTotals(quote: QuoteRequest) {
  const goodsExVat = numericTotal(quote.items);
  const carriageExVat = quote.carriageExVat ?? 0;
  const extraChargesExVat = quote.extraChargesExVat ?? 0;
  const totalExVat = goodsExVat + carriageExVat + extraChargesExVat;
  const totalIncVat = totalExVat * 1.2;
  return { goodsExVat, carriageExVat, extraChargesExVat, totalExVat, totalIncVat };
}

function quoteRows(items: QuoteItem[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.qty)}</td>
          <td>${escapeHtml(item.catalogue === "mini" ? item.code : item.shape)}</td>
          <td>${escapeHtml(itemName(item))}</td>
          <td>${escapeHtml(item.unit || "")}</td>
          <td style="text-align:right">${escapeHtml(money(item.unitPriceExVat))}</td>
          <td style="text-align:right">${escapeHtml(money(lineExVat(item)))}</td>
        </tr>`
    )
    .join("");
}

export function buildOwnerQuoteEmail(quote: QuoteRequest) {
  const rows = quoteRows(quote.items);
  return `
    <h2>New M-Machine quote request: ${escapeHtml(quote.id)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(quote.customer.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(quote.customer.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(quote.customer.phone)}</p>
    <p><strong>Company:</strong> ${escapeHtml(quote.customer.company || "")}</p>
    <p><strong>Customer note:</strong><br>${escapeHtml(quote.customer.message || "").replace(/\n/g, "<br>")}</p>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">
      <thead>
        <tr><th>Qty</th><th>Code / Shape</th><th>Description</th><th>Unit</th><th>Each ex VAT</th><th>Line ex VAT</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>Review and edit this in the owner dashboard before emailing the buyer.</p>
  `;
}

export function buildCustomerQuoteEmail(quote: QuoteRequest) {
  const totals = quoteTotals(quote);
  return `
    <h2>M-Machine quote ${escapeHtml(quote.id)}</h2>
    <p>Hello ${escapeHtml(quote.customer.name)},</p>
    <p>Thank you for your enquiry. Please find the quote details below. Payment is arranged manually by M-Machine.</p>
    ${quote.customerMessage ? `<p>${escapeHtml(quote.customerMessage).replace(/\n/g, "<br>")}</p>` : ""}
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">
      <thead>
        <tr><th>Qty</th><th>Code / Shape</th><th>Description</th><th>Unit</th><th>Each ex VAT</th><th>Line ex VAT</th></tr>
      </thead>
      <tbody>${quoteRows(quote.items)}</tbody>
    </table>
    <p><strong>Goods ex VAT:</strong> ${money(totals.goodsExVat)}</p>
    <p><strong>Carriage ex VAT:</strong> ${money(totals.carriageExVat)}</p>
    <p><strong>Extra charges ex VAT:</strong> ${money(totals.extraChargesExVat)}</p>
    <p><strong>Total ex VAT:</strong> ${money(totals.totalExVat)}</p>
    <p><strong>Total inc VAT:</strong> ${money(totals.totalIncVat)}</p>
    <p>Please contact us on 01325 381302 to confirm the order and arrange payment.</p>
    <p>M-Machine</p>
  `;
}

export async function sendQuoteEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.QUOTE_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY or QUOTE_FROM_EMAIL is not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo,
    }),
  });

  if (!res.ok) {
    return { ok: false, skipped: false, error: await res.text() };
  }

  return { ok: true, skipped: false, error: null };
}
