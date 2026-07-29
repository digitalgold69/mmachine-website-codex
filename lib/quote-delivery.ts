export type QuoteDeliveryInput = {
  address?: unknown;
  arrangeOwnDelivery?: unknown;
  deliveryMode?: unknown;
};

export type QuoteDeliveryState = {
  address: string;
  arrangeOwnDelivery: boolean;
};

export function cleanQuoteDeliveryAddress(value: unknown, max = 1200) {
  return String(value ?? "").trim().slice(0, max);
}

export function coerceQuoteDeliveryBoolean(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export function normaliseQuoteDelivery(input: QuoteDeliveryInput): QuoteDeliveryState {
  const address = cleanQuoteDeliveryAddress(input.address);
  const deliveryMode = typeof input.deliveryMode === "string" ? input.deliveryMode.trim().toLowerCase() : "";

  if (deliveryMode === "delivery") {
    return { address, arrangeOwnDelivery: false };
  }

  if (deliveryMode === "collection") {
    return { address: "", arrangeOwnDelivery: true };
  }

  return {
    address,
    arrangeOwnDelivery: address ? false : coerceQuoteDeliveryBoolean(input.arrangeOwnDelivery),
  };
}

export function quoteDeliveryAddress(customer: { address?: unknown }) {
  return cleanQuoteDeliveryAddress(customer.address);
}

export function quoteCustomerWillArrangeDelivery(customer: { address?: unknown; arrangeOwnDelivery?: unknown }) {
  return !quoteDeliveryAddress(customer) && coerceQuoteDeliveryBoolean(customer.arrangeOwnDelivery);
}
