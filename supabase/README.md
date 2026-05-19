# gunde5 Supabase kurulumu

1. [Supabase](https://supabase.com) projesi oluşturun.
2. **SQL Editor** → `schema.sql` dosyasının tamamını çalıştırın.
3. **Authentication** → Providers → Email: açık. Geliştirme için **Confirm email** kapatabilirsiniz.
4. **Lokal:** `js/gunde5-config.example.js` → `js/gunde5-config.js` kopyalayın; URL ve `anon` key girin.  
   **Vercel:** `js/gunde5-config.js` repoda yok (gitignore). Project Settings → Environment Variables:
   - `GUNDE5_SUPABASE_URL` — Project URL
   - `GUNDE5_SUPABASE_ANON_KEY` — anon public key  
   Deploy sırasında `npm run build` bu dosyayı üretir.
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

## Podyum seçimi (13:12 Türkiye saati)

Şimdilik podyum itirafları `status = 'podyum'` ile listelenir. Günlük geçiş için ileride Supabase **cron + Edge Function** veya manuel SQL:

```sql
-- Örnek: en yüksek net oy alan 5 kulis → podyum
update public.itiraflar set status = 'kulis' where status = 'podyum';
with top5 as (
  select id from public.itiraflar
  where status = 'kulis'
  order by (up_votes - down_votes) desc, created_at desc
  limit 5
)
update public.itiraflar set status = 'podyum' where id in (select id from top5);
```
