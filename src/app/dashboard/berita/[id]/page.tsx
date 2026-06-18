import BeritaEditor from "../components/BeritaEditor";

export default function EditBeritaPage({ params }: { params: { id: string } }) {
  return <BeritaEditor id={params.id} />;
}
