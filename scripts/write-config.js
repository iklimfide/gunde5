/**
 * Vercel build: GUNDE5_SUPABASE_URL ve GUNDE5_SUPABASE_ANON_KEY ile js/gunde5-config.js üretir.
 * Lokal: env yoksa mevcut dosyaya dokunmaz.
 */
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'js', 'gunde5-config.js');
const url = process.env.GUNDE5_SUPABASE_URL || '';
const key = process.env.GUNDE5_SUPABASE_ANON_KEY || '';

if (url && key) {
  const content =
    '/* Supabase — deploy build sırasında üretildi */\n' +
    'window.GUNDE5_SUPABASE_URL = ' + JSON.stringify(url) + ';\n' +
    'window.GUNDE5_SUPABASE_ANON_KEY = ' + JSON.stringify(key) + ';\n';
  fs.writeFileSync(out, content, 'utf8');
  console.log('js/gunde5-config.js yazıldı.');
} else if (fs.existsSync(out)) {
  console.log('Env yok; mevcut js/gunde5-config.js korunuyor.');
} else {
  console.error(
    'GUNDE5_SUPABASE_URL ve GUNDE5_SUPABASE_ANON_KEY gerekli.\n' +
      'Lokal: js/gunde5-config.example.js → js/gunde5-config.js\n' +
      'Vercel: Project Settings → Environment Variables'
  );
  process.exit(1);
}
