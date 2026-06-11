require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./pool');

// Bump this when the question bank below changes. On next boot the seeder
// wipes and re-inserts the questions for every sim listed in QUESTIONS
// (responses tied to the old questions are cascade-deleted). While the
// version is unchanged, questions are left alone so admin-panel edits survive.
const QUESTIONS_VERSION = 3;

const SIMS = [
  { sim_key: 'newton',   title: 'Hukum Newton tentang Gerak', order_index: 1, embed_path: '/sims/newton/index.html' },
  { sim_key: 'energy',   title: 'Energy Skate Park',          order_index: 2, embed_path: '/sims/energy/energy-skate-park_en.html' },
  { sim_key: 'buoyancy', title: 'Laboratorium Gaya Apung',    order_index: 3, embed_path: '/sims/buoyancy/buoyancy_en.html' },
  { sim_key: 'pressure', title: 'Tekanan dalam Fluida',       order_index: 4, embed_path: '/sims/pressure/under-pressure_en.html' },
  { sim_key: 'fluid',    title: 'Aliran Fluida',              order_index: 5, embed_path: '/sims/fluid/index.html' },
  { sim_key: 'rotation', title: 'Gerak Rotasi',               order_index: 6, embed_path: '/sims/rotation/index.html' }
];

// Tutorial steps support optional extras (see docs/TUTORIAL_DESIGN.md):
//   action_prompt  – "try it" task; the Lanjut button unlocks after the
//                    student confirms they tried it
//   highlight      – { selector } pointing at a [data-tut-id=...] element
//                    inside self-built sims (live spotlight)
//   image / image_caption – annotated screenshot for PhET sims (optional)
//   equations      – [{ label, formula, legend }] formula reference card;
//                    used on the last tutorial step of each sim to present
//                    the equations some quiz items base their calculation on
const tut  = (title, body, extra = {}) => ({ type: 'tutorial_step', stage: 'tutorial', payload: { title, body, ...extra } });
const smc  = (question, options, answer, extra = {}) => ({ type: 'simple_mc',  stage: 'inquiry', payload: { question, options, answer, ...extra } });
const cmc  = (question, options, answers) => ({ type: 'complex_mc', stage: 'inquiry', payload: { question, options, answers } });
const tmc  = (question, row_header, columns, rows) => ({ type: 'table_mc', stage: 'inquiry', payload: { question, row_header, columns, rows } });
const tf   = (statement, answer) => ({ type: 'true_false', stage: 'true_false', payload: { statement, answer } });
const wb   = (template, bank, blanks) => ({ type: 'word_bank', stage: 'conclusion', payload: { template, bank, blanks } });

// "Trap" question: same topic as the surrounding items but far above the
// exam's difficulty level, placed around 3/4 of the question list. Used to
// observe whether students skip questions they cannot solve (the dashboard
// explicitly advises skipping). Flagged so analysis can filter them; the
// flag is stripped before payloads reach students.
const trap = (q) => { q.payload.trap = true; return q; };

