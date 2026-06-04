import type { Metadata } from "next";
import Hero from "./components/Hero";
import ExecutiveSummary from "./components/ExecutiveSummary";
import Services from "./components/Services";
import SuccessStories from "./components/SuccessStories";
import Legality from "./components/Legality";
import Partners from "./components/Partners";
import ContactCTA from "./components/ContactCTA";

export const metadata: Metadata = {
  title:
    "Company Profile | PT Solusi Tangguh Rejeki (Solusindo Premier) — Balai Lelang, NPL & Hak Tanggungan",
  description:
    "Profil resmi PT Solusi Tangguh Rejeki (Solusindo Premier) — pionir One Stop Legal Services di Surabaya. Solusi end-to-end untuk Balai Lelang, penyelesaian NPL, eksekusi Hak Tanggungan, agency property, kurator, notaris, konsultan pajak, dan law firm. 266.327+ active listings, Rp 94.1B transaksi, 98.7% client satisfaction.",
  keywords: [
    "Solusindo Premier",
    "PT Solusi Tangguh Rejeki",
    "Company Profile Solusindo",
    "Balai Lelang Surabaya",
    "Penyelesaian NPL",
    "Eksekusi Hak Tanggungan",
    "Lelang Properti Jawa Timur",
    "OM DAS AI",
    "One Stop Legal Services",
    "AREBI Jawa Timur",
    "Kurator Kepailitan",
    "Agency Property",
    "Titip Jual Beli Sewa KPR",
  ],
  alternates: { canonical: "/about/company-profile" },
  openGraph: {
    title:
      "Company Profile — Solusindo Premier | Beyond Expectations",
    description:
      "Pionir One Stop Legal Services di Indonesia. Lelang, NPL, Hak Tanggungan, dan resolusi aset berbasis AI orchestration OM DAS.",
    url: "/about/company-profile",
    siteName: "Solusindo Premier",
    type: "website",
    locale: "id_ID",
    images: [
      {
        url: "/images/logo/LogoSolusindoPremier.png",
        width: 1200,
        height: 630,
        alt: "Solusindo Premier — Company Profile",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Company Profile — Solusindo Premier",
    description:
      "Beyond Expectations — Pionir One Stop Legal Services di Indonesia.",
    images: ["/images/logo/LogoSolusindoPremier.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PT Solusi Tangguh Rejeki",
  alternateName: "Solusindo Premier",
  url: "https://solusindopremier.com",
  logo: "/images/logo/LogoSolusindoPremier.png",
  description:
    "Pionir One Stop Legal Services di Indonesia untuk Balai Lelang, penyelesaian NPL, dan eksekusi Hak Tanggungan.",
  foundingDate: "2024-04-25",
  email: "closingsystem@gmail.com",
  telephone: "+6281335716679",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo",
    addressLocality: "Surabaya",
    addressRegion: "Jawa Timur",
    postalCode: "60160",
    addressCountry: "ID",
  },
  sameAs: [
    "https://omdas.id",
    "https://solusindolelang.com",
    "https://solusindopremier.com",
  ],
};

export default function CompanyProfilePage() {
  return (
    <main className="bg-[#05070D] min-h-screen text-white overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <Hero />
      <ExecutiveSummary />
      <Services />
      <SuccessStories />
      <Legality />
      <Partners />
      <ContactCTA />
    </main>
  );
}
