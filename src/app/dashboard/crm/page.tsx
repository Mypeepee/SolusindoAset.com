import { Metadata } from "next";
import CrmPageClient from "./components/CrmPageClient";

export const metadata: Metadata = {
  title: "CRM Klien — Dashboard",
  formatDetection: { telephone: false },
};

export default function CrmPage() {
  return <CrmPageClient />;
}