const QUESTIONS = {
  newton: [
    tut('Selamat datang',
        'Pada simulasi ini kamu akan menyelidiki hubungan antara gaya, massa, dan gerak benda (Hukum Newton). Ikuti langkah-langkah singkat berikut untuk mengenal simulasinya.'),
    tut('Atur massa benda',
        'Slider "Massa" mengubah massa benda (1–100 kg). Massa menentukan seberapa mudah benda dipercepat.',
        { highlight: { selector: '[data-tut-id="mass-slider"]' }, action_prompt: 'Coba geser slider Massa ke nilai berapa pun.' }),
    tut('Berikan gaya',
        'Ada empat slider gaya: Atas, Bawah, Kiri, dan Kanan (0–100 N). Semua gaya dijumlahkan menjadi resultan yang menggerakkan benda.',
        { highlight: { selector: '[data-tut-id="force-panel"]' }, action_prompt: 'Coba berikan gaya ke arah Kanan sekitar 20 N.' }),
    tut('Jalankan simulasi',
        'Tombol play/pause menjalankan dan menghentikan simulasi, dan timeline bisa digeser untuk melihat ulang gerakan.',
        { highlight: { selector: '[data-tut-id="playback"]' }, action_prompt: 'Tekan tombol play, lalu amati gerak benda.' }),
    tut('Baca data pengukuran',
        'Panel data menampilkan Waktu, Posisi, Kecepatan, dan Percepatan benda secara langsung. Gunakan panel ini sebagai alat ukurmu saat menjawab soal.',
        { highlight: { selector: '[data-tut-id="hud"]' } }),
    tut('Ulangi eksperimen',
        'Tombol Reset mengembalikan benda dan seluruh pengaturan ke kondisi awal. Gunakan setiap kali kamu memulai percobaan baru.',
        { highlight: { selector: '[data-tut-id="reset-btn"]' } }),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Hukum II Newton', formula: 'ΣF = m × a',
              legend: 'ΣF = resultan gaya (N), m = massa (kg), a = percepatan (m/s²)' },
            { label: 'Kecepatan pada percepatan tetap', formula: 'v = v₀ + a × t',
              legend: 'v = kecepatan akhir (m/s), v₀ = kecepatan awal (m/s), t = selang waktu (s)' }
          ] }),
    tmc('Tentukan variabel yang kalian temukan dalam eksperimen',
        'Besaran', ['Variabel Bebas', 'Variabel Terikat'],
        [
          { label: 'Massa',      answer: 0 },
          { label: 'Gaya',       answer: 0 },
          { label: 'Percepatan', answer: 1 }
        ]),
    tmc('Perhatikan instruksi berikut:\n\n1) Atur massa agar mencapai sekitar 50 kg dan berikan gaya sekitar 20N ke KANAN (tidak perlu terlalu pas nilainya).\n\n2) Tekan mulai agar objek bergerak\n\n3) KETIKA SEDANG BERGERAK berikan gaya tambahan ke KANAN dan amati apa yang terjadi\n\n4) Ulangi langkah awal sampai dengan objek mulai bergerak ke kanan tetapi sekarang berikan gaya ke KIRI dan amati apa yang terjadi\n\n5) Ulangi langkah awal sampai dengan objek mulai bergerak ke kanan tetapi sekarang berikan gaya ke ATAS dan amati apa yang terjadi\n\n6) Ulangi langkah awal sampai dengan objek mulai bergerak ke kanan tetapi sekarang berikan gaya ke BAWAH dan amati apa yang terjadi',
        'Arah gaya tambahan', ['Menambah Kecepatan', 'Mengurangi Kecepatan', 'Mengubah arah gerak'],
        [
          { label: 'KANAN', answer: 0 },
          { label: 'KIRI',  answer: 1 },
          { label: 'ATAS',  answer: 2 },
          { label: 'BAWAH', answer: 2 }
        ]),
    cmc('Bagaimana caranya agar suatu objek bisa berhenti?',
        ['diberi gaya berlawanan', 'kecepatan harus nol', 'diberi gaya berlawanan terus menerus', 'diberi gaya searah'],
        [0, 1]),
    trap(smc('Sebuah benda bermassa 50 kg sedang bergerak ke kanan dengan kelajuan 4 m/s. Benda kemudian diberi gaya tetap 20 N yang arahnya membentuk sudut 60° terhadap arah gerak, selama 5 sekon. Besar kelajuan benda pada akhir selang waktu itu adalah... (cos 60° = ½; sin 60° = ½√3)',
        ['2√7 m/s (≈ 5,3 m/s)', '5 m/s', '6 m/s', '4√2 m/s (≈ 5,7 m/s)'], 0)),
    wb('Apabila objek diberi gaya ke kanan 50 N dan dibiarkan bergerak lalu ditengah gerakan diberikan gaya ke kiri 50 N maka akan dipercepat dengan __1__ sebesar __2__ dan bergerak dengan __3__ yang nilainya __4__',
       ['Kecepatan', 'Nol', 'Percepatan', 'Massa', 'Tetap'],
       ['Percepatan', 'Nol', 'Kecepatan', 'Tetap'])
  ],
  energy: [
    tut('Buka menu Measure',
        'Di bagian bawah layar simulasi terdapat beberapa menu (Intro, Measure, Graphs, Playground). Menu "Measure" menyediakan alat ukur energi yang akan kita pakai.',
        { action_prompt: 'Klik menu "Measure" di bagian bawah layar.' }),
    tut('Letakkan skater di lintasan',
        'Seret (drag) karakter skater dan letakkan di atas lintasan. Skater akan meluncur bolak-balik mengikuti bentuk lintasan.',
        { action_prompt: 'Letakkan skater di lintasan sekarang.' }),
    tut('Gunakan alat ukur energi',
        'Pada layar Measure ada sensor pengukur. Seret sensor itu ke titik-titik bertanda pada lintasan untuk membaca besar energi skater tepat di titik tersebut.',
        { action_prompt: 'Seret sensor pengukur ke salah satu titik bertanda di lintasan.' }),
    tut('Baca grafik energi',
        'Diagram energi menampilkan Energi Kinetik, Energi Potensial, Energi Termal, dan Energi Total. Amati bagaimana nilai-nilai itu berubah selama skater meluncur.',
        { action_prompt: 'Amati diagram energi sambil skater bergerak.' }),
    tut('Atur variabel: Friction dan Gravity',
        'Di panel pengaturan terdapat slider "Friction" (gesekan) dan pilihan "Gravity" (gravitasi). Kedua variabel ini mengubah perilaku energi pada sistem — kamu akan membutuhkannya di soal.',
        { action_prompt: 'Coba geser slider Friction, lalu amati diagram energinya.' }),
    tut('Mengulang percobaan',
        'Tombol restart skater mengembalikan skater ke posisi awal, sedangkan tombol reset di pojok kanan bawah mengembalikan seluruh pengaturan ke kondisi awal.'),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan energi berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Energi potensial', formula: 'EP = m × g × h',
              legend: 'm = massa (kg), g = percepatan gravitasi (m/s²), h = ketinggian (m)' },
            { label: 'Energi kinetik', formula: 'EK = ½ × m × v²',
              legend: 'v = kelajuan (m/s)' },
            { label: 'Energi mekanik', formula: 'EM = EK + EP',
              legend: 'tanpa gesekan EM tetap; dengan gesekan sebagian energi berpindah ke bentuk lain' }
          ] }),
    cmc('Dalam kondisi tanpa gesekkan (friction di geser ke kiri sepenuhnya). centang semua jawaban yang benar!',
        ['energi potensial tetap', 'energi kinetik tetap', 'kecepatan maksimum tetap', 'energi mekanik tetap', 'energi total tetap'],
        [2, 3, 4]),
    cmc('Dalam kondisi kondisi gesekkan (friction tidak berada tepat di kiri). centang semua jawaban yang benar!',
        ['sebagian energi berubah menjadi energi termal', 'energi mekanik tetap', 'energi total tetap', 'energi kinetik maksimal tidak berubah', 'Energi potensial maksimal berangsur turun'],
        [0, 2, 4]),
    wb('Apa bila lintasan loop (melingkar ditengah) punya puncak lebih tinggi dari pada ujung lintasan maka loop __1__ karena __2__ di ujung lintasan __3__ dari pada kebutuhan energi di puncak lintasan.',
       ['bisa dilewati', 'tidak bisa dilewati', 'energi mekanik', 'energi termal', 'lebih kecil', 'lebih besar'],
       ['tidak bisa dilewati', 'energi mekanik', 'lebih kecil']),
    trap(smc('Seorang skater meluncur tanpa gesekan dari ketinggian h dan harus melewati loop melingkar berjari-jari 2 m. Agar skater tepat tidak kehilangan kontak dengan lintasan di puncak loop, ketinggian awal h minimum adalah... (g = 10 m/s²)',
        ['5 m', '4 m', '2 m', '6 m'], 0)),
    smc('Model matematika untuk kekekalan energi pada kondisi dengan gesekkan adalah.... . (EK = Energi Kinetik; EP = Energi Potensial; T = Energi Termal; Et = Energi Total)',
        ['EK + EP = Et', 'EP + EK - T = Et', 'EK - EP + T = Et', 'EK + EP + T = Et'], 3)
  ],
  buoyancy: [
    tut('Buka menu Explore',
        'Simulasi ini memiliki beberapa layar. Pilih layar "Explore" — di sanalah percobaan kita dilakukan.',
        { action_prompt: 'Klik menu "Explore" di bagian bawah layar.' }),
    tut('Ubah Blok A menjadi Custom',
        'Pada panel pengaturan blok, ubah bahan (material) Blok A menjadi "Custom" supaya massa dan volumenya bisa diatur bebas.',
        { action_prompt: 'Ubah bahan Blok A menjadi Custom.' }),
    tut('Atur massa dan volume',
        'Dengan bahan Custom kamu bisa mengatur massa dan volume blok. Ingat: massa jenis (density) = massa ÷ volume, jadi kedua pengaturan ini sekaligus mengubah massa jenis blok.',
        { action_prompt: 'Coba ubah massa dan volume Blok A, perhatikan nilai density-nya.' }),
    tut('Celupkan blok ke dalam fluida',
        'Seret blok lalu lepaskan di dalam kolam. Amati apakah blok terapung, melayang, atau tenggelam, dan perhatikan panah-panah gaya yang bekerja padanya.',
        { action_prompt: 'Celupkan Blok A ke dalam air dan amati gayanya.' }),
    tut('Tambahkan objek kedua',
        'Kamu bisa menampilkan blok kedua melalui ikon dua balok di pojok kanan bawah. Ini berguna untuk membandingkan dua benda atau menumpuk beban.',
        { action_prompt: 'Tampilkan blok kedua lewat ikon 2 balok.' }),
    tut('Tombol reset',
        'Tombol reset oranye di pojok kanan bawah mengembalikan seluruh percobaan ke kondisi awal. Gunakan jika susunan percobaanmu sudah terlalu berantakan.'),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Massa jenis', formula: 'ρ = m / V',
              legend: 'ρ = massa jenis (kg/m³), m = massa (kg), V = volume (m³)' },
            { label: 'Gaya berat', formula: 'w = m × g',
              legend: 'g = percepatan gravitasi (m/s²)' },
            { label: 'Gaya apung (Archimedes)', formula: 'Fa = ρf × g × Vt',
              legend: 'ρf = massa jenis fluida (kg/m³), Vt = volume benda yang tercelup (m³)' }
          ] }),
    tmc('Celupkan balok A ke dalam air dan atur massa jenis (object density)-nya melalui volume dan massa. Ceklis pernyataan yang sesuai.',
        'Kondisi', ['Terapung', 'Tenggelam', 'Melayang'],
        [
          { label: 'Massa jenis objek > Massa Jenis fluida', answer: 1 },
          { label: 'Massa jenis objek < Massa Jenis fluida', answer: 0 },
          { label: 'Massa jenis objek = Massa Jenis fluida', answer: 2 }
        ]),
    cmc('Tambahkan balok ke 2 (icon 2 balok pojok kanan bawah) dan atur bahannya menjadi styrofoam. Maksimalkan volume balok dan celupkan seluruhnya ke dalam air. Pilih semua jawaban yang benar',
        ['Gaya apung (buoyancy) lebih besar dari pada gaya berat (Gravity)',
         'Gaya apung (buoyancy) lebih kecil dari pada gaya berat (Gravity)',
         'lebih banyak volume tercelup dibandingkan terapung ketika seimbang',
         'lebih banyak volume terapung dibandingkan tercelup ketika seimbang',
         'Resultan gaya menggerakan objek ke atas',
         'Resultan gaya menggerakan objek ke bawah'],
        [0, 3, 4]),
    cmc('Tempatkan balok A (custom) sebagai beban di atas balok B (styrofoam dan pastikan volumenya maksimal). Pernyataan yang tepat terkait kapasitas maksimal sebelum tenggelam adalah:',
        ['Kapasitas = Gaya apung tercelup seluruhnya - gaya berat penahan',
         'Kapasitas = gaya apung - gaya berat seluruhnya',
         'Kapasitas maksimum tercapai di batas tepat sebelum beban mengalami gaya apung',
         'kapasitas maksimal tercapai ketika beban mengalami gaya apung'],
        [0, 2]),
    trap(smc('Balok styrofoam bervolume 0,010 m³ dengan massa jenis 50 kg/m³ terapung di air (ρ air = 1000 kg/m³, g = 10 m/s²). Massa beban maksimum yang dapat diletakkan di atas balok tepat sebelum seluruh balok tercelup adalah...',
        ['9,5 kg', '10 kg', '0,5 kg', '95 kg'], 0)),
    tf('Benda tenggelam karena tidak ada gaya apung.', false),
    wb('Menurut Prinsip Archimedes, gaya apung sama dengan __1__ fluida yang __2__ oleh benda.',
       ['berat', 'massa', 'dipindahkan', 'menarik', 'volume'],
       ['berat', 'dipindahkan'])
  ],
  pressure: [
    tut('Periksa tekanan di suatu titik',
        'Simulasi ini menampilkan kolam berisi fluida dan alat pengukur tekanan. Angka pada alat ukur menunjukkan tekanan tepat di posisi ujung alat itu berada.',
        { action_prompt: 'Temukan alat pengukur tekanan di layar simulasi.' }),
    tut('Seret alat ukur tekanan',
        'Seret (drag) alat pengukur dan celupkan ke dalam fluida. Ukur tekanan di beberapa kedalaman: dekat permukaan, di tengah, dan di dasar kolam.',
        { action_prompt: 'Seret alat ukur ke dalam fluida dan ubah-ubah kedalamannya.' }),
    tut('Variabel yang bisa diatur',
        'Di panel pengaturan kamu bisa mengubah massa jenis fluida (Fluid Density) dan gravitasi (Gravity), menampilkan/mematikan tekanan atmosfer, mengisi atau menguras fluida, serta menambahkan beban di atas fluida.',
        { action_prompt: 'Coba ubah salah satu variabel dan amati perubahan angka tekanan.' }),
    tut('Mengulang percobaan',
        'Tombol reset di pojok kanan bawah mengembalikan simulasi ke kondisi awal.'),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Tekanan hidrostatis', formula: 'Ph = ρ × g × h',
              legend: 'ρ = massa jenis fluida (kg/m³), g = percepatan gravitasi (m/s²), h = kedalaman dari permukaan (m)' },
            { label: 'Tekanan total', formula: 'P = P₀ + ρ × g × h',
              legend: 'P₀ = tekanan atmosfer di permukaan fluida (Pa)' },
            { label: 'Pipa U (dua fluida setimbang)', formula: 'ρ₁ × h₁ = ρ₂ × h₂',
              legend: 'tinggi tiap kolom fluida diukur dari bidang batas kedua fluida' }
          ] }),
    tmc('Seret alat ukur tekanan ke dalam fluida dan lakukan perlakuan-perlakuan berikut. Tentukan apa yang terjadi pada angka tekanan untuk setiap perlakuan.',
        'Perlakuan', ['Tekanan bertambah', 'Tekanan berkurang', 'Tekanan tetap'],
        [
          { label: 'Alat ukur diturunkan lebih dalam',                        answer: 0 },
          { label: 'Alat ukur digeser mendatar pada kedalaman yang sama',     answer: 2 },
          { label: 'Alat ukur diangkat mendekati permukaan',                  answer: 1 },
          { label: 'Massa jenis fluida diperbesar (kedalaman alat ukur tetap)', answer: 0 }
        ]),
    cmc('Lakukan eksperimen: ubah massa jenis fluida, ubah gravitasi, lalu matikan/nyalakan atmosfer. Pilih semua pernyataan yang benar:',
        ['Pada kedalaman yang sama, tekanan makin besar jika massa jenis fluida makin besar',
         'Tekanan hidrostatis tidak bergantung pada massa jenis fluida',
         'Memperbesar gravitasi memperbesar tekanan pada kedalaman yang sama',
         'Mematikan atmosfer mengurangi tekanan total yang terukur',
         'Bentuk wadah menentukan besar tekanan pada kedalaman yang sama'],
        [0, 2, 3]),
    smc('Tekanan hidrostatis bergantung pada...',
        ['Volume fluida', 'Bentuk bejana', 'Kedalaman dan massa jenis fluida', 'Luas permukaan fluida'], 2),
    tf('Pada kedalaman yang sama, tekanan dalam satu fluida sama besar.', true),
    trap(smc('Pipa U mula-mula berisi air (ρ = 1000 kg/m³). Minyak (ρ = 800 kg/m³) kemudian dituangkan ke kaki kiri hingga kolom minyak setinggi 10 cm. Setelah setimbang, selisih ketinggian permukaan minyak (kiri) terhadap permukaan air (kanan) adalah...',
        ['2 cm', '8 cm', '10 cm', '0 cm'], 0)),
    wb('Tekanan hidrostatis dirumuskan P = ρ × __1__ × __2__, sehingga makin dalam, tekanan makin __3__.',
       ['g', 'h', 'besar', 'kecil', 'massa'],
       ['g', 'h', 'besar'])
  ],
  fluid: [
    tut('Simulasi aliran fluida',
        'Simulasi ini menampilkan pipa venturi: fluida mengalir melalui tiga segmen pipa (inlet, throat, outlet) yang luas penampangnya bisa diubah-ubah.'),
    tut('Atur bentuk pipa',
        'Gunakan tombol-tombol preset untuk mengubah luas penampang A₁, A₂, A₃, tekanan sumber P₁, dan ketinggian outlet Δh.',
        { highlight: { selector: '[data-tut-id="controls"]' }, action_prompt: 'Coba klik salah satu preset Throat Area (A₂) dan lihat bentuk pipa berubah.' }),
    tut('Gunakan probe pengukur',
        'Arahkan kursor ke dalam pipa pada kanvas simulasi — kursor berfungsi sebagai probe yang mengukur kondisi fluida tepat di titik itu.',
        { highlight: { selector: '[data-tut-id="probe-canvas"]' }, action_prompt: 'Arahkan kursor ke bagian tengah pipa (throat).' }),
    tut('Baca hasil pengukuran',
        'Panel "Probe Measurements" menampilkan segmen, luas penampang, kecepatan, tekanan, dan ketinggian pada posisi probe. Bandingkan nilainya antar segmen saat menjawab soal.',
        { highlight: { selector: '[data-tut-id="readout"]' }, action_prompt: 'Bandingkan angka kecepatan dan tekanan di segmen lebar vs sempit.' }),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Debit', formula: 'Q = A × v',
              legend: 'Q = debit (m³/s), A = luas penampang (m²), v = kecepatan aliran (m/s)' },
            { label: 'Persamaan kontinuitas', formula: 'A₁ × v₁ = A₂ × v₂',
              legend: 'debit di semua segmen pipa sama besar' },
            { label: 'Persamaan Bernoulli', formula: 'P + ½ × ρ × v² + ρ × g × h = konstan',
              legend: 'P = tekanan (Pa), ρ = massa jenis fluida (kg/m³), h = ketinggian titik (m)' }
          ] }),
    tmc('Gunakan probe untuk mengukur kecepatan aliran di tiap segmen (pengaturan awal: A₁ = 80, A₂ = 20, A₃ = 50 cm²). Tentukan apa yang terjadi pada kecepatan ketika probe dipindahkan.',
        'Perpindahan probe', ['Kecepatan naik', 'Kecepatan turun', 'Kecepatan tetap'],
        [
          { label: 'Dari inlet (A₁) ke throat (A₂)',     answer: 0 },
          { label: 'Dari throat (A₂) ke outlet (A₃)',    answer: 1 },
          { label: 'Digeser di dalam segmen yang sama',  answer: 2 }
        ]),
    cmc('Bandingkan hasil pengukuran probe pada segmen sempit dan segmen lebar. Pilih semua pernyataan yang benar:',
        ['Kecepatan aliran di segmen sempit lebih besar',
         'Tekanan di segmen sempit lebih kecil',
         'Debit (A × v) di semua segmen sama besar',
         'Tekanan di segmen sempit lebih besar',
         'Debit hanya bergantung pada luas segmen'],
        [0, 1, 2]),
    smc('Jika luas penampang pipa mengecil, kecepatan aliran fluida...',
        ['Mengecil', 'Membesar', 'Tetap', 'Menjadi nol'], 1),
    trap(smc('Pada simulasi, atur A₁ = 100 cm², A₂ = 20 cm², P₁ = 200 kPa, dan Δh = 0. Jika v₁ = 1 m/s dan ρ = 1000 kg/m³, tekanan pada bagian throat (P₂) menurut persamaan Bernoulli adalah...',
        ['188 kPa', '200 kPa', '212 kPa', '100 kPa'], 0)),
    tf('Persamaan kontinuitas (A₁v₁ = A₂v₂) berlaku untuk fluida tak termampatkan.', true),
    wb('Pada pipa yang menyempit, kecepatan fluida __1__ dan tekanannya __2__.',
       ['meningkat', 'menurun', 'tetap'],
       ['meningkat', 'menurun'])
  ],
  rotation: [
    tut('Simulasi gerak rotasi',
        'Simulasi ini punya dua fase. Fase 1 (Torsi): beban yang jatuh memutar propeller melalui gandar. Fase 2 (Momentum Sudut): panjang bilah diubah saat propeller sedang berputar.'),
    tut('Atur variabel',
        'Panel atas berisi slider massa beban jatuh, radius gandar, massa bilah, dan panjang bilah. Variabel-variabel ini menentukan torsi dan momen inersia sistem.',
        { highlight: { selector: '[data-tut-id="settings"]' }, action_prompt: 'Coba ubah massa beban dan panjang bilah.' }),
    tut('Baca data simulasi',
        'Panel data menampilkan torsi (τ), momen inersia (I), percepatan sudut (α), kecepatan sudut (ω), dan momentum sudut (L) secara langsung.',
        { highlight: { selector: '[data-tut-id="hud"]' } }),
    tut('Jalankan simulasi',
        'Tekan tombol play untuk memulai. Amati nilai-nilai pada panel data selama tiap fase berlangsung.',
        { highlight: { selector: '[data-tut-id="playback"]' }, action_prompt: 'Tekan play, lalu amati nilai α dan ω.' }),
    tut('Ulangi eksperimen',
        'Tombol Reset mengembalikan simulasi ke awal Fase 1 sehingga kamu bisa mengulang percobaan dengan pengaturan berbeda.',
        { highlight: { selector: '[data-tut-id="reset-btn"]' } }),
    tut('Persamaan dasar perhitungan',
        'Sebelum masuk ke soal, catat persamaan berikut. Beberapa soal nanti meminta perhitungan yang menggunakan persamaan ini sebagai dasar.',
        { equations: [
            { label: 'Torsi (momen gaya)', formula: 'τ = r × F',
              legend: 'τ = torsi (N·m), r = lengan gaya (m), F = gaya (N)' },
            { label: 'Hukum II Newton untuk rotasi', formula: 'τ = I × α',
              legend: 'I = momen inersia (kg·m²), α = percepatan sudut (rad/s²)' },
            { label: 'Momentum sudut', formula: 'L = I × ω',
              legend: 'ω = kecepatan sudut (rad/s); tanpa torsi luar L kekal: I₁ × ω₁ = I₂ × ω₂' }
          ] }),
    tmc('Jalankan Fase 1 beberapa kali dengan pengaturan berbeda. Amati nilai percepatan sudut (α) pada panel data untuk setiap perlakuan berikut.',
        'Perlakuan', ['α bertambah', 'α berkurang', 'α tetap'],
        [
          { label: 'Massa beban jatuh diperbesar', answer: 0 },
          { label: 'Panjang bilah diperbesar',     answer: 1 },
          { label: 'Massa bilah diperbesar',       answer: 1 }
        ]),
    cmc('Berdasarkan percobaanmu, faktor yang mempengaruhi momen inersia propeller adalah: (pilih semua yang benar)',
        ['Massa bilah', 'Panjang bilah', 'Distribusi massa terhadap sumbu putar', 'Warna bilah'],
        [0, 1, 2]),
    smc('Momen gaya (torsi) yang memutar gandar dirumuskan...',
        ['τ = m × a', 'τ = r × F', 'τ = F / r', 'τ = m × v'], 1),
    trap(smc('Pada Fase 2, propeller (bilah berupa batang homogen yang berputar di pusatnya, I = ¹⁄₁₂·m·L²) berputar dengan kecepatan sudut 4 rad/s saat panjang bilah 1 m. Tanpa torsi luar, bilah ditarik memendek menjadi 0,5 m. Kecepatan sudut akhirnya adalah...',
        ['16 rad/s', '8 rad/s', '4 rad/s', '2 rad/s'], 0)),
    tf('Jika torsi total nol, benda yang sedang berputar pasti segera berhenti.', false),
    wb('Hukum II Newton untuk rotasi: τ = __1__ × __2__, dengan I adalah __3__.',
       ['I', 'α', 'momen inersia', 'gaya', 'massa'],
       ['I', 'α', 'momen inersia'])
  ]
};

