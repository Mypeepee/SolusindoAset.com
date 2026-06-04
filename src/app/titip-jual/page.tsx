import type { Metadata } from "next";
import ScrollProgress from "./components/ScrollProgress";
import Hero from "./components/Hero";
import TrustPillars from "./components/TrustPillars";
import Process from "./components/Process";
import Guarantees from "./components/Guarantees";
import Commission from "./components/Commission";
import ConsignmentForm from "./components/ConsignmentForm";
import FAQ from "./components/FAQ";
import ContactCTA from "./components/ContactCTA";

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
