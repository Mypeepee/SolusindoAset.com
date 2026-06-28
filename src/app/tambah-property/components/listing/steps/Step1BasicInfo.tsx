'use client';

import React, { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Input } from '@/components/ui/input';
import { RadioGroup } from '../RadioGroup';
import { motion, AnimatePresence } from 'framer-motion';
import {
  JENIS_TRANSAKSI_OPTIONS,
  KATEGORI_OPTIONS,
} from '@/app/tambah-property/types/listing';
import { TrendingUp, Eye, Award } from 'lucide-react';
import { cn, generateSlug } from '@/lib/utils';
import { AuctionDatePicker } from '../AuctionDatePicker';

interface Step1Props {
  form: UseFormReturn<ListingFormData>;
}

export function Step1BasicInfo({ form }: Step1Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = form;

  const jenisTransaksi = watch('jenis_transaksi');
  const judul = watch('judul');
  const tanggalLelang = watch('tanggal_lelang');

  const [titleScore, setTitleScore] = useState(0);
  const [titleTips, setTitleTips] = useState<string[]>([]);

  // Slug suffix dibuat SEKALI saat mount → tidak berubah tiap keystroke
  const slugSuffixRef = React.useRef(Math.random().toString(36).substring(2, 7));

  useEffect(() => {
    if (judul) {
      const slug = generateSlug(judul) + '-' + slugSuffixRef.current;
      setValue('slug', slug);
    }
  }, [judul, setValue]);

  const handleDateChange = (date: Date | undefined) => {
    setValue('tanggal_lelang', date ?? (undefined as any), { shouldValidate: true });
  };

  useEffect(() => {
    if (judul) {
      let score = 0;
      const tips: string[] = [];

      if (judul.length >= 40 && judul.length <= 70) {
        score += 25;
      } else if (judul.length < 40) {
        tips.push('Tambahkan detail lokasi atau fitur khusus (min. 40 karakter)');
      } else {
        tips.push('Persingkat judul agar lebih mudah dibaca (max. 70 karakter)');
      }

      const locationKeywords = [
        'jakarta',
        'surabaya',
        'bandung',
        'bali',
        'medan',
        'semarang',
        'yogyakarta',
        'malang',
        'solo',
        'denpasar',
      ];

      if (locationKeywords.some((loc) => judul.toLowerCase().includes(loc))) {
        score += 25;
      } else {
        tips.push('Tambahkan nama kota untuk SEO lokal yang lebih baik');
      }

      const propertyTypes = [
        'rumah',
        'apartemen',
        'ruko',
        'villa',
        'tanah',
        'gudang',
        'pabrik',
        'toko',
        'hotel',
      ];

      if (propertyTypes.some((type) => judul.toLowerCase().includes(type))) {
        score += 25;
      } else {
        tips.push('Sertakan jenis properti (rumah/apartemen/dll)');
      }

      const attractiveWords = [
        'mewah',
        'strategis',
        'modern',
        'premium',
        'eksklusif',
        'view',
        'minimalis',
        'luas',
        'nyaman',
        'siap huni',
      ];

      if (attractiveWords.some((word) => judul.toLowerCase().includes(word))) {
        score += 25;
      } else {
        tips.push('Gunakan kata menarik: mewah, strategis, modern, premium, dll');
      }

      setTitleScore(score);
      setTitleTips(tips);
    } else {
      setTitleScore(0);
      setTitleTips([]);
    }
  }, [judul]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return 'Excellent';
    if (score >= 50) return 'Good';
    if (score >= 25) return 'Fair';
    return 'Needs Work';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="space-y-4">
        <FormField
          label="Judul Listing"
          required
          error={errors.judul?.message}
          description="Judul yang SEO-friendly akan membantu property Anda lebih mudah ditemukan di Google"
          icon={<TrendingUp className="h-3 w-3 text-emerald-400" />}
        >
          <Input
            {...form.register('judul')}
            placeholder="Contoh: Rumah Mewah 3 Kamar Modern Strategis di Surabaya Timur"
            maxLength={100}
          />
        </FormField>

        <AnimatePresence>
          {judul && judul.length >= 10 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                      <Eye className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">SEO Score</h4>
                      <p className="text-xs text-slate-500">
                        Search Engine Optimization
                      </p>
                    </div>
                  </div>

                  <motion.div
                    key={titleScore}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <div
                      className={`rounded-full border border-current bg-gradient-to-r px-3 py-1 ${getScoreColor(titleScore)} bg-opacity-20`}
                    >
                      <span
                        className={`bg-gradient-to-r text-xs font-bold text-transparent bg-clip-text ${getScoreColor(titleScore)}`}
                      >
                        {getScoreLabel(titleScore)}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-slate-200">
                      {titleScore}%
                    </span>
                  </motion.div>
                </div>

                <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${getScoreColor(titleScore)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${titleScore}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>

                {titleTips.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <Eye className="h-3 w-3" />
                      Suggestions to Improve
                    </p>
                    {titleTips.map((tip, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 p-2 text-xs text-slate-400"
                      >
                        <span className="mt-0.5 text-amber-400">💡</span>
                        <span className="flex-1">{tip}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {titleScore === 100 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-3"
                  >
                    <Award className="h-5 w-5 text-green-400" />
                    <p className="text-sm font-semibold text-green-300">
                      Perfect! Judul Anda sudah optimal untuk SEO 🎉
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FormField
        label="Jenis Transaksi"
        required
        error={errors.jenis_transaksi?.message}
        description="Pilih tipe transaksi sesuai dengan property Anda"
      >
        <RadioGroup
          options={JENIS_TRANSAKSI_OPTIONS}
          value={watch('jenis_transaksi') || ''}
          onChange={(value) => setValue('jenis_transaksi', value as any)}
          name="jenis_transaksi"
        />
      </FormField>

      <FormField
        label="Kategori Property"
        required
        error={errors.kategori?.message}
        description="Tentukan jenis property yang akan Anda jual atau sewakan"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {KATEGORI_OPTIONS.map((option) => {
            const isSelected = watch('kategori') === option.value;

            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => setValue('kategori', option.value)}
                className={cn(
                  'group relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300',
                  isSelected
                    ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/30 hover:border-emerald-500/30 hover:bg-slate-900/50'
                )}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {isSelected && (
                  <motion.div
                    className="absolute -inset-1 -z-10 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}

                <motion.div
                  className="mb-2 text-4xl"
                  animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {option.icon}
                </motion.div>

                <div
                  className={cn(
                    'text-xs font-semibold transition-colors',
                    isSelected
                      ? 'text-slate-100'
                      : 'text-slate-400 group-hover:text-slate-300'
                  )}
                >
                  {option.label}
                </div>

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500"
                  >
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                )}

                <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
              </motion.button>
            );
          })}
        </div>
      </FormField>

      <AnimatePresence>
        {jenisTransaksi === 'LELANG' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-6 backdrop-blur-sm">
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />

              <div className="relative z-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                    <span className="text-xl">⚖️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-amber-400">
                      Informasi Lelang
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tentukan jadwal lelang property Anda
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-slate-200">
                      Tanggal &amp; Waktu Lelang
                      <span className="ml-1 text-red-400">*</span>
                    </span>
                  </div>
                  <AuctionDatePicker
                    value={tanggalLelang instanceof Date ? tanggalLelang : tanggalLelang ? new Date(tanggalLelang) : undefined}
                    onChange={handleDateChange}
                    error={errors.tanggal_lelang?.message}
                  />
                  {!errors.tanggal_lelang && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Bisa pilih tanggal lampau maupun masa depan
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}