// Sample students so local testing works without a CSV upload.
// These mirror scripts/sample-students.csv exactly.
const SAMPLE_STUDENTS = [
  { nis: '2024001', examinee_no: 'P001', name: 'Ahmad Setiawan',  class_name: 'XI-IPA-1' },
  { nis: '2024002', examinee_no: 'P002', name: 'Budi Santoso',    class_name: 'XI-IPA-1' },
  { nis: '2024003', examinee_no: 'P003', name: 'Citra Dewi',      class_name: 'XI-IPA-1' },
  { nis: '2024004', examinee_no: 'P004', name: 'Dewi Lestari',    class_name: 'XI-IPA-2' },
  { nis: '2024005', examinee_no: 'P005', name: 'Eka Prasetya',    class_name: 'XI-IPA-2' }
];

const upsertSim = db.prepare(`
  INSERT INTO sims (sim_key, title, order_index, embed_path) VALUES (?, ?, ?, ?)
  ON CONFLICT(sim_key) DO UPDATE SET title=excluded.title, order_index=excluded.order_index, embed_path=excluded.embed_path
`);
const hasQuestions = db.prepare(`SELECT 1 FROM questions WHERE sim_key = ? LIMIT 1`);
const deleteQuestions = db.prepare(`DELETE FROM questions WHERE sim_key = ?`);
const insertQuestion = db.prepare(`INSERT INTO questions (sim_key, stage, type, order_index, payload) VALUES (?, ?, ?, ?, ?)`);
const getSeedVersion = db.prepare(`SELECT value FROM settings WHERE key = 'seed_questions_version'`);
const setSeedVersion = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_questions_version', ?)`);
const upsertAdmin = db.prepare(`
  INSERT INTO admins (username, password_hash) VALUES (?, ?)
  ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash
`);
const upsertStudent = db.prepare(`
  INSERT INTO students (nis, examinee_no, name, class_name) VALUES (?, ?, ?, ?)
  ON CONFLICT(nis) DO NOTHING
`);

