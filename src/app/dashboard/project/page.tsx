"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import ProjectWalletCard from "./components/ProjectWalletCard";
import ProjectCategoryTabs from "./components/ProjectCategoryTabs";
import ProjectCampaignCard, {
  type ProjectCampaign,
} from "./components/ProjectCampaignCard";
import type { CreateProjectFormValues } from "./components/modal/AddProjectModal";

type ProjectListResponse = {
  success: boolean;
  data?: ProjectCampaign[];
  message?: string;
};

export default function ProjectPage() {
  const { data: session } = useSession();

  const [campaigns, setCampaigns] = useState<ProjectCampaign[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");

  const currentAgentId = (session?.user as any)?.agentId ?? null;

  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      setProjectError("");

      const response = await fetch("/api/project", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as ProjectListResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil daftar project.");
      }

      setCampaigns(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      setCampaigns([]);
      setProjectError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat mengambil project."
      );
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const totalDanaAsli = useMemo(
    () => campaigns.reduce((sum, item) => sum + item.totalPendanaan, 0),
    [campaigns]
  );

  const totalTarget = useMemo(
    () => campaigns.reduce((sum, item) => sum + item.targetPendanaan, 0),
    [campaigns]
  );

  const totalEstimasiProfit = useMemo(
    () => campaigns.reduce((sum, item) => sum + item.estimasiProfit, 0),
    [campaigns]
  );

  const projectAktif = campaigns.length;
  const jumlahPropertyDidanai = campaigns.length;

  async function handleProjectCreated(_values: CreateProjectFormValues) {
    await fetchProjects();
  }

  return (
    <main className="min-h-screen bg-transparent text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <ProjectWalletCard
          totalDana={totalDanaAsli}
          danaTerkumpul={totalDanaAsli}
          targetPendanaan={totalTarget}
          projectAktif={projectAktif}
          estimasiProfit={totalEstimasiProfit}
          jumlahPropertyDidanai={jumlahPropertyDidanai}
          jabatan="AGENT"
          createdById={currentAgentId ?? undefined}
          onCreateProject={handleProjectCreated}
        />

        <section id="status-project" className="space-y-5">
          <ProjectCategoryTabs />

          {loadingProjects ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              Mengambil data project...
            </div>
          ) : projectError ? (
            <div className="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-5 py-6 text-sm text-rose-200">
              {projectError}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-300">
              Belum ada project di database.
            </div>
          ) : (
            <div
              id="daftar-project"
              className="grid grid-cols-1 gap-5 lg:grid-cols-2"
            >
              {campaigns.map((project) => {
                const canManage =
                  Boolean(currentAgentId) &&
                  project.createdById === currentAgentId;

                return (
                  <ProjectCampaignCard
                    key={project.id}
                    project={project}
                    adminMode={canManage}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}