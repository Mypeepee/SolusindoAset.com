"use client";

import type { ComponentProps } from "react";
import {
  ChevronRight,
  CircleAlert,
  Instagram,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Send,
} from "./MarketingIcons";
import { Action, type Data } from "./ui";
import MarketingNavigation from "./MarketingNavigation";
import headerStyles from "./marketing-header.module.css";

type Props = {
  data: Pick<Data, "config" | "connection"> | null;
  loading: boolean;
  editable: boolean;
  dirty: boolean;
  navigation: ComponentProps<typeof MarketingNavigation>;
  onRefresh: () => void;
  onAccount: () => void;
};

export default function MarketingHeader({
  data,
  loading,
  editable,
  dirty,
  navigation,
  onRefresh,
  onAccount,
}: Props) {
  const enabled = data?.config.enabled;
  return (
    <div className={headerStyles.shell}>
      <div className={headerStyles.core}>
        <header className={headerStyles.header}>
          <div className={headerStyles.identity}>
            <span className={headerStyles.emblem}>
              <Send size={23} />
            </span>
            <div className={headerStyles.identityCopy}>
              <p className={headerStyles.eyebrow}>
                {data?.config.companyName || "Akun perusahaan"}
              </p>
              <h1 className={headerStyles.title}>Pemasaran</h1>
              <p className={headerStyles.description}>
                Rencanakan konten. Kelola publikasi. Pantau hasilnya.
              </p>
            </div>
          </div>
          <div className={headerStyles.controls}>
            <button
              type="button"
              className={"marketing-live " + headerStyles.automation}
              data-active={!!data && enabled}
              disabled={!data || navigation.disabled}
              title="Buka pengaturan otomatisasi"
              aria-label={
                data
                  ? `Otomatisasi ${enabled ? "aktif" : "dijeda"}. Buka pengaturan otomatisasi`
                  : loading
                    ? "Memuat status otomatisasi"
                    : "Status otomatisasi belum tersedia"
              }
              onClick={() => navigation.onChange("pengaturan")}
            >
              {!data ? (
                loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CircleAlert size={14} />
                )
              ) : enabled ? (
                <Play size={14} />
              ) : (
                <Pause size={14} />
              )}
              <span className={headerStyles.automationLabel}>
                {data ? (
                  <>
                    <span className={headerStyles.automationPrefix}>
                      Otomatisasi{" "}
                    </span>
                    {enabled ? "aktif" : "dijeda"}
                  </>
                ) : loading ? "Memuat…" : "Belum dimuat"}
              </span>
            </button>
            <Action
              className={headerStyles.account}
              disabled={!data || !editable || dirty}
              aria-label={
                data?.connection.instagram.connected
                  ? "Kelola akun Instagram @" + data.connection.instagram.username
                  : "Hubungkan Instagram perusahaan"
              }
              title={
                data?.connection.instagram.connected
                  ? "Kelola @" + data.connection.instagram.username
                  : "Hubungkan Instagram perusahaan"
              }
              onClick={onAccount}
            >
              <span className={headerStyles.accountIcon}>
                <Instagram size={17} />
              </span>
              <span className={headerStyles.accountName}>
                {data?.connection.instagram.connected
                  ? "@" + data.connection.instagram.username
                  : "Hubungkan Instagram"}
              </span>
              <ChevronRight size={13} className={headerStyles.accountArrow} />
            </Action>
            <Action
              className={headerStyles.refresh}
              aria-label="Perbarui Pemasaran"
              aria-busy={loading}
              title="Perbarui Pemasaran"
              disabled={!editable || dirty}
              onClick={onRefresh}
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
            </Action>
          </div>
        </header>
        <div className={headerStyles.navigation}>
          <MarketingNavigation {...navigation} />
        </div>
      </div>
    </div>
  );
}
