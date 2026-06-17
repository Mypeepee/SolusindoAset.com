"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import {
  motion,
  useScroll,
  useSpring,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────
   Konstanta perusahaan
   ────────────────────────────────────────────────────────────────────────── */
const COMPANY = {
  legal: "PT. Solusi Tangguh Rejeki",
  brand: "SolusindoAset.com",
  email: "closingsystem@gmail.com",
  phone: "+62 811-0000-0000",
  address:
    "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur 60262",
  lastUpdated: "17 Juni 2026",
  version: "v2.1",
};

/* ──────────────────────────────────────────────────────────────────────────
   Animasi
   ────────────────────────────────────────────────────────────────────────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Primitif konten
   ────────────────────────────────────────────────────────────────────────── */
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/55 text-[15px] leading-relaxed">{children}</p>;
}

function Em({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-300/90 font-semibold">{children}</span>;
}

function Clause({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="flex items-start gap-2 text-white font-semibold text-[15.5px] mb-2.5">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
        {title}
      </h3>
      <div className="pl-3.5 border-l border-white/[0.07] space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 text-white/55 text-[14.5px] leading-relaxed"
        >
          <Icon
            icon="solar:check-circle-bold"
            className="mt-0.5 shrink-0 text-emerald-400/70 text-base"
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({
  icon,
  tone = "emerald",
  children,
}: {
  icon: string;
  tone?: "emerald" | "amber";
  children: React.ReactNode;
}) {
  const tones = {
    emerald: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300/80",
    amber: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300/80",
  } as const;
  return (
    <div
      className={`mt-5 flex gap-3 rounded-2xl border ${tones[tone]} p-4 backdrop-blur-sm`}
    >
      <Icon icon={icon} className="shrink-0 text-xl mt-0.5" />
      <p className="text-[14px] leading-relaxed text-white/65">{children}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Konten kebijakan privasi
   ────────────────────────────────────────────────────────────────────────── */
type Section = { id: string; title: string; icon: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    id: "pendahuluan",
    title: "Pendahuluan",
    icon: "solar:hand-shake-bold-duotone",
    body: (
      <>
        <P>
          Selamat datang di <Em>{COMPANY.brand}</Em>. Kebijakan Privasi ini
          dikelola oleh <Em>{COMPANY.legal}</Em> (“Kami”, “Perusahaan”, atau
          “{COMPANY.brand}”), selaku{" "}
          <Em>Pengendali Data Pribadi</Em> atas layanan platform properti,
          jual-beli, sewa, lelang aset, serta layanan keagenan yang kami
          sediakan melalui situs web dan aplikasi kami (selanjutnya disebut
          “Layanan”).
        </P>
        <P>
          Privasi Anda adalah prioritas kami. Dokumen ini menjelaskan secara
          transparan bagaimana kami mengumpulkan, menggunakan, menyimpan,
          membagikan, dan melindungi Data Pribadi Anda ketika Anda mengakses
          atau menggunakan Layanan. Kebijakan ini disusun dengan mengacu pada{" "}
          <Em>
            Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang
            Pelindungan Data Pribadi (“UU PDP”)
          </Em>{" "}
          serta peraturan pelaksananya, dan diselaraskan dengan praktik terbaik
          internasional seperti prinsip <Em>GDPR</Em>.
        </P>
        <Callout icon="solar:info-circle-bold-duotone">
          Dengan mendaftar, mengakses, atau menggunakan Layanan kami, Anda
          menyatakan telah membaca, memahami, dan menyetujui praktik yang
          diuraikan dalam Kebijakan Privasi ini. Jika Anda tidak menyetujui
          kebijakan ini, mohon untuk tidak menggunakan Layanan kami.
        </Callout>
      </>
    ),
  },
  {
    id: "pengumpulan-data",
    title: "Data yang Kami Kumpulkan",
    icon: "solar:inbox-archive-bold-duotone",
    body: (
      <>
        <P>
          Kami hanya mengumpulkan Data Pribadi yang relevan dan diperlukan untuk
          menyediakan Layanan kepada Anda. Pengumpulan data dilakukan melalui
          tiga jalur berikut:
        </P>
        <Clause title="1. Data yang Anda Berikan Secara Langsung">
          <P>
            Data yang Anda serahkan secara sukarela ketika berinteraksi dengan
            kami, antara lain:
          </P>
          <List
            items={[
              <>
                <Em>Data Akun & Identitas:</Em> nama lengkap, alamat email,
                nomor telepon/WhatsApp, dan kata sandi.
              </>,
              <>
                <Em>Data Transaksi & Properti:</Em> detail properti yang Anda
                jual, beli, sewa, atau titip-jual, preferensi pencarian,
                anggaran, serta riwayat penawaran.
              </>,
              <>
                <Em>Data Verifikasi:</Em> dokumen pendukung (mis. KTP, NPWP,
                bukti kepemilikan) yang Anda unggah untuk verifikasi keagenan
                atau keabsahan listing — hanya bila diperlukan dan dengan
                persetujuan Anda.
              </>,
              <>
                <Em>Komunikasi:</Em> isi pesan, pertanyaan, dan masukan yang Anda
                kirimkan melalui formulir, live chat, atau layanan pelanggan.
              </>,
            ]}
          />
        </Clause>
        <Clause title="2. Data yang Dikumpulkan Secara Otomatis">
          <P>
            Saat Anda menggunakan Layanan, sebagian data terkumpul secara
            otomatis melalui teknologi:
          </P>
          <List
            items={[
              <>
                <Em>Data Perangkat & Log:</Em> alamat IP, jenis perangkat, sistem
                operasi, jenis peramban, pengenal perangkat, dan zona waktu.
              </>,
              <>
                <Em>Data Penggunaan:</Em> halaman yang dikunjungi, properti yang
                dilihat, durasi kunjungan, tautan yang diklik, serta URL rujukan.
              </>,
              <>
                <Em>Data Lokasi Perkiraan:</Em> berdasarkan alamat IP atau—dengan
                izin Anda—lokasi presisi perangkat untuk menampilkan properti di
                sekitar Anda.
              </>,
            ]}
          />
        </Clause>
        <Clause title="3. Data dari Pihak Ketiga">
          <List
            items={[
              <>
                <Em>Penyedia Login Sosial:</Em> bila Anda mendaftar via Google,
                kami menerima nama, email, dan foto profil sesuai izin yang Anda
                berikan.
              </>,
              <>
                <Em>Mitra Bisnis & Agen:</Em> data referensi properti atau
                prospek yang dibagikan oleh agen rekanan kami.
              </>,
              <>
                <Em>Penyedia Pembayaran:</Em> status transaksi dari payment
                gateway resmi (kami tidak menyimpan nomor lengkap kartu Anda).
              </>,
            ]}
          />
        </Clause>
      </>
    ),
  },
  {
    id: "jenis-data",
    title: "Jenis Data Pribadi",
    icon: "solar:layers-bold-duotone",
    body: (
      <>
        <P>
          Sesuai UU PDP, Data Pribadi yang kami proses dikategorikan menjadi dua
          jenis:
        </P>
        <Clause title="Data Pribadi yang Bersifat Umum">
          <List
            items={[
              "Nama lengkap dan tanda pengenal umum;",
              "Alamat email, nomor telepon, dan alamat domisili;",
              "Data preferensi properti dan riwayat aktivitas di platform.",
            ]}
          />
        </Clause>
        <Clause title="Data Pribadi yang Bersifat Spesifik">
          <P>
            Kami pada dasarnya <Em>tidak</Em> mengumpulkan data spesifik (seperti
            data biometrik, kesehatan, pandangan politik, atau keuangan rinci).
            Apabila diperlukan untuk verifikasi legal atau kepatuhan (mis. data
            pada KTP/NPWP), data tersebut hanya diproses berdasarkan{" "}
            <Em>persetujuan eksplisit</Em> Anda dan dilindungi dengan pengamanan
            tingkat lanjut.
          </P>
        </Clause>
        <Callout icon="solar:shield-check-bold-duotone">
          Kami menerapkan prinsip <Em>minimalisasi data</Em>: hanya data yang
          benar-benar diperlukan untuk tujuan yang sah yang akan kami kumpulkan
          dan simpan.
        </Callout>
      </>
    ),
  },
  {
    id: "tujuan-penggunaan",
    title: "Dasar Hukum & Tujuan Penggunaan",
    icon: "solar:cpu-bolt-bold-duotone",
    body: (
      <>
        <P>
          Kami memproses Data Pribadi Anda hanya jika terdapat dasar hukum yang
          sah, yaitu: persetujuan Anda, pelaksanaan kontrak/Layanan, pemenuhan
          kewajiban hukum, atau kepentingan sah Perusahaan yang seimbang dengan
          hak Anda. Tujuan pemrosesan meliputi:
        </P>
        <List
          items={[
            <>
              <Em>Menyediakan Layanan:</Em> membuat & mengelola akun, menampilkan
              listing, memfasilitasi pencarian, penawaran, dan transaksi
              properti.
            </>,
            <>
              <Em>Komunikasi:</Em> mengirim notifikasi transaksi, konfirmasi,
              pengingat, dan respons atas pertanyaan Anda.
            </>,
            <>
              <Em>Personalisasi:</Em> merekomendasikan properti yang relevan
              dengan preferensi dan lokasi Anda.
            </>,
            <>
              <Em>Keamanan & Pencegahan Penipuan:</Em> memverifikasi identitas,
              mendeteksi aktivitas mencurigakan, dan melindungi pengguna lain.
            </>,
            <>
              <Em>Peningkatan Layanan:</Em> analitik agregat untuk memahami
              tren penggunaan dan menyempurnakan fitur.
            </>,
            <>
              <Em>Pemasaran (Opsional):</Em> mengirim penawaran, newsletter, dan
              info lelang—hanya jika Anda berlangganan, dan dapat Anda hentikan
              kapan saja.
            </>,
            <>
              <Em>Kepatuhan Hukum:</Em> memenuhi kewajiban perpajakan, audit,
              serta permintaan sah dari otoritas yang berwenang.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "cookie",
    title: "Cookie & Teknologi Pelacakan",
    icon: "solar:eye-scan-bold-duotone",
    body: (
      <>
        <P>
          Kami menggunakan cookie dan teknologi serupa (local storage, pixel,
          SDK) untuk menjaga sesi login Anda, mengingat preferensi, dan mengukur
          performa Layanan. Jenis cookie yang kami gunakan:
        </P>
        <List
          items={[
            <>
              <Em>Cookie Esensial:</Em> wajib agar Layanan berfungsi (mis. sesi
              login & keamanan). Tidak dapat dinonaktifkan.
            </>,
            <>
              <Em>Cookie Fungsional:</Em> mengingat preferensi seperti bahasa dan
              filter pencarian.
            </>,
            <>
              <Em>Cookie Analitik:</Em> membantu kami memahami cara Layanan
              digunakan secara anonim/agregat.
            </>,
            <>
              <Em>Cookie Pemasaran:</Em> menampilkan iklan yang relevan—hanya
              aktif dengan persetujuan Anda.
            </>,
          ]}
        />
        <Callout icon="solar:settings-bold-duotone">
          Anda dapat mengatur atau menghapus cookie melalui pengaturan peramban
          Anda. Menonaktifkan cookie tertentu dapat memengaruhi sebagian fungsi
          Layanan.
        </Callout>
      </>
    ),
  },
  {
    id: "berbagi-data",
    title: "Berbagi Data & Pihak Ketiga",
    icon: "solar:users-group-rounded-bold-duotone",
    body: (
      <>
        <Callout icon="solar:lock-keyhole-minimalistic-bold-duotone">
          <Em>Kami tidak pernah menjual Data Pribadi Anda kepada pihak mana
          pun.</Em>{" "}
          Data Anda hanya dibagikan secara terbatas dan untuk tujuan yang sah
          sebagaimana diuraikan di bawah ini.
        </Callout>
        <P>Kami dapat membagikan data Anda kepada:</P>
        <List
          items={[
            <>
              <Em>Agen & Penjual/Pemilik Properti:</Em> ketika Anda secara aktif
              mengajukan minat atau penawaran, data kontak relevan dibagikan agar
              transaksi dapat berlangsung.
            </>,
            <>
              <Em>Penyedia Layanan Tepercaya:</Em> mitra hosting cloud, payment
              gateway, pengiriman pesan (email/WhatsApp), dan analitik—terikat
              perjanjian kerahasiaan dan hanya boleh memproses data sesuai
              instruksi kami.
            </>,
            <>
              <Em>Profesional & Penasihat:</Em> notaris, PPAT, atau penasihat
              hukum—sebatas yang diperlukan untuk menyelesaikan transaksi yang
              Anda inisiasi.
            </>,
            <>
              <Em>Otoritas yang Berwenang:</Em> bila diwajibkan oleh hukum,
              putusan pengadilan, atau untuk melindungi hak, properti, dan
              keselamatan.
            </>,
            <>
              <Em>Transaksi Korporasi:</Em> dalam hal merger, akuisisi, atau
              restrukturisasi, dengan tetap menjaga tingkat perlindungan yang
              setara.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "retensi",
    title: "Penyimpanan & Retensi Data",
    icon: "solar:clock-circle-bold-duotone",
    body: (
      <>
        <P>
          Kami menyimpan Data Pribadi Anda hanya selama diperlukan untuk
          memenuhi tujuan pengumpulannya, atau selama diwajibkan oleh peraturan
          perundang-undangan (mis. kewajiban penyimpanan dokumen transaksi dan
          perpajakan).
        </P>
        <List
          items={[
            "Data akun aktif disimpan selama akun Anda masih aktif;",
            "Data transaksi disimpan sesuai kewajiban hukum dan keperluan audit;",
            "Setelah periode retensi berakhir, data akan dihapus secara aman atau dianonimkan sehingga tidak lagi dapat dikaitkan dengan Anda.",
          ]}
        />
        <P>
          Anda dapat mengajukan penghapusan akun dan data Anda kapan saja melalui
          kontak pada bagian akhir kebijakan ini, kecuali atas data yang wajib
          kami simpan menurut hukum.
        </P>
      </>
    ),
  },
  {
    id: "keamanan",
    title: "Keamanan Data",
    icon: "solar:shield-keyhole-bold-duotone",
    body: (
      <>
        <P>
          Kami menerapkan langkah pengamanan teknis dan organisasional yang wajar
          dan sesuai standar industri untuk melindungi data Anda dari akses,
          pengungkapan, perubahan, atau penghancuran yang tidak sah:
        </P>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          {[
            { i: "solar:lock-password-bold-duotone", t: "Enkripsi", d: "Transmisi data dilindungi enkripsi TLS/SSL." },
            { i: "solar:server-2-bold-duotone", t: "Infrastruktur Aman", d: "Server di pusat data tepercaya dengan akses terbatas." },
            { i: "solar:key-minimalistic-2-bold-duotone", t: "Kontrol Akses", d: "Prinsip hak akses minimum bagi staf berwenang." },
            { i: "solar:bug-minimalistic-bold-duotone", t: "Pemantauan", d: "Pengawasan & audit berkala untuk mendeteksi anomali." },
          ].map((b) => (
            <div
              key={b.t}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <Icon icon={b.i} className="text-emerald-400 text-2xl mb-2" />
              <p className="text-white font-semibold text-sm">{b.t}</p>
              <p className="text-white/45 text-[13px] leading-snug mt-1">{b.d}</p>
            </div>
          ))}
        </div>
        <Callout icon="solar:shield-warning-bold-duotone" tone="amber">
          Tidak ada sistem yang 100% kebal. Meskipun kami berupaya maksimal,
          Anda juga bertanggung jawab menjaga kerahasiaan kata sandi dan tidak
          membagikannya kepada pihak lain. Jika Anda menduga terjadi pelanggaran
          keamanan, segera hubungi kami.
        </Callout>
      </>
    ),
  },
  {
    id: "hak-anda",
    title: "Hak Anda sebagai Pengguna",
    icon: "solar:user-id-bold-duotone",
    body: (
      <>
        <P>
          Sesuai UU PDP, sebagai Subjek Data Pribadi Anda memiliki hak-hak
          berikut, yang dapat Anda gunakan dengan menghubungi kami:
        </P>
        <List
          items={[
            <><Em>Hak Akses & Informasi</Em> — mengetahui dan memperoleh salinan data Anda yang kami proses.</>,
            <><Em>Hak Pembetulan</Em> — memperbaiki data yang tidak akurat atau tidak lengkap.</>,
            <><Em>Hak Penghapusan</Em> — meminta penghapusan data Anda (“hak untuk dilupakan”) sesuai ketentuan hukum.</>,
            <><Em>Hak Menarik Persetujuan</Em> — mencabut persetujuan pemrosesan kapan saja, tanpa memengaruhi keabsahan pemrosesan sebelumnya.</>,
            <><Em>Hak Membatasi & Menolak</Em> — membatasi atau menolak pemrosesan tertentu, termasuk untuk tujuan pemasaran.</>,
            <><Em>Hak Portabilitas</Em> — memperoleh data Anda dalam format yang dapat dibaca mesin.</>,
            <><Em>Hak Mengajukan Keberatan</Em> — menyampaikan keluhan kepada kami atau kepada lembaga yang berwenang.</>,
          ]}
        />
        <Callout icon="solar:clock-square-bold-duotone">
          Kami akan menanggapi setiap permintaan yang sah dalam jangka waktu yang
          wajar dan sesuai ketentuan UU PDP. Kami dapat meminta verifikasi
          identitas untuk melindungi data Anda dari permintaan yang tidak sah.
        </Callout>
      </>
    ),
  },
  {
    id: "data-anak",
    title: "Data Anak di Bawah Umur",
    icon: "solar:users-group-two-rounded-bold-duotone",
    body: (
      <>
        <P>
          Layanan kami ditujukan untuk pengguna yang telah berusia{" "}
          <Em>18 tahun atau lebih</Em>, atau telah cakap secara hukum untuk
          melakukan perjanjian. Kami tidak dengan sengaja mengumpulkan data anak
          di bawah umur. Untuk anak, pemrosesan data hanya dilakukan dengan
          persetujuan orang tua atau wali yang sah sebagaimana diatur UU PDP.
        </P>
        <P>
          Apabila kami mengetahui telah mengumpulkan data anak tanpa persetujuan
          yang sah, kami akan segera menghapusnya. Jika Anda meyakini hal ini
          terjadi, mohon hubungi kami.
        </P>
      </>
    ),
  },
  {
    id: "transfer-internasional",
    title: "Transfer Data Lintas Negara",
    icon: "solar:global-bold-duotone",
    body: (
      <>
        <P>
          Sebagian penyedia layanan kami (mis. infrastruktur cloud atau
          analitik) dapat memproses data di luar wilayah Indonesia. Dalam hal
          demikian, kami memastikan transfer dilakukan dengan tingkat
          perlindungan yang memadai dan setara sebagaimana dipersyaratkan UU PDP,
          melalui klausul kontraktual yang sesuai dan penyedia bereputasi.
        </P>
      </>
    ),
  },
  {
    id: "perubahan",
    title: "Perubahan Kebijakan",
    icon: "solar:refresh-circle-bold-duotone",
    body: (
      <>
        <P>
          Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu untuk
          mencerminkan perubahan pada Layanan, teknologi, atau peraturan yang
          berlaku. Setiap perubahan material akan kami beritahukan melalui situs
          atau saluran komunikasi resmi. Tanggal “Terakhir diperbarui” di atas
          menunjukkan versi terkini. Penggunaan Layanan secara berkelanjutan
          setelah pembaruan dianggap sebagai persetujuan Anda atas kebijakan yang
          telah diperbarui.
        </P>
      </>
    ),
  },
  {
    id: "kontak",
    title: "Hubungi Kami",
    icon: "solar:letter-bold-duotone",
    body: (
      <>
        <P>
          Jika Anda memiliki pertanyaan, permintaan terkait data, atau keberatan
          mengenai Kebijakan Privasi ini, silakan hubungi Pengendali Data kami:
        </P>
        <div className="mt-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Icon icon="solar:buildings-3-bold-duotone" className="text-emerald-400 text-xl" />
            <div>
              <p className="text-white/40 text-[11px] uppercase tracking-wider">Pengendali Data</p>
              <p className="text-white font-semibold text-sm">{COMPANY.legal}</p>
            </div>
          </div>
          <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 group">
            <Icon icon="solar:letter-bold-duotone" className="text-emerald-400 text-xl" />
            <div>
              <p className="text-white/40 text-[11px] uppercase tracking-wider">Email</p>
              <p className="text-white group-hover:text-emerald-300 transition-colors font-semibold text-sm">{COMPANY.email}</p>
            </div>
          </a>
          <div className="flex items-start gap-3">
            <Icon icon="solar:map-point-bold-duotone" className="text-emerald-400 text-xl mt-0.5" />
            <div>
              <p className="text-white/40 text-[11px] uppercase tracking-wider">Alamat</p>
              <p className="text-white/70 text-sm leading-relaxed">{COMPANY.address}</p>
            </div>
          </div>
        </div>
      </>
    ),
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Scroll-spy untuk Daftar Isi
   ────────────────────────────────────────────────────────────────────────── */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/* ──────────────────────────────────────────────────────────────────────────
   Halaman
   ────────────────────────────────────────────────────────────────────────── */
export default function PrivacyPolicyPage() {
  const ids = useMemo(() => SECTIONS.map((s) => s.id), []);
  const active = useScrollSpy(ids);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: "smooth" });
    setMobileTocOpen(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04100B] text-white selection:bg-emerald-500/30">
      {/* Progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed left-0 top-0 z-[60] h-0.5 w-full origin-left bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300"
      />

      {/* ── Ambient background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.14),transparent_70%)]" />
        <motion.div
          animate={reduce ? undefined : { y: [0, 30, 0], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[140px]"
        />
        <motion.div
          animate={reduce ? undefined : { y: [0, -40, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-teal-500/10 blur-[130px]"
        />
        <div className="absolute bottom-0 -left-32 h-[360px] w-[360px] rounded-full bg-emerald-600/[0.07] blur-[120px]" />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.07) 1px,transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%)",
          }}
        />
      </div>

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative bg-transparent px-6 pt-24 pb-16 md:pt-28 md:pb-20">
        <div className="container mx-auto max-w-screen-xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur-md">
              <Icon icon="solar:shield-check-bold" className="text-sm" />
              Privasi & Keamanan Data
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">
              Kebijakan{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Privasi
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/55 md:text-lg">
              Bagaimana <Em>{COMPANY.brand}</Em> mengumpulkan, menggunakan, dan
              melindungi data Anda — disusun secara transparan, sesuai{" "}
              <Em>UU No. 27 Tahun 2022 (UU PDP)</Em>, untuk memastikan setiap
              langkah Anda di platform kami tetap aman.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5">
                <Icon icon="solar:calendar-mark-bold-duotone" className="text-emerald-400" />
                Terakhir diperbarui: {COMPANY.lastUpdated}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5">
                <Icon icon="solar:document-bold-duotone" className="text-emerald-400" />
                Versi {COMPANY.version}
              </span>
            </div>
          </Reveal>

          {/* Trust badges */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4"
          >
            {[
              { i: "solar:lock-keyhole-minimalistic-bold-duotone", t: "Data Terenkripsi", d: "TLS/SSL" },
              { i: "solar:hand-money-bold-duotone", t: "Tidak Dijual", d: "Ke pihak ketiga" },
              { i: "solar:scale-bold-duotone", t: "Patuh UU PDP", d: "No. 27/2022" },
              { i: "solar:user-check-rounded-bold-duotone", t: "Hak Anda", d: "Sepenuhnya" },
            ].map((b) => (
              <motion.div
                key={b.t}
                variants={fadeUp}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]"
              >
                <Icon
                  icon={b.i}
                  className="mx-auto text-3xl text-emerald-400 transition-transform duration-300 group-hover:scale-110"
                />
                <p className="mt-2.5 text-sm font-semibold text-white">{b.t}</p>
                <p className="text-[11px] text-white/40">{b.d}</p>
              </motion.div>
            ))}
          </motion.div>

          <Reveal delay={0.1}>
            <button
              onClick={() => scrollTo(SECTIONS[0].id)}
              className="mt-14 inline-flex flex-col items-center gap-2 text-white/40 transition-colors hover:text-emerald-300"
            >
              <span className="text-[11px] uppercase tracking-[0.25em]">Mulai Membaca</span>
              <motion.span
                animate={reduce ? undefined : { y: [0, 6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <Icon icon="solar:alt-arrow-down-line-duotone" className="text-2xl" />
              </motion.span>
            </button>
          </Reveal>
        </div>
      </section>

      {/* ════════════════ KONTEN ════════════════ */}
      <section className="relative bg-transparent px-6 pb-28">
        <div className="container mx-auto max-w-screen-xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* ── Daftar isi (desktop) ── */}
            <aside className="hidden lg:col-span-4 lg:block xl:col-span-3">
              <div className="sticky top-28">
                <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/80">
                  <Icon icon="solar:list-bold-duotone" />
                  Daftar Isi
                </p>
                <nav className="space-y-1">
                  {SECTIONS.map((s, i) => {
                    const on = active === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => scrollTo(s.id)}
                        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition-all duration-200 ${
                          on
                            ? "bg-emerald-500/10 text-white"
                            : "text-white/45 hover:bg-white/[0.03] hover:text-white/80"
                        }`}
                      >
                        {on && (
                          <motion.span
                            layoutId="toc-active"
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-emerald-400"
                          />
                        )}
                        <Icon
                          icon={s.icon}
                          className={`shrink-0 text-lg transition-colors ${
                            on ? "text-emerald-400" : "text-white/30 group-hover:text-emerald-400/70"
                          }`}
                        />
                        <span className="line-clamp-1">
                          <span className="mr-1.5 text-[11px] tabular-nums text-emerald-400/50">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {s.title}
                        </span>
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4">
                  <Icon icon="solar:shield-star-bold-duotone" className="text-2xl text-emerald-400" />
                  <p className="mt-2 text-[13px] font-semibold text-white">Butuh bantuan?</p>
                  <p className="mt-1 text-[12px] leading-snug text-white/45">
                    Tim kami siap menjawab pertanyaan privasi Anda.
                  </p>
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Hubungi kami
                    <Icon icon="solar:arrow-right-linear" />
                  </a>
                </div>
              </div>
            </aside>

            {/* ── Daftar isi (mobile / tablet) ── */}
            <div className="lg:hidden">
              <button
                onClick={() => setMobileTocOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-md"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <Icon icon="solar:list-bold-duotone" className="text-emerald-400 text-lg" />
                  Daftar Isi
                </span>
                <Icon
                  icon="solar:alt-arrow-down-linear"
                  className={`text-white/50 transition-transform duration-300 ${mobileTocOpen ? "rotate-180" : ""}`}
                />
              </button>
              <motion.nav
                initial={false}
                animate={{ height: mobileTocOpen ? "auto" : 0, opacity: mobileTocOpen ? 1 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="mt-2 grid grid-cols-1 gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 sm:grid-cols-2">
                  {SECTIONS.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/55 transition-colors hover:bg-emerald-500/10 hover:text-white"
                    >
                      <Icon icon={s.icon} className="shrink-0 text-base text-emerald-400/70" />
                      <span className="line-clamp-1">
                        <span className="mr-1 text-[11px] text-emerald-400/50">{String(i + 1).padStart(2, "0")}</span>
                        {s.title}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.nav>
            </div>

            {/* ── Sections ── */}
            <div className="lg:col-span-8 xl:col-span-9">
              <div className="space-y-5">
                {SECTIONS.map((s, i) => (
                  <Reveal key={s.id}>
                    <article
                      id={s.id}
                      className="group scroll-mt-28 rounded-3xl border border-white/[0.07] bg-white/[0.015] p-6 backdrop-blur-sm transition-colors duration-300 hover:border-emerald-500/20 md:p-8"
                    >
                      <header className="mb-5 flex items-center gap-4 border-b border-white/[0.06] pb-5">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08]">
                          <Icon icon={s.icon} className="text-2xl text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold tracking-[0.2em] text-emerald-400/60">
                            BAGIAN {String(i + 1).padStart(2, "0")}
                          </p>
                          <h2 className="text-xl font-bold text-white md:text-2xl">
                            {s.title}
                          </h2>
                        </div>
                      </header>
                      <div className="space-y-3.5">{s.body}</div>
                    </article>
                  </Reveal>
                ))}
              </div>

              {/* Penutup / persetujuan */}
              <Reveal>
                <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.1] via-emerald-500/[0.03] to-transparent p-8 text-center">
                  <Icon icon="solar:verified-check-bold-duotone" className="mx-auto text-4xl text-emerald-400" />
                  <h3 className="mt-4 text-xl font-bold text-white md:text-2xl">
                    Privasi Anda, Komitmen Kami
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/55">
                    Dengan menggunakan {COMPANY.brand}, Anda mempercayakan data
                    Anda kepada kami — dan kami menjaganya dengan serius. Untuk
                    pertanyaan lebih lanjut, tim kami selalu siap membantu.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={`mailto:${COMPANY.email}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-[#04100B] shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-[0_0_45px_rgba(16,185,129,0.55)]"
                    >
                      <Icon icon="solar:letter-bold" className="text-lg" />
                      Hubungi Tim Privasi
                    </a>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white transition-all hover:border-emerald-500/40 hover:bg-white/[0.06]"
                    >
                      <Icon icon="solar:home-smile-bold" className="text-lg" />
                      Kembali ke Beranda
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
