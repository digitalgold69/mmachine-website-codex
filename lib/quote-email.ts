import type { QuoteItem, QuoteRequest } from "./quote-types";

const GBP = "\u00a3";

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `${GBP}${value.toFixed(2)}` : "POA";

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
  const vat = totalIncVat - totalExVat;
  return { goodsExVat, carriageExVat, extraChargesExVat, totalExVat, vat, totalIncVat };
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
    <h2>New M-Machine order request: ${escapeHtml(quote.id)}</h2>
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
    <p>Review and edit this in the owner dashboard before emailing the completed invoice to the buyer.</p>
  `;
}

function formatDate(value: string | null | undefined) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
  }).format(value ? new Date(value) : new Date());
}

function invoiceRows(items: QuoteItem[]) {
  return items
    .map((item) => {
      const line = lineExVat(item);
      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca;text-align:center">${escapeHtml(item.qty)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca;font-family:monospace;color:#0f3d2e">${escapeHtml(item.catalogue === "mini" ? item.code : item.shape)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca">
            <strong style="color:#0f3d2e">${escapeHtml(item.description)}</strong>
            <div style="color:#6b5a46;font-size:12px;margin-top:3px">${escapeHtml(itemName(item))}</div>
          </td>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca">${escapeHtml(item.unit || "")}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca;text-align:right">${escapeHtml(money(item.unitPriceExVat))}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #eadfca;text-align:right;font-weight:700;color:#0f3d2e">${escapeHtml(money(line))}</td>
        </tr>`;
    })
    .join("");
}

export function buildCustomerInvoiceEmail(quote: QuoteRequest) {
  const totals = quoteTotals(quote);
  return `
    <div style="margin:0;background:#fbf8f1;padding:28px 0;font-family:Inter,Arial,sans-serif;color:#2c2c2a">
      <div style="max-width:780px;margin:0 auto;background:#ffffff;border:1px solid #eadfca;border-radius:14px;overflow:hidden">
        <div style="background:#0f3d2e;color:#fbf8f1;padding:24px 28px">
          <div style="font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#d6b257">M-Machine</div>
          <h1 style="margin:6px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:600">Order invoice</h1>
          <div style="margin-top:8px;color:#d8e7df">Invoice ${escapeHtml(quote.id)} / ${escapeHtml(formatDate(new Date().toISOString()))}</div>
        </div>

        <div style="padding:24px 28px">
          <p style="margin:0 0 16px">Hello ${escapeHtml(quote.customer.name)},</p>
          <p style="margin:0 0 18px;line-height:1.55">Thank you for your order request. We have reviewed it and added any carriage or extra charges below. Payment is arranged manually with M-Machine.</p>
          ${
            quote.customerMessage
              ? `<div style="margin:0 0 22px;padding:14px 16px;background:#f5efe0;border-radius:10px;line-height:1.55">${escapeHtml(quote.customerMessage).replace(/\n/g, "<br>")}</div>`
              : ""
          }

          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:22px">
            <div style="min-width:220px">
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b5a46">Customer</div>
              <strong style="display:block;color:#0f3d2e;margin-top:4px">${escapeHtml(quote.customer.name)}</strong>
              <div>${escapeHtml(quote.customer.email)}</div>
              <div>${escapeHtml(quote.customer.phone)}</div>
              ${quote.customer.company ? `<div>${escapeHtml(quote.customer.company)}</div>` : ""}
            </div>
            <div>
              <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b5a46">Reference</div>
              <strong style="display:block;color:#0f3d2e;margin-top:4px">${escapeHtml(quote.id)}</strong>
              <div>${escapeHtml(formatDate(quote.submittedAt))}</div>
            </div>
          </div>

          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
            <thead>
              <tr style="background:#f5efe0;color:#4d3f31;text-transform:uppercase;font-size:11px;letter-spacing:.8px">
                <th style="padding:10px;text-align:center">Qty</th>
                <th style="padding:10px;text-align:left">Code / Shape</th>
                <th style="padding:10px;text-align:left">Item</th>
                <th style="padding:10px;text-align:left">Unit</th>
                <th style="padding:10px;text-align:right">Each ex VAT</th>
                <th style="padding:10px;text-align:right">Line ex VAT</th>
              </tr>
            </thead>
            <tbody>${invoiceRows(quote.items)}</tbody>
          </table>

          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:360px;margin:24px 0 0 auto;font-size:14px">
            <tbody>
              <tr><td style="padding:6px 0;color:#6b5a46">Goods ex VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.goodsExVat))}</td></tr>
              <tr><td style="padding:6px 0;color:#6b5a46">Carriage ex VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.carriageExVat))}</td></tr>
              <tr><td style="padding:6px 0;color:#6b5a46">Extra charges ex VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.extraChargesExVat))}</td></tr>
              <tr><td style="padding:6px 0;color:#6b5a46">VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.vat))}</td></tr>
              <tr><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;color:#0f3d2e;font-weight:700">Total inc VAT</td><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;text-align:right;color:#0f3d2e;font-size:20px;font-weight:800">${escapeHtml(money(totals.totalIncVat))}</td></tr>
            </tbody>
          </table>

          <p style="margin:24px 0 0;line-height:1.55">Please contact us on 01325 381302 to confirm the order and arrange payment.</p>
          <p style="margin:18px 0 0;color:#0f3d2e;font-weight:700">M-Machine</p>
        </div>
      </div>
    </div>
  `;
}

export const buildCustomerQuoteEmail = buildCustomerInvoiceEmail;

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
