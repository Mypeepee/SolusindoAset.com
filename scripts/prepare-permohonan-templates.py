"""Parameterise the supplied Word documents, retaining their wording and layout.

The originals remain available for manual editing. Run this after intentionally
updating an original; an unexpected source change fails instead of emitting a
partially parameterised legal document.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
from xml.sax.saxutils import escape, unescape

ROOT = Path(__file__).resolve().parents[1] / 'src/app/dashboard/surat/components/templates'


def replace_text(xml, replacements):
    # Word can split any name/number across runs. Replace over the visible text,
    # then put the placeholder in its first run while retaining run formatting.
    spans = list(re.finditer(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', xml, re.S))
    strings = [unescape(span.group(1)) for span in spans]
    for old, new in replacements:
        text = ''.join(strings)
        positions = [m.start() for m in re.finditer(re.escape(old), text)]
        if not positions:
            raise ValueError(f'Source text missing: {old!r}')
        for start in reversed(positions):
            end = start + len(old)
            offset = 0
            for i, value in enumerate(strings):
                a, b = offset, offset + len(value)
                offset = b
                if a < end and b > start:
                    left, right = max(0, start-a), min(len(value), end-a)
                    strings[i] = value[:left] + (new if a <= start < b else '') + value[right:]
    for span, value in reversed(list(zip(spans, strings))):
        xml = xml[:span.start(1)] + escape(value) + xml[span.end(1):]
    return xml


def write_template(source, target, replacements, transform=None):
    with ZipFile(ROOT / source) as original:
        xml = replace_text(original.read('word/document.xml').decode(), replacements)
        if transform:
            xml = transform(xml)
        entries = [(info, xml.encode() if info.filename == 'word/document.xml' else original.read(info.filename))
                   for info in original.infolist()]
    with ZipFile(ROOT / target, 'w', ZIP_DEFLATED) as result:
        for info, data in entries:
            result.writestr(info, data)


def grosse_conditional(xml):
    paragraphs = list(re.finditer(r'<w:p[ >].*?</w:p>', xml, re.S))
    first = next(p for p in paragraphs if 'w:type="page"' in p.group())
    # Keep the page break inside the optional block. Never cut PDF page indices:
    # long addresses may legitimately flow onto additional pages.
    xml = xml[:first.start()] + '<w:p><w:r><w:t>{{#dengan_kuasa}}</w:t></w:r></w:p>' + xml[first.start():]
    end = xml.rfind('<w:sectPr')
    if end == -1:
        raise ValueError('Document section properties missing')
    return xml[:end] + '<w:p><w:r><w:t>{{/dengan_kuasa}}</w:t></w:r></w:p>' + xml[end:]


def pn_layout(xml):
    old = 'Nama: {{nama_debitur}}Alamat :{{alamat_debitur}}'
    if old not in xml:
        raise ValueError('PN debtor identity layout changed')
    return xml.replace(old, 'Nama: {{nama_debitur}}</w:t><w:br/><w:t>Alamat: {{alamat_debitur}}')


write_template('TemplatePermohonan_Akta_Grosse_Final.docx', 'Permohonan_Akta_Grosse_Dinamis.docx', [
    ('KPKNL Surabaya', '{{kpknl}}'),
    ('JASON CHRISTOPHER LIENDO', '{{nama_pemohon}}'),
    ('3514120108030002', '{{NIK_pemohon}}'),
    ('PASURUAN, 01-08-2003', '{{tempatlahir_pemohon}}, {{tanggallahir_pemohon}}'),
    ('Simo Katrungan Kidul 7/6', '{{alamat_pemohon}}'),
    ('770/10.01/2026-01', '{{nomor_risalahlelang}}'),
    ('Zainul Arifin,S.H.', '{{pejabat_lelang}}'),
    ('16 September 2026', '{{tanggal_risalahlelang}}'),
    ('09:45 WIB', '{{jamlelang}}'),
    ('19760510 199503 1 001', '{{NIP}}'),
    ('Tanah dan Bangunan', '{{objek}}'),
    ('Pengadilan Negeri Surabaya', '{{pengadilan}}'),
    ('Surabaya, 27 September 2026', '{{kota}}, {{tanggal}}'),
    ('Surabaya, {{tanggal}}', '{{kota}}, {{tanggal}}'),
], grosse_conditional)

write_template('Template_permohonanPN_DenganKuasa.docx', 'Permohonan_PN_Dinamis.docx', [
    ('Surabaya, 16 September 2026', '{{kota}}, {{tanggal}}'),
    ('Pengadilan Negeri Kepanjen', '{{pengadilan}}'),
    ('Jl. Raya Panji No. 205 Kepanjen, Kabupaten Malang - Jawa Timur.', '{{alamat_PN}}'),
    ('JASON CHRISTOPHER LIENDO', '{{nama_pemohon}}'),
    ('3514120108030002', '{{NIK_pemohon}}'),
    ('Pasuruan, 01 Agustus 2003', '{{tempatlahir_pemohon}}, {{tanggallahir_pemohon}}'),
    ('Laki - Laki', '{{kelamin_pemohon}}'),
    ('Protestan', '{{agama_pemohon}}'),
    ('Warga Negara: Indonesia', 'Warga Negara: {{warga_negara}}'),
    ('Simo Katrungan Kidul 7/6, Kel. Banyu Urip, Kec. Sawahan, Kota Surabaya', '{{alamat_pemohon}}'),
    ('Wiraswasta', '{{pekerjaan_pemohon}}'),
    ('Belum Menikah', '{{statuskawin_pemohon}}'),
    ('Sertifikat Hak Milik', '{{jenis_sertifikat}}'),
    ('SHM', '{{singkatan_sertifikat}}'),
    ('12.30.000117723.0', '{{nomor_nib}}'),
    ('149', '{{LT}}'),
    ('MOHAMAD MUJIB', '{{nama_debitur}}'),
    ('Nama: {{nama_debitur}}Alamat :Raya Sumberpasir No. 150', 'Nama: {{nama_debitur}}Alamat :{{alamat_debitur}}'),
    ('Raya Sumberpasir No. 150', '{{lokasi_asset}}'),
    ('Sumberpasir', '{{kelurahan_asset}}'),
    ('Pakis', '{{kecamatan_asset}}'),
    ('Kab. Malang', '{{kota_asset}}'),
    ('PT. Bank Rakyat Indonesia, Tbk. Kantor Cabang Malang Soekarno Hatta', '{{nama_bank}}'),
    ('KU-509/RL.376/10.03/2026-01', '{{nomor_kwitansi}}'),
    ('376/10.03/2026-01', '{{nomor_risalah}}'),
    ('{{nomor_kwitansi}} Tanggal 20 Juli 2026', '{{nomor_kwitansi}} Tanggal {{tanggal_kwitansi}}'),
    ('20 Juli 2026', '{{tanggal_risalah}}'),
    ('KPKNL-Malang', '{{kantor_lelang}}'),
], pn_layout)
