export type TenantCategory = "hardware";

export type StorefrontTenant = {
  slug: string;
  name: string;
  category: TenantCategory;
  tagline: string;
  description: string;
  accent: string;
  accentSoft: string;
  currency: string;
  logo: {
    src: string;
    alt: string;
  };
  address: string;
  phone: string;
  heroImage: string;
};

export const tenants: StorefrontTenant[] = [
  {
    slug: "sulthan-hardware",
    name: "Sulthan Hardware",
    category: "hardware",
    tagline: "Built for strong homes, smarter repairs, and reliable tools.",
    description:
      "Sulthan Hardware supplies tools, fittings, building essentials, and repair materials for homes, shops, and contractors who need dependable quality.",
    accent: "#b45309",
    accentSoft: "#fef3c7",
    currency: "INR",
    logo: {
      src: "/sulthan-logo.png",
      alt: "Porur Sulthan Hardwares logo",
    },
    address: "No. 52, Kundrathur Main Road, Porur, Chennai - 600 116",
    phone: "+91 91766 67889, +91 98408 16983, +91 98400 2020",
    heroImage:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
  },
];

export function getTenantBySlug(slug: string) {
  return tenants.find((tenant) => tenant.slug === slug);
}