const txn = db.transaction(() => {
  for (const s of SIMS) upsertSim.run(s.sim_key, s.title, s.order_index, s.embed_path);

  const verRow = getSeedVersion.get();
  const storedVersion = verRow ? parseInt(verRow.value, 10) : 0;
  const replace = storedVersion !== QUESTIONS_VERSION;
  if (replace && storedVersion > 0) {
    console.warn(`[seed] question bank v${storedVersion} → v${QUESTIONS_VERSION}: replacing all questions (responses to old questions are removed)`);
  }

  for (const [simKey, qs] of Object.entries(QUESTIONS)) {
    if (!replace && hasQuestions.get(simKey)) {
      console.log(`[seed] questions for ${simKey} already exist, skipping`);
      continue;
    }
    deleteQuestions.run(simKey);
    let i = 0;
    for (const q of qs) insertQuestion.run(simKey, q.stage, q.type, i++, JSON.stringify(q.payload));
    console.log(`[seed] inserted ${qs.length} questions for ${simKey}`);
  }
  setSeedVersion.run(String(QUESTIONS_VERSION));

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'changeme';
  upsertAdmin.run(adminUser, bcrypt.hashSync(adminPass, 10));
  console.log(`[seed] admin user ready: ${adminUser}`);

  let studentCount = 0;
  for (const s of SAMPLE_STUDENTS) {
    const info = upsertStudent.run(s.nis, s.examinee_no, s.name, s.class_name);
    if (info.changes) studentCount++;
  }
  if (studentCount) console.log(`[seed] inserted ${studentCount} sample students`);
});

txn();
