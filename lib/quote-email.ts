import { SendEmailCommand, SESv2Client, type SendEmailCommandInput } from "@aws-sdk/client-sesv2";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import { teamNotificationRecipientsForRoute, type NotificationRoute } from "./auth";
import { getCloudflareEnv } from "./cloudflare";
import {
  quoteIncludesVat,
  quoteTotals as accountingQuoteTotals,
  websiteInvoiceDisplay,
} from "./order-accounting";
import { getPaymentSettings, type PaymentSettings } from "./payment-settings";
import { quoteCustomerWillArrangeDelivery, quoteDeliveryAddress } from "./quote-delivery";
import type { QuoteCatalogue, QuoteItem, QuoteRequest } from "./quote-types";

const GBP = "\u00a3";
const DEFAULT_SITE_URL = "https://m-machine-metals.co.uk";
const DEFAULT_OWNER_EMAIL = "sales@m-machine.co.uk";
const DEFAULT_FROM_EMAIL = "orders@orders.m-machine.co.uk";
const DEFAULT_FROM_NAME = "New M Machine Order";
export const CUSTOMER_INVOICE_FROM_NAME = "Your M Machine Order";
const CARD_PAYMENT_PHONE = "01325 381302";

const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  accountType: "",
  accountName: "",
  sortCode: "",
  accountNumber: "",
};

type EmailEnv = Record<string, unknown>;
type SesConfigValues = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type EmailDeliveryResult =
  | {
      ok: true;
      skipped: false;
      error: null;
      provider: "amazon-ses";
      messageId?: string;
    }
  | {
      ok: false;
      skipped: boolean;
      error: string;
      code: string;
      missing?: string[];
      detail?: {
        name: string;
        message: string;
        statusCode?: number;
        requestId?: string;
      };
    };

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `${GBP}${value.toFixed(2)}` : "POA";

function envValue(env: EmailEnv | undefined, key: string) {
  const runtimeValue = env?.[key];
  if (typeof runtimeValue === "string") return runtimeValue.trim();
  if (typeof runtimeValue === "number" || typeof runtimeValue === "boolean") {
    return String(runtimeValue).trim();
  }
  return process.env[key]?.trim() || "";
}

async function emailRuntimeEnv(): Promise<EmailEnv> {
  try {
    return await getCloudflareEnv();
  } catch {
    return process.env;
  }
}

