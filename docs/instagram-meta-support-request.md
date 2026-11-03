# Permintaan investigasi ke Meta

Status: **draf siap disalin; belum dikirim**. Pada 27 Oktober 2026, pemilik
memilih konfirmasi ke Meta menggunakan portofolio yang sekarang. Sesi kerja
ini tidak memiliki akses formulir dukungan yang terautentikasi ke akun Meta.

## Cara menggunakan

1. Masuk ke Meta Developers dengan akun administrator SolusindoAset.
2. Buka **Support → Bugs**, lalu buat laporan pada kategori Instagram API /
   Facebook Login for Business yang tersedia.
3. Salin judul dan isi berbahasa Inggris di bawah. Jika formulir meminta
   langkah reproduksi terpisah, gunakan bagian Reproduction.
4. Sertakan tangkapan layar consent berhasil dan Connected apps yang
   menampilkan Instagram perusahaan. Tambahkan bukti peran admin/tester bila
   diminta. Hindari gambar yang memperlihatkan token atau App Secret.
5. Setelah terkirim, simpan nomor atau tautan tiket untuk menindaklanjuti
   jawaban Meta. Dokumen ini tidak mengasumsikan tiket sudah dibuat.

Rute menu tersebut mengikuti [Support resources Instagram Platform](https://developers.facebook.com/documentation/instagram-platform/support).
Formulir dan kanal bantuan yang tersedia tetap bergantung pada akun Meta.

## Title

Unified Login: successful consent but assigned_instagram_accounts is empty and the shared Instagram profile returns 100/33

## Description — ready to paste

We need help investigating Instagram API with Unified Login for our own
professional Instagram account in Development mode.

Integration:

- Meta app: SolusindoAset, App ID 1113966761486383.
- Unified Login config_id: 1106771008629719.
- Client business: Solusindo Premier Property, ID 1594322086067570.
- Instagram: @solusindopremier, account ID 17841419691674191.
- API host/version: graph.facebook.com/v26.0.
- App is Unpublished; Standard Access is believed to be in use.
- The app and Instagram account belong to the same business portfolio.

Reproduction:

1. Start Unified Login with the app ID, config_id, matching redirect_uri,
   response_type=code and override_default_response_type=true.
2. Select the expected business portfolio and @solusindopremier, then approve.
   Meta displays a successful connection. Connected apps shows this Instagram
   account shared with SolusindoAset.
3. Exchange the authorization code on the server. Token inspection confirms
   is_valid=true, type=SYSTEM_USER, the expected App ID, and all five scopes:
   instagram_basic, instagram_content_publish, instagram_manage_comments,
   instagram_manage_messages, instagram_manage_insights.
4. GET /me?fields=client_business_id returns 1594322086067570.
5. GET /me/assigned_instagram_accounts?fields=id,username returns HTTP 200
   with data: [] and no next page. Using the explicit system-user ID also
   returns an empty list.
6. GET /17841419691674191?fields=id,username returns error code 100,
   error_subcode 33. The account's content_publishing_limit edge also fails
   with 100/33.

Expected: the account selected during consent appears in assigned Instagram
accounts, and its profile is readable with instagram_basic.

Additional checks:

- The Facebook app administrator has full control of the client business.
  The Instagram professional account is listed as an Instagram Tester.
- The failure was reproduced after both Instagram login and Facebook
  administrator login, including renewed consent after removing the old
  integration.
- Native HTTPS requests independent of the website's Graph helper and
  Next.js fetch produce the same empty list and profile denial. Bearer vs
  query-token transport, with/without appsecret_proof, and v25.0 vs v26.0
  comparisons did not restore access.
- Webhook callback verification and a signed Test delivery from Meta succeed;
  profile access still fails independently.
- business_management is absent. Its separate administrative endpoint denial
  is not being treated as evidence that the Instagram scopes above are absent.
- No active publishing connection has been fabricated from consent alone;
  diagnosis has not created posts, media containers, or messages.

Latest consent attempt: approximately 27 October 2026, 23:23 WIB (16:23 UTC).
Latest read-only diagnosis completed before 23:31 WIB (16:31 UTC).

Recent fbtrace_id values:

- Instagram profile: AVpdfuxqJ2ymsP3ER8PVHw-
- Publishing quota: AlmL3nPPEcJO15ds-8BdPdC
- Profile via independent native HTTPS: ATn8ZiIIXd_Fq1w76nO6ZsB

Please clarify:

1. Is testing Unified Login with the app and its own Instagram account in the
   same business portfolio supported? The general BISU documentation requires
   separate app-owner and client portfolios; we need to confirm how this
   applies to the Unified Login development/test flow.
2. Why is the BISU assigned Instagram account list empty when consent and
   Connected apps show the exact account shared? Can you check the asset
   assignment for this app/business combination using the traces above?
3. Is any additional testing requirement or access level needed beyond an app
   administrator with business full control and an accepted Instagram Tester?

We have not established the root cause and are requesting investigation, not
asserting a confirmed Meta platform bug. No credential is included here.

## Referensi untuk pertanyaan

- [Unified Login Get Started](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started)
- [Unified Login eligibility and troubleshooting](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/eligibility-and-troubleshooting)
- [BISU requirements](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business#business-integration-system-user-access-tokens)
- [Diagnosis lokal terperinci](./instagram-unified-api-diagnosis.md)
