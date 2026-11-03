import type {
  InstagramDetail,
  InstagramMedia,
} from "@/lib/marketing/instagram-content";

/** Local previews only. Never inserted into account, jobs, or publication data. */
export type InstagramExample = {
  id: string;
  title: string;
  category: string;
  location: string;
  slideLabels: string[];
  views: number;
  detail: InstagramDetail;
};

function example(input: {
  id: string;
  title: string;
  category: string;
  location: string;
  photos: string[];
  slideLabels: string[];
  caption: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
}): InstagramExample {
  const cover = `/images/instagram-examples/${input.id}.jpg`;
  const media: InstagramMedia = {
    id: input.id,
    caption: input.caption,
    type: "CAROUSEL_ALBUM",
    product: "FEED",
    mediaUrl: cover,
    thumbnailUrl: cover,
    permalink: null,
    timestamp: "2026-10-27T09:00:00+07:00",
    likes: input.likes,
    comments: input.comments,
    commentsEnabled: true,
  };
  const metrics = {
    views: input.views,
    reach: input.reach,
    likes: input.likes,
    comments: input.comments,
    saved: input.saved,
    shares: input.shares,
    total_interactions:
      input.likes + input.comments + input.saved + input.shares,
  };
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    location: input.location,
    slideLabels: ["Sampul desain", ...input.slideLabels],
    views: input.views,
    detail: {
      media,
      children: [cover, ...input.photos].map((url, index) => ({
        ...media,
        id: `${input.id}-${index}`,
        mediaUrl: url,
        thumbnailUrl: url,
        type: "IMAGE",
        product: "FEED",
      })),
      insights: Object.entries(metrics).map(([name, value]) => ({
        name,
        value,
        issue: null,
      })),
      capabilities: {
        insights: true,
        comments: false,
        deleteMedia: false,
        verified: true,
        missing: [],
      },
      fetchedAt: "2026-10-28T03:00:00.000Z",
    },
  };
}

export const instagramExamples: InstagramExample[] = [
  example({
    id: "example-business",
    title: "Gudang Pasinan",
    category: "Gudang",
    location: "Mojokerto, Jawa Timur",
    photos: [
      "/images/hero/pasinan1.jpg",
      "/images/hero/pasinan2.jpg",
      "/images/hero/pasinan3.jpg",
    ],
    slideLabels: ["Tampak bangunan", "Area halaman", "Akses sekitar"],
    caption:
      "✨ Usaha Anda punya langkah berikutnya. Mulai dari ruangnya.\n\nGudang Pasinan • Mojokerto, Jawa Timur\n📍 Tambakagung, Mojokerto\n▸ Luas tanah 17.630 m²\n▸ Harga ilustrasi Rp15.500.000.000\n\nBayangkan ruang untuk menata rencana usaha Anda berikutnya. Cermati bangunan, halaman, dan aksesnya melalui foto-foto ini.\n\nGeser untuk melihat detailnya. Simpan dan bagikan kepada rekan yang ingin Anda ajak berdiskusi.\n\n📩 Ceritakan kebutuhan properti Anda kepada tim Solusindo.\n\nCONTOH CAPTION & DESAIN · BUKAN PENAWARAN AKTIF. Tautan detail dan kontak ditambahkan otomatis pada materi listing asli.",
    views: 4820,
    reach: 3160,
    likes: 186,
    comments: 12,
    saved: 38,
    shares: 21,
  }),
  example({
    id: "example-home",
    title: "Rumah Unimas",
    category: "Rumah",
    location: "Hunian & lingkungan sekitar",
    photos: ["/images/hero/unimas2.jpg", "/images/hero/unimas3.jpg"],
    slideLabels: ["Tampak depan", "Sudut & lingkungan"],
    caption:
      "🏡 Bayangkan punya tempat untuk memulai cerita baru.\n\nRumah Unimas\n\nBayangkan pagi pertama di rumah pilihan Anda dan cerita yang ingin Anda bangun bersama orang tersayang. Mulai mengenal propertinya dari tampak depan hingga lingkungan sekitar.\n\nGeser untuk melihat foto detailnya. Simpan atau bagikan kepada orang yang ingin Anda ajak merencanakannya.\n\n📩 Diskusikan kebutuhan hunian Anda bersama tim Solusindo.\n\nCONTOH CAPTION & DESAIN · BUKAN PENAWARAN AKTIF. Spesifikasi, harga, tautan detail, dan kontak mengikuti data pada materi listing asli.",
    views: 2150,
    reach: 1480,
    likes: 92,
    comments: 6,
    saved: 24,
    shares: 11,
  }),
  example({
    id: "example-warehouse",
    title: "Gudang Kedinding",
    category: "Gudang",
    location: "Kenjeran, Surabaya",
    photos: ["/images/hero/kedinding1.jpg", "/images/hero/kedinding2.jpg"],
    slideLabels: ["Lingkungan properti", "Detail bangunan"],
    caption:
      "✨ Rencana usaha Anda layak punya ruang untuk tumbuh.\n\nGudang Kedinding • Surabaya\n📍 Kenjeran, Surabaya\n▸ Luas tanah 200 m²\n▸ Harga ilustrasi Rp1.235.100.000\n\nSudah membayangkan langkah berikutnya untuk usaha Anda? Kenali dahulu lingkungan dan bangunannya melalui foto-foto ini.\n\nGeser untuk melihat lebih dekat. Simpan sebagai bahan diskusi bersama rekan usaha Anda.\n\n📩 Ceritakan kebutuhan ruang usaha Anda kepada tim Solusindo.\n\nCONTOH CAPTION & DESAIN · BUKAN PENAWARAN AKTIF. Tautan detail dan kontak ditambahkan otomatis pada materi listing asli.",
    views: 1640,
    reach: 1120,
    likes: 74,
    comments: 4,
    saved: 16,
    shares: 9,
  }),
];

export function findInstagramExample(id: string) {
  return instagramExamples.find((item) => item.id === id);
}
