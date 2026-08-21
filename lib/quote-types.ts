export type QuoteCatalogue = "mini" | "metals" | "custom" | "featured";

export type QuoteFile = {
  key: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  uploadedAt: string;
};

export type CustomQuoteDetails = {
  projectName?: string;
  material?: string;
  thickness?: string;
  services?: string[];
  finish?: string;
  quantity?: string;
  units?: string;
  tolerance?: string;
  deadline?: string;
  budget?: string;
  drawingStatus?: "cad" | "help";
  files?: QuoteFile[];
};

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
  stockSize?: string;
  unit?: string;
  qty: number;
  unitPriceExVat: number | null;
  unitPriceIncVat: number | null;
  metalDimensions?: {
    mode: "length" | "sheet" | "fixed";
    lengthMm?: number;
    widthMm?: number;
    inputUnit?: "metric" | "imperial";
    inputLength?: number;
    inputWidth?: number;
    display: string;
    pricedFromUnit?: string;
    stockSize?: string;
  };
  custom?: CustomQuoteDetails;
};

export type QuoteCustomer = {
  name: string;
  email: string;
  phone: string;
  company?: string;
  vehicleYear?: string;
  vehicleModel?: string;
  address?: string;
  arrangeOwnDelivery?: boolean;
  message?: string;
};

export type QuoteStatus = "new" | "reviewing" | "invoice_sent" | "paid" | "closed";
export type QuotePaymentMethod = "card" | "bacs" | "cash";

export type QuoteAccountingBucket = "mini" | "metals" | "engineering" | "featured" | "carriage";

export type QuoteRefundLine = {
  bucket: QuoteAccountingBucket;
  amountExVat: number;
};

export type QuoteRefund = {
  id: string;
  createdAt: string;
  reason?: string;
  websiteInvoiceNumber?: string | null;
  websiteInvoiceCount?: number | null;
  lines: QuoteRefundLine[];
};

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
  invoiceSentAt?: string | null;
  paidAt?: string | null;
  paymentLink?: string | null;
  paymentMethod?: QuotePaymentMethod | null;
  customerEmailSentAt?: string | null;
  ownerEmailSentAt?: string | null;
  includeVat?: boolean;
  websiteInvoiceNumber?: string | null;
  websiteInvoiceCount?: number | null;
  refunds?: QuoteRefund[];
};
