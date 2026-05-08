"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import Kalendar from "@/app/dashboard/jadwal-acara/components/kalendar";
import Todo from "@/app/dashboard/jadwal-acara/components/todo";
import ModalAcara from "@/app/dashboard/jadwal-acara/components/modal-acara";

interface EventData {
  id_acara: string;
  judul_acara: string;
  deskripsi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  waktu_mulai?: string;
  waktu_selesai?: string;
  tipe_acara: string;
  lokasi?: string;
  status_acara: string;
  id_property?: string;
}

type ModalMode = "create" | "edit" | "view";

export function AgentCalendar() {
  const [currentDate, setCurrentDate]     = useState(new Date());
  const [selectedDate, setSelectedDate]   = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<(EventData & { canEdit?: boolean }) | null>(null);
  const [events, setEvents]               = useState<EventData[]>([]);
  const [showModal, setShowModal]         = useState(false);
  const [modalMode, setModalMode]         = useState<ModalMode>("create");
  const [loading, setLoading]             = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth() + 1;
      const res = await fetch(`/api/dashboard/acara?year=${y}&month=${m}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      // silent — calendar still usable without events
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [currentDate]);

  const handleModalSuccess = () => { fetchEvents(); handleCloseModal(); };
  const handleCloseModal   = () => {
    setShowModal(false);
    setSelectedDate(null);
    setSelectedEvent(null);
    setModalMode("create");
  };

  const handleDateClick  = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setModalMode("create");
    setShowModal(true);
  };

  const handleEventClick = (event: EventData & { canEdit: boolean }) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setModalMode(event.canEdit ? "edit" : "view");
    setShowModal(true);
  };

  const handleAddEvent = () => {
    setSelectedDate(new Date());
    setSelectedEvent(null);
    setModalMode("create");
    setShowModal(true);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0f10] to-[#070a0b]">
      {/* top hairline */}
      <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent" />

      {/* header */}
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Jadwal & Acara</h3>
          <p className="mt-0.5 text-xs text-slate-500">Klik tanggal untuk tambah acara baru</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-1.5">
          {loading
            ? <Icon icon="solar:settings-linear" className="text-emerald-400 animate-spin text-sm" />
            : <Icon icon="solar:calendar-mark-bold" className="text-emerald-400 text-sm" />
          }
          <span className="text-xs font-bold text-emerald-300">
            {loading ? "Memuat..." : `${events.length} Acara`}
          </span>
        </div>
      </div>

      {/* body: calendar 3/4 + todo 1/4 */}
      <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Kalendar
            currentDate={currentDate}
            events={events}
            onDateClick={handleDateClick}
            onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            onToday={() => { const t = new Date(); setCurrentDate(t); setSelectedDate(t); }}
            onAddEvent={handleAddEvent}
          />
        </div>
        <div className="lg:col-span-1">
          <Todo events={events} onEventClick={handleEventClick} />
        </div>
      </div>

      <ModalAcara
        open={showModal}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent || undefined}
        onSuccess={handleModalSuccess}
        mode={modalMode}
      />
    </div>
  );
}
