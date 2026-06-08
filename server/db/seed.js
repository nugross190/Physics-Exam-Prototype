require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const SIMS = [
  { sim_key: 'newton',   title: 'Hukum Newton tentang Gerak', order_index: 1, embed_path: '/sims/newton/index.html' },
  { sim_key: 'energy',   title: 'Energy Skate Park',          order_index: 2, embed_path: '/sims/energy/energy-skate-park_en.html' },
  { sim_key: 'buoyancy', title: 'Laboratorium Gaya Apung',     order_index: 3, embed_path: '/sims/buoyancy/buoyancy_en.html' },
  { sim_key: 'pressure', title: 'Tekanan dalam Fluida',        order_index: 4, embed_path: '/sims/pressure/under-pressure_en.html' },
  { sim_key: 'fluid',    title: 'Aliran Fluida',               order_index: 5, embed_path: '/sims/fluid/index.html' },
  { sim_key: 'rotation', title: 'Gerak Rotasi',                order_index: 6, embed_path: '/sims/rotation/index.html' }
];

// Question payload helpers
const tut  = (title, body) => ({ type: 'tutorial_step', stage: 'tutorial',    payload: { title, body } });
const varT = (prompt, hint) => ({ type: 'var_test',     stage: 'var_test',    payload: { prompt, hint } });
const smc  = (question, options, answer) => ({ type: 'simple_mc',  stage: 'inquiry',    payload: { question, options, answer } });
const cmc  = (question, options, answers) => ({ type: 'complex_mc', stage: 'inquiry',    payload: { question, options, answers } });
const tf   = (statement, answer) => ({ type: 'true_false', stage: 'true_false', payload: { statement, answer } });
const wb   = (template, bank, blanks) => ({ type: 'word_bank', stage: 'conclusion', payload: { template, bank, blanks } });

