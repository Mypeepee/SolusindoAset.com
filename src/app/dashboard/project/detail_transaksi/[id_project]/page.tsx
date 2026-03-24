import { redirect } from "next/navigation";

export default function DetailTransaksiPage({
  params,
}: {
  params: { id_project: string };
}) {
  redirect(`/dashboard/project/detail_transaksi/${params.id_project}/arus_kas`);
}