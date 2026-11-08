export type EmailOrderItem = {
  name: string;
  description: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

/** Pre-formatted, display-ready order data shared by all email templates. */
export type EmailOrder = {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  city: string;
  postalCode: string;
  address: string;
  apartment: string | null;
  notes: string | null;
  items: EmailOrderItem[];
  total: string;
  currency: string;
  status: string;
  paymentStatus: string;
};
