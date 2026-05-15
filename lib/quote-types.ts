export type QuoteCatalogue = "mini" | "metals";

export type QuoteItem = {
  key: string;
  catalogue: QuoteCatalogue;
  productId: string;
  code?: string;
  description: string;
  shape?: string;
  metal?: string;
  spec?: string;
  size?: string;
  unit?: string;
  qty: number;
  unitPriceExVat: number | null;
  unitPriceIncVat: number | null;
};

export type QuoteCustomer = {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message?: string;
};

export type QuoteStatus = "new" | "reviewing" | "quoted" | "closed";

export type QuoteRequest = {
  id: string;
  submittedAt: string;
  updatedAt: string;
  status: QuoteStatus;
  customer: QuoteCustomer;
  items: QuoteItem[];
  ownerNotes?: string;
  customerMessage?: string;
  carriageExVat?: number | null;
  extraChargesExVat?: number | null;
  quotedAt?: string | null;
  customerEmailSentAt?: string | null;
  ownerEmailSentAt?: string | null;
};