function siteUrl(env: EmailEnv = process.env) {
  return (envValue(env, "NEXT_PUBLIC_SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const itemName = (item: QuoteItem) => {
  if (item.catalogue === "custom") {
    return item.custom?.projectName || item.description || "Custom fabrication request";
  }
  if (item.catalogue === "metals") {
    return [item.shape, item.metal, item.spec, item.size].filter(Boolean).join(" - ");
  }
  return item.description;
};

const invoiceItemName = (item: QuoteItem) => item.catalogue === "custom" ? "Custom Job" : itemName(item);

function itemReference(item: QuoteItem) {
  if (item.catalogue === "custom") return "Custom";
  if (item.catalogue === "metals") return item.code || item.shape || "Metal";
  return item.code || (item.catalogue === "featured" ? "Featured Work" : "");
}

function orderType(quote: QuoteRequest) {
  const kinds = new Set(quote.items.map((item) => item.catalogue));
  if (kinds.size > 1) return "Mixed order";
  if (kinds.has("featured")) return "Featured Work";
  if (kinds.has("custom")) return "Custom fabrication";
  if (kinds.has("metals")) return "Metals";
  return "Mini panels";
}

export function ownerNotificationFromName(quote: QuoteRequest) {
  const kinds = new Set(quote.items.map((item) => item.catalogue));
  if (kinds.size !== 1) return "New Mixed Order";
  if (kinds.has("metals")) return "New Metals Order";
  if (kinds.has("mini")) return "New Mini Panel Order";
  if (kinds.has("custom")) return "New Custom Work Order";
  if (kinds.has("featured")) return "New Featured Order";
  return "New M Machine Order";
}

const lineExVat = (item: QuoteItem) =>
  typeof item.unitPriceExVat === "number" ? item.unitPriceExVat * item.qty : null;

function fileDownloadUrl(key: string, env: EmailEnv = process.env) {
  return `${siteUrl(env)}/api/quote-files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function dashboardUrl(env: EmailEnv = process.env, quoteId?: string) {
  const base = `${siteUrl(env)}/dashboard/orders`;
  return quoteId ? `${base}?quote=${encodeURIComponent(quoteId)}` : base;
}

function customSummary(item: QuoteItem, includeFileLinks = false, env: EmailEnv = process.env) {
  const custom = item.custom;
  if (!custom) return "";
  const files = custom.files || [];
  return `
    <div style="margin-top:10px;font-size:13px;line-height:1.5;color:#4d3f31">
      ${custom.material ? `<div><strong>Material:</strong> ${escapeHtml(custom.material)}</div>` : ""}
      ${custom.thickness ? `<div><strong>Thickness/spec:</strong> ${escapeHtml(custom.thickness)}</div>` : ""}
      ${custom.services?.length ? `<div><strong>Services:</strong> ${escapeHtml(custom.services.join(", "))}</div>` : ""}
      ${custom.finish ? `<div><strong>Finish:</strong> ${escapeHtml(custom.finish)}</div>` : ""}
      ${custom.tolerance ? `<div><strong>Tolerance:</strong> ${escapeHtml(custom.tolerance)}</div>` : ""}
      ${custom.deadline ? `<div><strong>Needed by:</strong> ${escapeHtml(custom.deadline)}</div>` : ""}
      ${custom.budget ? `<div><strong>Budget:</strong> ${escapeHtml(custom.budget)}</div>` : ""}
      ${
        includeFileLinks && files.length
          ? `<div style="margin-top:8px"><strong>Uploaded files:</strong><br>${files
              .map(
                (file) =>
                  `<a href="${escapeHtml(fileDownloadUrl(file.key, env))}" style="color:#0f3d2e">${escapeHtml(file.name)}</a> (${Math.ceil(file.size / 1024)} KB)`
              )
              .join("<br>")}</div>`
          : files.length
            ? `<div><strong>Uploaded files:</strong> ${files.length}</div>`
          : ""
      }
    </div>
  `;
}

function isCustomOnly(items: QuoteItem[]) {
  return items.length > 0 && items.every((item) => item.catalogue === "custom");
}

function hasMiniItems(items: QuoteItem[]) {
  return items.some((item) => item.catalogue === "mini");
}

function ownerVehicleDetailsBlock(quote: QuoteRequest) {
  if (!hasMiniItems(quote.items)) return "";
  const year = quote.customer.vehicleYear || "Not supplied";
  const model = quote.customer.vehicleModel || "Not supplied";
  return `
    <div style="margin:0 0 14px;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff">
      <strong style="display:block;margin-bottom:8px;color:#0f3d2e">Vehicle details</strong>
      <div><strong>Vehicle year:</strong> ${escapeHtml(year)}</div>
      <div><strong>Model:</strong> ${escapeHtml(model)}</div>
    </div>
  `;
}

export const quoteTotals = accountingQuoteTotals;

function ownerLineMeta(item: QuoteItem) {
  const parts = [`Qty ${escapeHtml(item.qty)}`];
  const reference = itemReference(item);
  if (reference) parts.push(`Ref ${escapeHtml(reference)}`);
  if (item.metalDimensions?.display) parts.push(escapeHtml(item.metalDimensions.display));
  if (item.catalogue === "mini") {
    parts.push(escapeHtml(money(lineExVat(item))));
  } else if (item.unit) {
    parts.push(`Unit ${escapeHtml(item.unit)}`);
  }
  return parts.join(" / ");
}

function ownerCustomFileBlock(items: QuoteItem[], env: EmailEnv = process.env) {
  const files = items.flatMap((item) => item.custom?.files || []);
  return `
    <div style="margin:0 0 14px;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff;font-size:14px;line-height:1.55;color:#4d3f31">
      ${
        files.length
          ? files
              .map(
                (file) =>
                  `<div><a href="${escapeHtml(fileDownloadUrl(file.key, env))}" style="color:#0f3d2e;font-weight:700">${escapeHtml(file.name)}</a> (${Math.ceil(file.size / 1024)} KB)</div>`
              )
              .join("")
          : `<div>No files uploaded.</div>`
      }
    </div>
  `;
}

function ownerItemList(items: QuoteItem[]) {
  return items
    .map((item) => {
      const name = itemName(item);
      const detail = name && name !== item.description ? name : "";
      return `
        <li style="margin:0 0 12px;padding:14px 16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff;list-style:none">
          <strong style="display:block;color:#0f3d2e;font-size:15px">${escapeHtml(item.description || name)}</strong>
          ${detail ? `<div style="margin-top:3px;color:#6b5a46;font-size:13px">${escapeHtml(detail)}</div>` : ""}
          <div style="margin-top:8px;color:#4d3f31;font-size:13px">
            ${ownerLineMeta(item)}
          </div>
        </li>
      `;
    })
    .join("");
}

function ownerDetailsContent(items: QuoteItem[], env: EmailEnv = process.env) {
  return isCustomOnly(items) ? ownerCustomFileBlock(items, env) : `<ul style="margin:0;padding:0">${ownerItemList(items)}</ul>`;
}

function ownerDetailsHeading(items: QuoteItem[]) {
  return isCustomOnly(items) ? "Uploaded files" : "Items Requested";
}

function ownerDeliveryContent(quote: QuoteRequest) {
  const address = quoteDeliveryAddress(quote.customer);
  if (address) {
    return `<span style="white-space:pre-line">${escapeHtml(address)}</span>`;
  }
  if (quoteCustomerWillArrangeDelivery(quote.customer)) {
    return "Customer will arrange delivery or collection.";
  }
  return `<span style="color:#8a3a10">Delivery address was not supplied. Contact the customer before arranging carriage.</span>`;
}

export function buildOwnerQuoteEmail(quote: QuoteRequest, env: EmailEnv = process.env) {
  const dashboardLink = dashboardUrl(env, quote.id);
  const invoiceRef = websiteInvoiceDisplay(quote);
  return `
    <div style="margin:0;padding:24px;background:#fbf8f1;font-family:Arial,sans-serif;color:#2c2c2a">
      <div style="max-width:680px;margin:0 auto">
        <h2 style="margin:0 0 8px;color:#0f3d2e">New M-Machine order request</h2>
        <p style="margin:0 0 18px;color:#6b5a46">${escapeHtml(invoiceRef)} / ${escapeHtml(orderType(quote))} / submitted ${escapeHtml(formatDate(quote.submittedAt))}</p>

        <div style="margin:0 0 14px;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff">
          <strong style="display:block;margin-bottom:8px;color:#0f3d2e">Customer</strong>
          <div>${escapeHtml(quote.customer.name)}</div>
          <div><a href="mailto:${escapeHtml(quote.customer.email)}" style="color:#0f3d2e">${escapeHtml(quote.customer.email)}</a></div>
          <div>${escapeHtml(quote.customer.phone)}</div>
          ${quote.customer.company ? `<div>${escapeHtml(quote.customer.company)}</div>` : ""}
        </div>

        ${ownerVehicleDetailsBlock(quote)}

        <div style="margin:0 0 14px;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff">
          <strong style="display:block;margin-bottom:8px;color:#0f3d2e">Delivery</strong>
          ${ownerDeliveryContent(quote)}
        </div>

        ${
          quote.customer.message
            ? `<div style="margin:0 0 14px;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#ffffff">
                <strong style="display:block;margin-bottom:8px;color:#0f3d2e">Customer note</strong>
                <div style="white-space:pre-line;line-height:1.5">${escapeHtml(quote.customer.message)}</div>
              </div>`
            : ""
        }

        <div style="margin:0 0 18px">
          <strong style="display:block;margin-bottom:8px;color:#0f3d2e">${ownerDetailsHeading(quote.items)}</strong>
          ${ownerDetailsContent(quote.items, env)}
        </div>

        <p style="margin:22px 0">
          <a href="${escapeHtml(dashboardLink)}" style="display:inline-block;background:#0f3d2e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">
            Open this order in dashboard
          </a>
        </p>
      </div>
    </div>
  `;
}

export async function buildOwnerQuoteEmailForRuntime(quote: QuoteRequest) {
  return buildOwnerQuoteEmail(quote, await emailRuntimeEnv());
}

function formatDate(value: string | null | undefined) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
  }).format(value ? new Date(value) : new Date());
}

function invoiceLineCards(items: QuoteItem[], includeVat: boolean, env: EmailEnv = process.env) {
  const linePriceLabel = includeVat ? "Price ex VAT" : "Price";
  const eachPriceLabel = includeVat ? "Price each ex VAT" : "Price each";
  return items
    .map((item) => {
      const line = lineExVat(item);
      const subtitle = [
        itemReference(item),
        item.metalDimensions?.display,
        item.catalogue === "mini" ? "" : item.unit,
      ].filter(Boolean).join(" / ");
      const priceRows = item.qty > 1
        ? `
              <tr>
                <td style="padding:10px 14px;color:#6b5a46;border-top:1px solid #eadfca">${eachPriceLabel}</td>
                <td style="padding:10px 14px;text-align:right;border-top:1px solid #eadfca;font-weight:700">${escapeHtml(money(item.unitPriceExVat))}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#6b5a46;border-top:1px solid #eadfca">${linePriceLabel}</td>
                <td style="padding:10px 14px;text-align:right;border-top:1px solid #eadfca;font-weight:800;color:#0f3d2e">${escapeHtml(money(line))}</td>
              </tr>`
        : `
              <tr>
                <td style="padding:10px 14px;color:#6b5a46;border-top:1px solid #eadfca">${linePriceLabel}</td>
                <td style="padding:10px 14px;text-align:right;border-top:1px solid #eadfca;font-weight:800;color:#0f3d2e">${escapeHtml(money(line))}</td>
              </tr>`;
      return `
        <div style="margin:0 0 12px;border:1px solid #eadfca;border-radius:10px;background:#ffffff;overflow:hidden">
          <div style="padding:13px 14px;background:#fbf8f1">
            <strong style="display:block;color:#0f3d2e;font-size:15px;line-height:1.35">${escapeHtml(invoiceItemName(item))}</strong>
            ${subtitle ? `<div style="margin-top:4px;color:#6b5a46;font-size:12px;line-height:1.4">${escapeHtml(subtitle)}</div>` : ""}
            ${item.catalogue === "custom" ? customSummary(item, false, env) : ""}
          </div>
          <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">
            <tbody>
              <tr>
                <td style="padding:10px 14px;color:#6b5a46;border-top:1px solid #eadfca">Qty</td>
                <td style="padding:10px 14px;text-align:right;border-top:1px solid #eadfca;font-weight:700;color:#0f3d2e">${escapeHtml(item.qty)}</td>
              </tr>
              ${priceRows}
            </tbody>
          </table>
        </div>`;
    })
    .join("");
}

function customerDeliveryBlock(quote: QuoteRequest) {
  const address = quoteDeliveryAddress(quote.customer);
  const collection = quoteCustomerWillArrangeDelivery(quote.customer);
  const body = collection
    ? "You selected collection. Please contact us if you'd prefer us to arrange delivery"
    : address
      ? escapeHtml(address).replace(/\n/g, "<br>")
      : "Delivery address was not supplied. Please contact M-Machine before arranging delivery.";
  const heading = collection ? "Collection" : "Your Delivery Address";
  return `
    <div style="margin:0 0 18px;padding:14px 16px;border:1px solid #eadfca;border-radius:10px;background:#fbf8f1">
      <strong style="display:block;margin-bottom:8px;color:#0f3d2e;font-size:15px">${heading}</strong>
      <div style="line-height:1.55;color:#4d3f31">${body}</div>
    </div>
  `;
}

function safePaymentLink(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function bacsRows(settings: PaymentSettings) {
  return [
    ["Account type", settings.accountType],
    ["Account name", settings.accountName],
    ["Sort code", settings.sortCode],
    ["Account number", settings.accountNumber],
  ].filter(([, value]) => String(value || "").trim());
}

function paymentMethodsBlock(quote: QuoteRequest, settings: PaymentSettings) {
  const onlineLink = safePaymentLink(quote.paymentLink);
  const rows = bacsRows(settings);
  return `
    <div style="margin:24px 0 0;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#fbf8f1">
      <h2 style="margin:0 0 12px;color:#0f3d2e;font-size:18px">Payment methods</h2>

      <div style="margin:0 0 12px">
        <strong style="display:block;color:#0f3d2e">Card over the phone</strong>
        <div style="margin-top:3px;color:#4d3f31;line-height:1.5">Call ${escapeHtml(CARD_PAYMENT_PHONE)} to pay by card.</div>
      </div>

      ${
        rows.length
          ? `<div style="margin:0 0 12px">
              <strong style="display:block;color:#0f3d2e">BACS</strong>
              <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;width:100%;margin-top:5px;font-size:14px">
                <tbody>
                  ${rows
                    .map(
                      ([label, value]) =>
                        `<tr><td style="padding:3px 10px 3px 0;color:#6b5a46;width:42%">${escapeHtml(label)}</td><td style="padding:3px 0;font-weight:700;color:#0f3d2e">${escapeHtml(value)}</td></tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : ""
      }

      ${
        onlineLink
          ? `<div style="margin:0 0 12px">
              <strong style="display:block;color:#0f3d2e">Pay online</strong>
              <a href="${escapeHtml(onlineLink)}" style="display:inline-block;margin-top:7px;background:#0f3d2e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700">Open payment link</a>
            </div>`
          : ""
      }

      <div>
        <strong style="display:block;color:#0f3d2e">Cash on collection</strong>
        <div style="margin-top:3px;color:#4d3f31;line-height:1.5">Call to arrange cash payment on collection.</div>
      </div>
    </div>
  `;
}

export function buildCustomerInvoiceEmail(
  quote: QuoteRequest,
  env: EmailEnv = process.env,
  paymentSettings: PaymentSettings = EMPTY_PAYMENT_SETTINGS
) {
  const totals = quoteTotals(quote);
  const includeVat = quoteIncludesVat(quote);
  const vatRegistrationNumber = envValue(env, "VAT_REGISTRATION_NUMBER");
  const isUpdatedInvoice = Boolean(quote.customerEmailSentAt);
  const title = isUpdatedInvoice ? "Updated invoice" : "Order invoice";
  const invoiceDate = quote.invoiceSentAt || quote.customerEmailSentAt || quote.updatedAt || new Date().toISOString();
  const invoiceRef = websiteInvoiceDisplay(quote);
  const basePriceLabel = includeVat ? "ex VAT" : "";
  return `
    <div style="margin:0;background:#fbf8f1;padding:18px 0;font-family:Inter,Arial,sans-serif;color:#2c2c2a">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #eadfca;border-radius:12px;overflow:hidden">
        <div style="background:#0f3d2e;color:#fbf8f1;padding:20px">
          <div style="font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#DF1718">M-Machine</div>
          <h1 style="margin:6px 0 0;font-family:Georgia,serif;font-size:28px;font-weight:600">${title}</h1>
          <div style="margin-top:8px;color:#d8e7df">Invoice ${escapeHtml(invoiceRef)} / ${escapeHtml(formatDate(invoiceDate))}</div>
        </div>

        <div style="padding:20px">
          <p style="margin:0 0 16px">Hello ${escapeHtml(quote.customer.name)},</p>
          <p style="margin:0 0 18px;line-height:1.55">
            ${
              isUpdatedInvoice
                ? "See your order summary below."
                : "See your order summary below."
            }
          </p>
          ${
            quote.customerMessage
              ? `<div style="margin:0 0 18px;padding:14px 16px;background:#f5efe0;border-radius:10px;line-height:1.55">${escapeHtml(quote.customerMessage).replace(/\n/g, "<br>")}</div>`
              : ""
          }

          <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;width:100%;margin-bottom:18px;font-size:14px">
            <tbody>
              <tr>
                <td style="padding:8px 0;color:#6b5a46;width:38%">Customer</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;color:#0f3d2e">${escapeHtml(quote.customer.name)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b5a46;border-top:1px solid #eadfca">Reference</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #eadfca;font-weight:700;color:#0f3d2e">${escapeHtml(invoiceRef)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b5a46;border-top:1px solid #eadfca">Submitted</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #eadfca">${escapeHtml(formatDate(quote.submittedAt))}</td>
              </tr>
            </tbody>
          </table>

          ${customerDeliveryBlock(quote)}

          <h2 style="margin:0 0 10px;color:#0f3d2e;font-size:18px">Items</h2>
          ${invoiceLineCards(quote.items, includeVat, env)}

          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:360px;margin:24px 0 0 auto;font-size:14px">
            <tbody>
              <tr><td style="padding:6px 0;color:#6b5a46">Goods${basePriceLabel ? ` ${basePriceLabel}` : ""}</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.goodsExVat))}</td></tr>
              <tr><td style="padding:6px 0;color:#6b5a46">Carriage${basePriceLabel ? ` ${basePriceLabel}` : ""}</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.carriageExVat))}</td></tr>
              ${
                totals.extraChargesExVat > 0
                  ? `<tr><td style="padding:6px 0;color:#6b5a46">Cutting charge${basePriceLabel ? ` ${basePriceLabel}` : ""}</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.extraChargesExVat))}</td></tr>`
                  : ""
              }
              ${
                totals.refundsExVat > 0
                  ? `<tr><td style="padding:6px 0;color:#6b5a46">Refunds${basePriceLabel ? ` ${basePriceLabel}` : ""}</td><td style="padding:6px 0;text-align:right;font-weight:700">-${escapeHtml(money(totals.refundsExVat))}</td></tr>`
                  : ""
              }
              ${
                includeVat
                  ? `<tr><td style="padding:6px 0;color:#6b5a46">VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(money(totals.vat))}</td></tr>
                     <tr><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;color:#0f3d2e;font-weight:700">Total inc VAT</td><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;text-align:right;color:#0f3d2e;font-size:20px;font-weight:800">${escapeHtml(money(totals.totalIncVat))}</td></tr>`
                  : `<tr><td style="padding:6px 0;color:#6b5a46">VAT</td><td style="padding:6px 0;text-align:right;font-weight:700">Not applied</td></tr>
                     <tr><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;color:#0f3d2e;font-weight:700">Total</td><td style="padding:12px 0 0;border-top:2px solid #0f3d2e;text-align:right;color:#0f3d2e;font-size:20px;font-weight:800">${escapeHtml(money(totals.totalIncVat))}</td></tr>`
              }
            </tbody>
          </table>

          ${paymentMethodsBlock(quote, paymentSettings)}
          <div style="margin:24px 0 0;padding-top:18px;border-top:1px solid #eadfca;font-size:12px;line-height:1.6;color:#6b5a46">
            <strong style="display:block;color:#0f3d2e">M-Machine / Craftgrange Limited</strong>
            Unit 6 Forge Way, Cleveland Trading Estate, Darlington, County Durham, DL1 2PJ<br>
            Metals &amp; Engineering: 01325 381302 &nbsp; Mini Panels &amp; Accounts: 01325 381300<br>
            sales@m-machine.co.uk &nbsp; Company no. 01476185
            ${vatRegistrationNumber ? `<br>VAT registration no. ${escapeHtml(vatRegistrationNumber)}` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

export const buildCustomerQuoteEmail = buildCustomerInvoiceEmail;

export async function buildCustomerInvoiceEmailForRuntime(quote: QuoteRequest) {
  const env = await emailRuntimeEnv();
  let settings = EMPTY_PAYMENT_SETTINGS;
  try {
    settings = await getPaymentSettings();
  } catch (err) {
    console.warn("payment_settings_unavailable_for_invoice_email", {
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
  return buildCustomerInvoiceEmail(quote, env, settings);
}

export function buildOwnerEnquiryEmail(enquiry: {
  name: string;
  email: string;
  phone?: string;
  type?: string;
  message: string;
  product?: string;
  sku?: string;
  category?: string;
  pageUrl?: string;
}) {
  const productDetails = enquiry.product
    ? `
      <div style="margin:18px 0;padding:16px;border:1px solid #eadfca;border-radius:10px;background:#fbf8f1">
        <strong style="display:block;color:#0f3d2e;margin-bottom:8px">Product enquiry</strong>
        <div><strong>Product:</strong> ${escapeHtml(enquiry.product)}</div>
        ${enquiry.sku ? `<div><strong>Part number / SKU:</strong> ${escapeHtml(enquiry.sku)}</div>` : ""}
        ${enquiry.category ? `<div><strong>Category:</strong> ${escapeHtml(enquiry.category)}</div>` : ""}
        ${enquiry.pageUrl ? `<div><strong>Page:</strong> <a href="${escapeHtml(enquiry.pageUrl)}">${escapeHtml(enquiry.pageUrl)}</a></div>` : ""}
      </div>`
    : "";

  return `
    <h2 style="color:#0f3d2e">New M-Machine website enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(enquiry.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(enquiry.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(enquiry.phone || "Not supplied")}</p>
    <p><strong>Enquiry type:</strong> ${escapeHtml(enquiry.type || "General question")}</p>
    ${productDetails}
    <div style="margin-top:18px"><strong>Message:</strong><br>${escapeHtml(enquiry.message).replace(/\n/g, "<br>")}</div>
  `;
}

function splitEmailList(value: unknown) {
  return String(value || "")
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function ownerFallbackRecipients(env: EmailEnv = process.env) {
  const fallback = splitEmailList(envValue(env, "QUOTE_OWNER_EMAIL"));
  return fallback.length > 0 ? fallback : [DEFAULT_OWNER_EMAIL];
}

function uniqueRecipients(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function ownerRecipientsForCatalogue(catalogue: QuoteCatalogue, env: EmailEnv = process.env) {
  const envByCatalogue: Record<QuoteCatalogue, string> = {
    custom: "QUOTE_CUSTOM_OWNER_EMAIL",
    featured: "QUOTE_FEATURED_OWNER_EMAIL",
    metals: "QUOTE_METALS_OWNER_EMAIL",
    mini: "QUOTE_MINI_OWNER_EMAIL",
  };
  return uniqueRecipients(splitEmailList(envValue(env, envByCatalogue[catalogue])));
}

export function ownerQuoteRecipients(quote: QuoteRequest, env: EmailEnv = process.env) {
  const kinds = new Set(quote.items.map((item) => item.catalogue));
  if (kinds.size > 1) {
    const miniRecipients = ownerRecipientsForCatalogue("mini", env);
    return miniRecipients.length > 0 ? miniRecipients : ownerFallbackRecipients(env);
  }

  const recipients = quote.items.flatMap((item) => ownerRecipientsForCatalogue(item.catalogue, env));
  const unique = uniqueRecipients(recipients);
  return unique.length > 0 ? unique : ownerFallbackRecipients(env);
}

function notificationRouteForQuote(quote: QuoteRequest): NotificationRoute {
  const kinds = new Set(quote.items.map((item) => item.catalogue));
  if (kinds.size > 1) return "mini";
  if (kinds.has("metals")) return "metals";
  if (kinds.has("custom")) return "custom";
  if (kinds.has("featured")) return "featured";
  return "mini";
}

export async function ownerQuoteRecipientsForRuntime(quote: QuoteRequest) {
  try {
    const teamRecipients = await teamNotificationRecipientsForRoute(notificationRouteForQuote(quote));
    if (teamRecipients.length > 0) return teamRecipients;
  } catch (err) {
    console.warn("team_notification_recipients_unavailable", {
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
  return ownerQuoteRecipients(quote, await emailRuntimeEnv());
}

export function ownerEnquiryRecipients(env: EmailEnv = process.env) {
  const recipients = uniqueRecipients(splitEmailList(envValue(env, "QUOTE_ENQUIRY_OWNER_EMAIL")));
  return recipients.length > 0 ? recipients : ownerFallbackRecipients(env);
}

export async function ownerEnquiryRecipientsForRuntime() {
  return ownerEnquiryRecipients(await emailRuntimeEnv());
}

function cleanEmailAddress(value: string) {
  const trimmed = value.trim();
  return trimmed.match(/<([^<>@\s]+@[^<>@\s]+)>$/)?.[1] || trimmed;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function quoteDisplayName(value: string) {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

function sesFromEmailAddress(env: EmailEnv = process.env, fromName?: string) {
  const configured = envValue(env, "AWS_SES_FROM_EMAIL");
  if (configured?.includes("<") && !fromName) return configured;
  const email = cleanEmailAddress(configured || DEFAULT_FROM_EMAIL);
  const name = fromName || envValue(env, "AWS_SES_FROM_NAME") || DEFAULT_FROM_NAME;
  return `${quoteDisplayName(name)} <${email}>`;
}

function sesConfigValues(env: EmailEnv = process.env): SesConfigValues {
  return {
    region: envValue(env, "AWS_SES_REGION") || envValue(env, "AWS_REGION"),
    accessKeyId: envValue(env, "AWS_SES_ACCESS_KEY_ID") || envValue(env, "AWS_ACCESS_KEY_ID"),
    secretAccessKey: envValue(env, "AWS_SES_SECRET_ACCESS_KEY") || envValue(env, "AWS_SECRET_ACCESS_KEY"),
    sessionToken: envValue(env, "AWS_SES_SESSION_TOKEN") || envValue(env, "AWS_SESSION_TOKEN") || undefined,
  };
}

function missingSesConfig(values: SesConfigValues) {
  const missing: string[] = [];
  if (!values.region) missing.push("AWS_SES_REGION");
  if (!values.accessKeyId) missing.push("AWS_SES_ACCESS_KEY_ID");
  if (!values.secretAccessKey) missing.push("AWS_SES_SECRET_ACCESS_KEY");
  return missing;
}

function sesConfig(env: EmailEnv = process.env) {
  const values = sesConfigValues(env);
  const missing = missingSesConfig(values);
  if (missing.length > 0) return { values, missing, config: null };
  return {
    values,
    missing,
    config: {
      region: values.region,
      credentials: {
        accessKeyId: values.accessKeyId,
        secretAccessKey: values.secretAccessKey,
        sessionToken: values.sessionToken,
      },
    },
  };
}

export function buildSesEmailInput(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
}, env: EmailEnv = process.env): SendEmailCommandInput {
  const to = uniqueRecipients(Array.isArray(opts.to) ? opts.to : splitEmailList(opts.to));
  return {
    FromEmailAddress: sesFromEmailAddress(env, opts.fromName),
    Destination: { ToAddresses: to },
    ReplyToAddresses: opts.replyTo ? [cleanEmailAddress(opts.replyTo)] : undefined,
    Content: {
      Simple: {
        Subject: { Data: opts.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: opts.html, Charset: "UTF-8" },
          Text: { Data: htmlToText(opts.html), Charset: "UTF-8" },
        },
      },
    },
    ConfigurationSetName: envValue(env, "AWS_SES_CONFIGURATION_SET") || undefined,
  };
}

export function buildEmailSetupStatus(env: EmailEnv = process.env) {
  const config = sesConfig(env);
  const fallbackRecipients = ownerFallbackRecipients(env);
  const withFallback = (recipients: string[]) => (recipients.length > 0 ? recipients : fallbackRecipients);
  return {
    provider: "amazon-ses" as const,
    configured: config.missing.length === 0,
    missing: config.missing,
    region: config.values.region || null,
    fromEmailAddress: sesFromEmailAddress(env),
    senderEmailAddress: cleanEmailAddress(sesFromEmailAddress(env)),
    configurationSetConfigured: Boolean(envValue(env, "AWS_SES_CONFIGURATION_SET")),
    recipients: {
      fallback: fallbackRecipients,
      custom: withFallback(ownerRecipientsForCatalogue("custom", env)),
      mini: withFallback(ownerRecipientsForCatalogue("mini", env)),
      metals: withFallback(ownerRecipientsForCatalogue("metals", env)),
      featured: withFallback(ownerRecipientsForCatalogue("featured", env)),
      enquiry: ownerEnquiryRecipients(env),
    },
  };
}

export async function emailSetupStatus() {
  return buildEmailSetupStatus(await emailRuntimeEnv());
}

function emailErrorDetail(error: unknown) {
  const maybeError = error as {
    name?: unknown;
    message?: unknown;
    $metadata?: {
      httpStatusCode?: unknown;
      requestId?: unknown;
    };
  };
  return {
    name: typeof maybeError.name === "string" ? maybeError.name : "EmailDeliveryError",
    message:
      typeof maybeError.message === "string"
        ? maybeError.message
        : error instanceof Error
          ? error.message
          : "unknown error",
    statusCode:
      typeof maybeError.$metadata?.httpStatusCode === "number" ? maybeError.$metadata.httpStatusCode : undefined,
    requestId: typeof maybeError.$metadata?.requestId === "string" ? maybeError.$metadata.requestId : undefined,
  };
}

export async function sendQuoteEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
}): Promise<EmailDeliveryResult> {
  const env = await emailRuntimeEnv();
  const config = sesConfig(env);
  if (!config.config) {
    return {
      ok: false,
      skipped: true,
      error: "Email sending is unavailable",
      code: "missing_config",
      missing: config.missing,
    };
  }

  try {
    const client = new SESv2Client({
      region: config.config.region,
      credentials: config.config.credentials,
      requestHandler: new FetchHttpHandler(),
    });
    const result = await client.send(new SendEmailCommand(buildSesEmailInput(opts, env)));
    return { ok: true, skipped: false, error: null, provider: "amazon-ses", messageId: result.MessageId };
  } catch (error) {
    const detail = emailErrorDetail(error);
    console.error("ses_email_delivery_failed", {
      error: detail.message,
      name: detail.name,
      statusCode: detail.statusCode,
      requestId: detail.requestId,
    });
    return { ok: false, skipped: false, error: "Email delivery request failed", code: detail.name, detail };
  }
}
