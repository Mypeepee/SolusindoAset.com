"use client";
import { DialogFrame } from "@/components/ui/dialog";
import { Instagram, Check, CircleAlert, ExternalLink } from "./MarketingIcons";
import { Action, type Data } from "./ui";
export default function InstagramSetupDialog({
  open,
  onOpenChange,
  setup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setup: Data["connection"]["instagram"]["setup"] | undefined;
}) {
  if (!setup) return null;
  const facebook = setup.loginMode === "facebook";
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Siapkan koneksi Instagram"
      description={`Persiapan ${facebook ? "Facebook Login" : "Unified Login"}, akun perusahaan, dan domain HTTPS sebelum menghubungkan Instagram.`}
      contentClassName="marketing-modal marketing-instagram-setup"
    >
      <Instagram size={25} aria-hidden="true" />
      <h2>Siapkan koneksi Instagram</h2>
      <p className="marketing-muted">
        {facebook
          ? "Hubungkan akun Instagram profesional perusahaan melalui Facebook yang memiliki akses ke Page terkait."
          : "Hubungkan akun perusahaan melalui Unified Login. Anda dapat masuk menggunakan Instagram atau Facebook dan memilih akun yang dibagikan."}
      </p>
      <ul
        className="marketing-setup-checks"
        aria-label="Kesiapan koneksi Instagram"
      >
        {setup.checks.map((check) => (
          <li key={check.key}>
            {check.ready ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <CircleAlert size={17} aria-hidden="true" />
            )}
            <span>
              {check.label}
              <code>{check.key}</code>
            </span>
            <strong
              className={check.ready ? "marketing-positive" : "marketing-muted"}
            >
              {check.ready ? "Siap" : "Belum siap"}
            </strong>
          </li>
        ))}
      </ul>
      <ol className="marketing-setup-steps">
        <li>
          <strong>Gunakan akun Instagram Business atau Creator.</strong>
          <p>
            Akun pribadi perlu diubah menjadi akun profesional melalui
            pengaturan Instagram.
          </p>
        </li>
        <li>
          <strong>
            Siapkan {facebook ? "Facebook Login" : "konfigurasi Unified Login"}{" "}
            di Meta.
          </strong>
          <p>
            Buka{" "}
            <a
              className="marketing-link"
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta for Developers <ExternalLink size={13} />
            </a>
            {facebook
              ? ", gunakan Instagram API → API setup with Facebook login. Facebook pengguna harus mempunyai akses pada Page yang terhubung ke akun Instagram perusahaan. Meta App ID dan App Secret diambil dari App settings → Basic."
              : ", pilih Instagram API → API setup with Unified login. Pilih konfigurasi berlabel Instagram Login Compatible dan salin Configuration ID. Meta App ID dan App Secret diambil dari App settings → Basic."}
          </p>
          <p>
            {facebook
              ? "Aktifkan instagram_basic, instagram_content_publish, instagram_manage_insights, pages_show_list, dan pages_read_engagement. Izin komentar diperlukan untuk membaca komentar."
              : "Melalui Edit permissions, pastikan izin membaca akun, menerbitkan konten, membaca komentar, dan instagram_manage_insights untuk analitik sudah aktif. Pertahankan izin pesan yang diwajibkan Meta."}
          </p>
        </li>
        <li>
          <strong>Daftarkan alamat kembali setelah login.</strong>
          <p>
            Gunakan domain HTTPS yang menjalankan aplikasi ini. Isi alamat
            berikut sebagai alamat callback login pada pengaturan Meta:
          </p>
          <code className="marketing-setup-callback">
            {setup.callbackUrl ||
              "https://domain-website-anda/api/dashboard/pemasaran/instagram/callback"}
          </code>
          {!setup.callbackUrl && (
            <p>
              Alamat di atas masih contoh. Domain publik belum dikonfigurasi.
            </p>
          )}
        </li>
        <li>
          <strong>Lengkapi konfigurasi server, lalu hubungkan.</strong>
          <p>
            {facebook
              ? "Lengkapi pemeriksaan server di atas. Buka Pemasaran dari domain HTTPS yang sama, masuk sebagai OWNER, lalu pilih Hubungkan. Masuk menggunakan Facebook administrator dan setujui akses akun perusahaan. Website memeriksa profil dan akses publikasi sebelum menyimpan koneksi."
              : "Simpan Meta App ID, Meta App Secret, Configuration ID, domain, dan kunci enkripsi di environment server. Restart aplikasi setelah perubahan. Buka Pemasaran dari domain HTTPS yang sama, masuk sebagai OWNER, lalu pilih Hubungkan. Pilih portofolio bisnis dan hanya akun Instagram perusahaan saat login. Untuk pengujian, beri akun akses sesuai peran yang diminta Meta; akun Instagram perlu menerima undangan tester."}
          </p>
        </li>
      </ol>
      <p className="marketing-footnote">
        App Secret dan kata sandi tidak perlu dikirim melalui chat. Penyiapan
        koneksi tidak mengaktifkan publikasi otomatis.
      </p>
      <div className="marketing-modal-actions">
        <a
          className="marketing-link"
          href={`https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-${facebook ? "facebook-login" : "unified-login"}/get-started`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Dokumentasi Meta <ExternalLink size={14} />
        </a>
        <Action onClick={() => onOpenChange(false)}>Tutup panduan</Action>
      </div>
    </DialogFrame>
  );
}
