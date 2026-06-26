export type QuoteCatalogue = "mini" | "metals" | "custom";

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
  unit?: string;
  qty: number;
  unitPriceExVat: number | null;
  unitPriceIncVat: number | null;
  custom?: CustomQuoteDetails;
};

export type QuoteCustomer = {
  name: string;
  email: string;
  phone: string;
  company?: string;
  address?: string;
  arrangeOwnDelivery?: boolean;
  message?: string;
};

export type QuoteStatus = "new" | "reviewing" | "invoice_sent" | "paid" | "closed";

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
  customerEmailSentAt?: string | null;
  ownerEmailSentAt?: string | null;
};
