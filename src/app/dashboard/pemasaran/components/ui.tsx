"use client";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { plannerStateLabels } from "@/lib/marketing/planner";
import { statusLabels } from "@/lib/marketing/domain";
import type { dashboard } from "@/lib/marketing/service.server";
export type Data = Awaited<ReturnType<typeof dashboard>>;
export type PlannerData = Pick<Data, "config" | "planner">;
export type Job = Data["jobs"]["items"][number];
export type Publication = Job["publications"][number];
export const number = (value: number | null | undefined) =>
  value == null
    ? "Belum tersedia"
    : new Intl.NumberFormat("id-ID").format(value);
const campaignDayFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
export const campaignDate = (day: string) =>
  campaignDayFormat.format(new Date(day + "T12:00:00Z"));
export const date = (
  value: Date | string | null | undefined,
  timeOnly = false,
) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        ...(timeOnly
          ? { hour: "2-digit", minute: "2-digit" }
          : {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
      }).format(new Date(value))
    : "Belum tersedia";
export const imageUrl = (id: string, name = "feed.jpg") =>
  "/api/dashboard/pemasaran/media?job=" + id + "&name=" + name;
export function stateLabels(state: string, errorCode?: string | null) {
  if (errorCode === "MEDIA_DELETED") return "Dihapus";
  return plannerStateLabels[state] || statusLabels[state] || state;
}
export function Pill({ state }: { state: string }) {
  return (
    <span className={"marketing-pill marketing-state-" + state}>
      {stateLabels(state)}
    </span>
  );
}
export const Action = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & { primary?: boolean }
>(function Action(
  {
    children,
    primary = false,
    className = "",
    onClick,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      type={type}
      onClick={onClick}
      className={
        "marketing-action " +
        (primary ? "marketing-action-primary " : "") +
        className
      }
      {...props}
    >
      {children}
    </Button>
  );
});
