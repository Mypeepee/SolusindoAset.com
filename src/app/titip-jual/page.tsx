import type { Metadata } from "next";
import dynamic from "next/dynamic";

// Above-fold: eager
import ScrollProgress from "./components/ScrollProgress";
import Hero from "./components/Hero";

// Below-fold: lazy JS chunks (HTML still SSR'd for SEO)
const TrustPillars   = dynamic(() => import("./components/TrustPillars"));
const Process        = dynamic(() => import("./components/Process"));
const Guarantees     = dynamic(() => import("./components/Guarantees"));
const Commission     = dynamic(() => import("./components/Commission"));
const ConsignmentForm = dynamic(() => import("./components/ConsignmentForm"));
const FAQ            = dynamic(() => import("./components/FAQ"));
const ContactCTA     = dynamic(() => import("./components/ContactCTA"));

export const metadata: Metadata = {
  title:
    "Titip Jual Properti | Solusindo Premier — Sistem Pemasaran Aset Premium, Tanpa Biaya Muka",
  description:
    "Titipkan rumah, apartemen, ruko, atau tanah Anda untuk dipasarkan oleh agent profesional Solusindo Premier. Sistem transparan, dilindungi perjanjian resmi, laporan mingguan, dan jaringan 266.000+ listing aktif.",
  keywords: [
    "Titip Jual Properti",
    "Jasa Jual Rumah Surabaya",
    "Agent Properti Profesional",
    "Solusindo Premier",
    "Pemasaran Aset",
    "Konsinyasi Properti",
    "Marketing Property Premium",
  ],
  alternates: { canonical: "/titip-jual" },
  openGraph: {
    title: "Titip Jual Properti — Solusindo Premier",
    description:
      "Sistem titip jual properti paling transparan di Indonesia. Tanpa biaya muka, dilindungi notaris, dipasarkan ke jaringan nasional.",
    url: "/titip-jual",
    siteName: "Solusindo Premier",
    type: "website",
    locale: "id_ID",
  },
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Konsinyasi & Pemasaran Properti",
  provider: {
    "@type": "Organization",
    name: "PT Solusi Tangguh Rejeki",
    alternateName: "Solusindo Premier",
  },
  areaServed: { "@type": "Country", name: "Indonesia" },
  description:
    "Layanan titip jual properti end-to-end: penilaian pasar, fotografi profesional, pemasaran multi-channel, negosiasi, hingga closing dengan notaris.",
  offers: {
    "@type": "Offer",
    priceCurrency: "IDR",
    description: "No upfront fee — komisi hanya setelah closing.",
  },
};

export default function TitipJualPage() {
  return (
    <main className="bg-[#05070D] min-h-screen text-white overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <ScrollProgress />
      <Hero />
      <TrustPillars />
      <Process />
      <Guarantees />
      <Commission />
      <ConsignmentForm />
      <FAQ />
      <ContactCTA />
    </main>
  );
}