// Seed data per sim. Bahasa Indonesia.
const QUESTIONS = {
  newton: [
    tut('Selamat datang', 'Pada simulasi ini kamu akan mempelajari Hukum Newton I, II, dan III. Geser slider gaya untuk melihat efeknya.'),
    tut('Variabel utama', 'Massa (m), Gaya (F), dan Percepatan (a). Perhatikan hubungan F = m × a.'),
    varT('Atur massa = 10 kg, gaya atas = 50 N. Berapa percepatan yang kamu amati?', 'Gunakan rumus a = F/m.'),
    varT('Set semua gaya menjadi 0. Apa yang terjadi pada benda yang awalnya bergerak?', 'Pikirkan Hukum Newton I.'),
    smc('Menurut Hukum Newton I, benda yang diam akan tetap diam kecuali...',
        ['Ada gaya resultan yang bekerja padanya', 'Massanya berubah', 'Gravitasi hilang', 'Benda tersebut sangat ringan'], 0),
    smc('Rumus Hukum Newton II adalah...', ['F = m + a', 'F = m × a', 'F = m / a', 'F = m - a'], 1),
    cmc('Faktor apa saja yang mempengaruhi percepatan benda? (Pilih semua yang benar)',
        ['Besar gaya yang bekerja', 'Warna benda', 'Massa benda', 'Bentuk benda di ruang hampa'], [0, 2]),
    tf('Gaya aksi dan reaksi bekerja pada benda yang sama.', false),
    tf('Massa benda berbanding terbalik dengan percepatannya jika gaya tetap.', true),
    tf('Benda yang bergerak dengan kecepatan konstan memiliki percepatan nol.', true),
    wb('Hukum Newton II menyatakan bahwa percepatan benda __1__ dengan gaya resultan dan __2__ dengan massa benda.',
       ['berbanding lurus', 'berbanding terbalik', 'tidak berhubungan', 'sama'], ['berbanding lurus', 'berbanding terbalik'])
  ],
  energy: [
    tut('Energi Mekanik', 'Energi kinetik (EK) dan energi potensial (EP) saling berkonversi. Total energi mekanik kekal jika tidak ada gesekan.'),
    tut('Eksperimen', 'Geser skater di lintasan, nyalakan/matikan gesekan, dan amati grafik energi.'),
    varT('Tanpa gesekan, di titik tertinggi berapa nilai EK?', 'EK minimum saat kecepatan minimum.'),
    varT('Aktifkan gesekan. Apa yang terjadi pada total energi mekanik seiring waktu?', 'Perhatikan energi panas.'),
    smc('Saat skater turun, energi potensial berubah menjadi...', ['Energi kinetik', 'Energi panas', 'Energi cahaya', 'Energi nuklir'], 0),
    cmc('Manakah faktor yang mempengaruhi energi potensial gravitasi? (Pilih semua)',
        ['Massa benda', 'Warna benda', 'Ketinggian', 'Percepatan gravitasi'], [0, 2, 3]),
    tf('Energi mekanik selalu kekal pada sistem yang memiliki gesekan.', false),
    tf('EP maksimum terjadi di titik tertinggi lintasan.', true),
    wb('Pada sistem tanpa gesekan, energi __1__ dan energi __2__ saling berkonversi tetapi jumlahnya __3__.',
       ['kinetik', 'potensial', 'tetap', 'berubah', 'panas'], ['kinetik', 'potensial', 'tetap'])
  ],
  buoyancy: [
    tut('Gaya Apung', 'Benda dalam fluida mengalami gaya apung ke atas sebesar berat fluida yang dipindahkan (Prinsip Archimedes).'),
    tut('Variabel', 'Massa jenis benda (ρ), massa jenis fluida, dan volume benda yang tercelup.'),
    varT('Celupkan balok ke air. Apa yang terjadi pada angka di neraca?', 'Berat efektif berkurang sebesar gaya apung.'),
    varT('Ganti fluida menjadi yang lebih rapat. Apakah benda lebih mudah mengapung?', 'Bandingkan ρ_benda dan ρ_fluida.'),
    smc('Benda akan mengapung jika...', ['ρ_benda > ρ_fluida', 'ρ_benda < ρ_fluida', 'ρ_benda = 0', 'Massa benda > 1 kg'], 1),
    cmc('Gaya apung bergantung pada... (Pilih semua)',
        ['Massa jenis fluida', 'Volume benda tercelup', 'Percepatan gravitasi', 'Warna benda'], [0, 1, 2]),
    tf('Gaya apung sama dengan berat fluida yang dipindahkan.', true),
    tf('Benda tenggelam karena tidak ada gaya apung.', false),
    wb('Menurut Prinsip Archimedes, gaya apung sama dengan __1__ fluida yang __2__ oleh benda.',
       ['berat', 'massa', 'dipindahkan', 'menarik', 'volume'], ['berat', 'dipindahkan'])
  ],
  pressure: [
    tut('Tekanan Hidrostatis', 'P = ρ × g × h. Semakin dalam, semakin besar tekanan.'),
    tut('Eksperimen', 'Pindahkan alat ukur ke berbagai kedalaman.'),
    varT('Pindahkan sensor ke dasar kolam. Bandingkan dengan permukaan.', 'Tekanan bertambah linier terhadap kedalaman.'),
    varT('Ganti fluida menjadi air raksa. Apa yang terjadi pada tekanan di kedalaman sama?', 'ρ berbeda.'),
    smc('Tekanan hidrostatis bergantung pada...', ['Volume fluida', 'Bentuk bejana', 'Kedalaman dan massa jenis', 'Luas permukaan'], 2),
    cmc('Pernyataan benar tentang tekanan fluida statis: (Pilih semua)',
        ['Tekanan sama di kedalaman yang sama', 'Bertambah dengan kedalaman', 'Bergantung pada bentuk wadah', 'Bergantung pada massa jenis'], [0, 1, 3]),
    tf('Tekanan di dasar bejana bergantung pada bentuk bejana.', false),
    tf('Pada kedalaman yang sama, tekanan dalam fluida sama besar.', true),
    wb('Tekanan hidrostatis dirumuskan P = ρ × __1__ × __2__, sehingga makin dalam, tekanan makin __3__.',
       ['g', 'h', 'besar', 'kecil', 'massa'], ['g', 'h', 'besar'])
  ],
  fluid: [
    tut('Persamaan Kontinuitas', 'A₁v₁ = A₂v₂. Luas penampang kecil → kecepatan besar.'),
    tut('Bernoulli', 'Tekanan rendah di tempat kecepatan tinggi.'),
    varT('Persempit pipa di tengah. Apa yang terjadi pada kecepatan aliran?', 'Gunakan kontinuitas.'),
    varT('Amati tekanan pada bagian sempit vs lebar.', 'Bernoulli.'),
    smc('Jika luas penampang pipa mengecil, kecepatan aliran...', ['Mengecil', 'Membesar', 'Tetap', 'Nol'], 1),
    cmc('Persamaan Bernoulli memperhitungkan: (Pilih semua)',
        ['Tekanan', 'Kecepatan aliran', 'Ketinggian', 'Warna fluida'], [0, 1, 2]),
    tf('Pada pipa menyempit, tekanan fluida meningkat.', false),
    tf('Hukum kontinuitas berlaku untuk fluida tak termampatkan.', true),
    wb('Pada pipa yang menyempit, kecepatan fluida __1__ dan tekanannya __2__.',
       ['meningkat', 'menurun', 'tetap'], ['meningkat', 'menurun'])
  ],
  rotation: [
    tut('Gerak Rotasi', 'Momen gaya τ = r × F menyebabkan percepatan sudut α. τ = I × α.'),
    tut('Momen Inersia', 'I bergantung pada distribusi massa terhadap sumbu rotasi.'),
    varT('Ubah jari-jari gaya. Bagaimana pengaruhnya pada momen gaya?', 'τ = r × F.'),
    varT('Tambah massa di tepi. Apa yang terjadi pada momen inersia?', 'I bertambah.'),
    smc('Momen gaya (torsi) dirumuskan...', ['τ = m × a', 'τ = r × F', 'τ = F / r', 'τ = m × v'], 1),
    cmc('Yang mempengaruhi momen inersia: (Pilih semua)',
        ['Massa benda', 'Jari-jari', 'Distribusi massa', 'Warna benda'], [0, 1, 2]),
    tf('Momen inersia tidak bergantung pada sumbu rotasi.', false),
    tf('Torsi nol berarti percepatan sudut nol.', true),
    wb('Hukum II Newton untuk rotasi: τ = __1__ × __2__, dengan I adalah __3__.',
       ['I', 'α', 'momen inersia', 'gaya', 'massa'], ['I', 'α', 'momen inersia'])
  ]
};

