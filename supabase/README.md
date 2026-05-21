# gunde5 Supabase kurulumu

1. [Supabase](https://supabase.com) projesi oluşturun.
2. **SQL Editor** → `schema.sql` dosyasının tamamını çalıştırın.
3. **Authentication** → Providers → Email: açık. Geliştirme için **Confirm email** kapatabilirsiniz.
4. `js/gunde5-config.example.js` → `js/gunde5-config.js` kopyalayın; URL ve `anon` key girin (anon key istemcide görünür; repoda tutulabilir).  
   İsteğe bağlı Vercel env: `GUNDE5_SUPABASE_URL`, `GUNDE5_SUPABASE_ANON_KEY` — deploy build bu değerlerle dosyayı günceller.
5. Kayıt profili için `auth-uye-trigger.sql` dosyasını da çalıştırın (veya güncel `schema.sql`).
6. Profil fotoğrafı ve ek alanlar için `profil-alanlari.sql` dosyasını çalıştırın (mevcut projeler).
7. İtiraf kartlarında profil özeti için `itiraf-profil-meta.sql` dosyasını çalıştırın.
8. Şikayetler için `itiraf-sikayetler.sql` dosyasını çalıştırın.
9. Cevap ve yanıtlar için `itiraf-cevaplar.sql` dosyasını çalıştırın.
10. Profilde itiraf düzenleme için `itiraf-guncelle.sql` dosyasını çalıştırın.
11. Statik siteyi bir sunucudan açın (dosya:// CORS sorun çıkarabilir).

### Yerel sunucu (önemli)

`python -m http.server 8080` **kullanmayın** — `/itiraf` ve özel `404.html` çalışmaz; Python’un ham “File not found” hatasını görürsünüz.

Bunlardan biri:

- `python dev-server.py` veya `start-dev.bat` (önerilen, port 8080)
- `npm start` (`serve` + `serve.json`, port 8080)

## Her gün 13:12 — Kulis → Podyum

1. `itiraf-puan.sql` — `r` puan sütunu
2. `saat-1312-podyum.sql` — cron: **r top 5** → podyum; kuliste kalanlar `silindi_at` (mevcut podyuma dokunmaz)
3. `podyum-koruma.sql` — podyum silinmez / kulise inmez

## Podyum (diğer)
- `itiraf-istatistik-rpc.sql` — kart sayıları (yorum / oy senkronu).
- Karışık gün etiketleri: `podyum-donem-duzelt.sql`.

**Podyum canlı sayılar:** bir kez `podyum-realtime.sql` (veya Dashboard → Replication).

## Kamikaze yönetim paneli (`/kamikaze`)

1. SQL Editor → `kamikaze-admin.sql` çalıştırın (`site_ayar.kamikaze_token` oluşturur).
2. `js/kamikaze-config.example.js` → `js/kamikaze-config.js` — kullanıcı adı, şifre ve **aynı** `KAMIKAZE_API_TOKEN`.
3. Supabase URL/anon key: `gunde5-config.js` ile paylaşılabilir veya kamikaze-config içinde tanımlayın.
4. Panel: `http://localhost:8080/kamikaze/` — `robots: noindex`; repoya `kamikaze-config.js` commit etmeyin.
