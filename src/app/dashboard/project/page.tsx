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

type DeleteProjectResponse = {
  success: boolean;
  message?: string;
};

type InvestorWalletSummary = {
  idAgent?: string;
  totalDana: number;
  totalDanaLunas: number;
  totalDanaPending: number;
  projectAktif: number;
  jumlahPropertyDidanai: number;
  pendingPaymentCount: number;
  pendingProjectCount: number;
  hasPendingPayment: boolean;
};

type WalletSummaryResponse = {
  success: boolean;
  data?: InvestorWalletSummary;
  message?: string;
};

const EMPTY_WALLET_SUMMARY: InvestorWalletSummary = {
  totalDana: 0,
  totalDanaLunas: 0,
  totalDanaPending: 0,
  projectAktif: 0,
  jumlahPropertyDidanai: 0,
  pendingPaymentCount: 0,
  pendingProjectCount: 0,
  hasPendingPayment: false,
};

export default function ProjectPage() {
  const { data: session } = useSession();

  const [campaigns, setCampaigns] = useState<ProjectCampaign[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null
  );
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectCampaign | null>(null);
  const [walletSummary, setWalletSummary] =
    useState<InvestorWalletSummary>(EMPTY_WALLET_SUMMARY);

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

  const fetchWalletSummary = useCallback(async () => {
    if (!currentAgentId) {
      setWalletSummary(EMPTY_WALLET_SUMMARY);
      return;
    }

    try {
      const response = await fetch(
        `/api/project/wallet?id_agent=${encodeURIComponent(currentAgentId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = (await response.json()) as WalletSummaryResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengambil ringkasan wallet investor."
        );
      }

      setWalletSummary(result.data ?? EMPTY_WALLET_SUMMARY);
    } catch (error) {
      console.error("[FETCH_WALLET_SUMMARY_ERROR]", error);
      setWalletSummary(EMPTY_WALLET_SUMMARY);
    }
  }, [currentAgentId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchWalletSummary();
  }, [fetchWalletSummary]);

  const totalTarget = useMemo(
    () => campaigns.reduce((sum, item) => sum + item.targetPendanaan, 0),
    [campaigns]
  );

  const totalEstimasiProfit = useMemo(
    () => campaigns.reduce((sum, item) => sum + item.estimasiProfit, 0),
    [campaigns]
  );

  async function handleProjectCreated(_values: CreateProjectFormValues) {
    await Promise.all([fetchProjects(), fetchWalletSummary()]);
  }

  const handleAskDeleteProject = useCallback((project: ProjectCampaign) => {
    setProjectError("");
    setProjectToDelete(project);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (deletingProjectId) return;
    setProjectToDelete(null);
  }, [deletingProjectId]);

  const handleConfirmDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;

    try {
      setDeletingProjectId(projectToDelete.id);
      setProjectError("");

      const response = await fetch(
        `/api/project/${encodeURIComponent(projectToDelete.id)}`,
        {
          method: "DELETE",
        }
      );

      let result: DeleteProjectResponse | null = null;

      try {
        result = (await response.json()) as DeleteProjectResponse;
      } catch {
        result = null;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Gagal menghapus project.");
      }

      setCampaigns((prev) =>
        prev.filter((item) => item.id !== projectToDelete.id)
      );
      setProjectToDelete(null);

      await fetchWalletSummary();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menghapus project.";

      setProjectError(message);
      window.alert(message);
    } finally {
      setDeletingProjectId(null);
    }
  }, [projectToDelete, fetchWalletSummary]);

  return (
    <main className="min-h-screen bg-transparent text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <ProjectWalletCard
  totalDana={walletSummary.totalDana}
  totalDanaLunas={walletSummary.totalDanaLunas}
  totalDanaPending={walletSummary.totalDanaPending}
  projectAktif={walletSummary.projectAktif}
  jumlahPropertyDidanai={walletSummary.jumlahPropertyDidanai}
  pendingPaymentCount={walletSummary.pendingPaymentCount}
  pendingProjectCount={walletSummary.pendingProjectCount}
  hasPendingPayment={walletSummary.hasPendingPayment}
  realizedProfit={125_000_000}
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
                    isDeleting={deletingProjectId === project.id}
                    onDelete={canManage ? handleAskDeleteProject : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {projectToDelete ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup modal"
            onClick={handleCloseDeleteModal}
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
          />

          <div className="relative z-[201] w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#08111d_0%,#050a12_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_24%)]" />

            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
                  <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">
                Hapus project?
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Project ini akan dihapus total dari database beserta data turunannya.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Project
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {projectToDelete.nama}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {projectToDelete.id}
                </p>
              </div>

              <p className="mt-4 text-xs leading-5 text-rose-200/90">
                Tindakan ini tidak bisa dibatalkan.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={Boolean(deletingProjectId)}
                  className="rounded-[18px] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDeleteProject}
                  disabled={Boolean(deletingProjectId)}
                  className="rounded-[18px] border border-rose-400/20 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingProjectId ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}