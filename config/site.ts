export const siteConfig = {
  name: "Truck Shop",
  description:
    "Практичні товари та аксесуари для далекобійників і професійних водіїв у довгих рейсах європейськими дорогами.",
  locale: "uk_UA",
  keywords: [
    "товари для далекобійників",
    "аксесуари для вантажівки",
    "товари для водіїв",
    "комфорт у кабіні",
    "Truck Shop",
  ],
} as const;

const SELLER_PHONE = "+48576222842";

export const sellerContacts = {
  phoneDisplay: "+48 576 222 842",
  phone: SELLER_PHONE,
  links: {
    phone: `tel:${SELLER_PHONE}`,
    whatsapp: `https://wa.me/${SELLER_PHONE.slice(1)}`,
    viber: `viber://chat?number=${encodeURIComponent(SELLER_PHONE)}`,
    telegram: `https://t.me/${SELLER_PHONE}`,
  },
} as const;

/** Legal details are not provided yet; null renders a visible placeholder. */
export const companyInfo = {
  companyName: null,
  address: null,
  nip: null,
  regon: null,
  vat: null,
  businessHours: null,
} as const satisfies Record<string, string | null>;
