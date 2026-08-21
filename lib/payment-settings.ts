import { getD1 } from "@/lib/cloudflare";

const PAYMENT_SETTINGS_KEY = "payment_settings";

export type PaymentSettings = {
  accountType: string;
  accountName: string;
  sortCode: string;
  accountNumber: string;
};

const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  accountType: "",
  accountName: "",
  sortCode: "",
  accountNumber: "",
};

let paymentSettingsSchemaReady: Promise<void> | null = null;

function asString(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalisePaymentSettings(input: Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    accountType: asString(input.accountType, 80),
    accountName: asString(input.accountName, 160),
    sortCode: asString(input.sortCode, 40),
    accountNumber: asString(input.accountNumber, 40),
  };
}

async function ensurePaymentSettingsSchemaInner() {
  const db = await getD1();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS dashboard_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();
}

export async function ensurePaymentSettingsSchema() {
  if (!paymentSettingsSchemaReady) {
    paymentSettingsSchemaReady = ensurePaymentSettingsSchemaInner().catch((err) => {
      paymentSettingsSchemaReady = null;
      throw err;
    });
  }
  return paymentSettingsSchemaReady;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  await ensurePaymentSettingsSchema();
  const db = await getD1();
  const row = await db
    .prepare("SELECT value FROM dashboard_settings WHERE key = ?")
    .bind(PAYMENT_SETTINGS_KEY)
    .first<{ value: string }>();

  if (!row?.value) return EMPTY_PAYMENT_SETTINGS;
  try {
    return normalisePaymentSettings(JSON.parse(row.value) as Partial<PaymentSettings>);
  } catch {
    return EMPTY_PAYMENT_SETTINGS;
  }
}

export async function savePaymentSettings(input: Partial<PaymentSettings>): Promise<PaymentSettings> {
  await ensurePaymentSettingsSchema();
  const settings = normalisePaymentSettings(input);
  const db = await getD1();
  await db
    .prepare(
      `INSERT INTO dashboard_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    )
    .bind(PAYMENT_SETTINGS_KEY, JSON.stringify(settings), new Date().toISOString())
    .run();
  return settings;
}
