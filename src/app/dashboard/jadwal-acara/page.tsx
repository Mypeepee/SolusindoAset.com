"use client";

import { AgentCalendar } from "@/app/dashboard/components/agent/AgentCalendar";
import { UpcomingEventsCard } from "@/app/dashboard/components/agent/premium/UpcomingEventsCard";

/* ────────────────────────────────────────────────────────────────────
   Jadwal & Acara — dedicated page.
   Mirrors the dashboard's ROW 2 layout 1:1:
   • Calendar (AgentCalendar, compact) on the left (2/3 width).
   • Agenda 7 Hari (UpcomingEventsCard) on the right (1/3 width),
     locked to the calendar's height via the absolute-positioning trick
     so the right card never pushes the row taller than the calendar.

   All state, fetching, modal, and cross-component sync are handled
   inside AgentCalendar + UpcomingEventsCard (they listen to the
   `acara:changed` window event), so this page is a thin shell.
   ──────────────────────────────────────────────────────────────────── */

export default function JadwalAcaraPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#040608] p-4 md:p-6">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3 lg:items-stretch">
        {/* Calendar — 2/3 width on lg+, full width below */}
        <div className="min-w-0 lg:col-span-2">
          <AgentCalendar compact />
        </div>

        {/* Agenda 7 Hari — 1/3 width on lg+, stretched to calendar height.
           On mobile/tablet, the absolute layer is dropped so the card
           simply stacks below the calendar at its natural height. */}
        <div className="relative min-w-0 lg:col-span-1">
          <div className="flex flex-col gap-3 sm:gap-4 lg:absolute lg:inset-0">
            <div className="min-w-0 lg:h-full">
              <UpcomingEventsCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
