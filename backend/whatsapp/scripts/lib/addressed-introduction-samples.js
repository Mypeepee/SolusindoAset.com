export function addressedIntroductionSamples() {
  const samples = [];
  for (const greeting of ['malam', 'selamat pagi', 'selamat siang', 'selamat sore', 'halo', 'assalamualaikum']) {
    for (const recipient of ['pak jason', 'Pak Jason Christopher Liendo', 'Mas Budi', 'Jason']) {
      for (const separator of [', ', ' ', '\n']) {
        for (const introduction of ['saya vera', 'nama saya vera', 'ini saya vera', 'kenalin saya vera']) {
          samples.push({ text: `${greeting} ${recipient}${separator}${introduction}`, name: 'vera', salutation: null, label: 'Vera' });
        }
      }
    }
  }
  samples.push(
    { text: 'malam, pak jason, saya vera', name: 'vera', salutation: null, label: 'Vera' },
    { text: 'Pak Jason, saya Vera', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'halo pak, Jason. saya Vera', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'malam pak Jason, Vera di sini', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'halo Jason, Vera disini', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'permisi Pak Jason, saya Farah', name: 'Farah', salutation: null, label: 'Farah' },
    { text: 'selamat malam Pak Jason, saya Bu Rina', name: 'Rina', salutation: 'Bu', label: 'Bu Rina' },
    { text: 'halo Bu Sari, saya Pak Dwi', name: 'Dwi', salutation: 'Pak', label: 'Pak Dwi' },
    { text: 'malam Pak Jason, saya Jason', name: 'Jason', salutation: null, label: 'Jason' },
    { text: 'halo Pak Jason, panggil saya Kak Alex', name: 'Alex', salutation: 'Kak', label: 'Kak Alex' },
    { text: 'selamat malam, saya Vera Pak Jason', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'saya Vera, Pak Jason', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'malam Pak Jason ini Vera', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'halo Jason, ini Vera', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'malam Pak Jason, saya Vera. Boleh tanya pak?', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'halo Jason saya Vera mau tanya', name: 'Vera', salutation: null, label: 'Vera' },
    { text: 'malam Pak Jason, saya Vera, salam kenal', name: 'Vera', salutation: null, label: 'Vera' },
  );
  return samples;
}
