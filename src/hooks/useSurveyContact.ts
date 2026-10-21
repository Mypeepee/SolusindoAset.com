"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

/** Data kontak survei selalu dimuat ulang saat dibuka, tanpa menimpa ketikan user. */
export function useSurveyContact(isOpen: boolean) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const sessionName = session?.user?.name || "";
  const [name, setNameValue] = useState("");
  const [phoneDigits, setPhoneValue] = useState("");
  const edited = useRef({ name: false, phone: false });

  useEffect(() => {
    edited.current = { name: false, phone: false };
    setNameValue("");
    setPhoneValue("");
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    if (!edited.current.name) setNameValue(sessionName);

    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (controller.signal.aborted || !data?.pengguna) return;
        if (!edited.current.name) {
          setNameValue(data.pengguna.nama_lengkap || sessionName);
        }
        if (!edited.current.phone) {
          let digits = String(data.pengguna.nomor_telepon || "").replace(/\D/g, "");
          if (digits.startsWith("62")) digits = digits.slice(2);
          digits = digits.replace(/^0+/, "");
          setPhoneValue(digits.slice(0, 12));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [isOpen, userId, sessionName]);

  const setName = useCallback((value: string) => {
    edited.current.name = true;
    setNameValue(value);
  }, []);
  const setPhoneDigits = useCallback((value: string) => {
    edited.current.phone = true;
    setPhoneValue(value);
  }, []);

  return { name, setName, phoneDigits, setPhoneDigits };
}
