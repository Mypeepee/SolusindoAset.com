import { getProjectFundDetail } from "./lib/get-project-fund-detail";
import ManageFundScreen from "./components/manage-fund-screen";

export default async function ManageFundPage({
  params,
}: {
  params: { id_project: string };
}) {
  const data = await getProjectFundDetail(params.id_project);

  return <ManageFundScreen data={data} />;
}