async function run() {
  await pool.query('BEGIN');
  try {
    for (const s of SIMS) {
      await pool.query(
        `INSERT INTO sims (sim_key, title, order_index, embed_path)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (sim_key) DO UPDATE SET title=EXCLUDED.title, order_index=EXCLUDED.order_index, embed_path=EXCLUDED.embed_path`,
        [s.sim_key, s.title, s.order_index, s.embed_path]
      );
    }

    for (const [simKey, qs] of Object.entries(QUESTIONS)) {
      const { rowCount } = await pool.query(`SELECT 1 FROM questions WHERE sim_key=$1 LIMIT 1`, [simKey]);
      if (rowCount > 0) {
        console.log(`[seed] questions for ${simKey} already exist, skipping`);
        continue;
      }
      let i = 0;
      for (const q of qs) {
        await pool.query(
          `INSERT INTO questions (sim_key, stage, type, order_index, payload)
           VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [simKey, q.stage, q.type, i++, JSON.stringify(q.payload)]
        );
      }
      console.log(`[seed] inserted ${qs.length} questions for ${simKey}`);
    }

    // Default admin
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = bcrypt.hashSync(adminPass, 10);
    await pool.query(
      `INSERT INTO admins (username, password_hash)
       VALUES ($1,$2)
       ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
      [adminUser, hash]
    );
    console.log(`[seed] admin user ready: ${adminUser}`);

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
  await pool.end();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
