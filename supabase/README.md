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

Siteyi **dosyadan çift tıklayarak** (`file://`) açmayın — bildirim ve hikaye linkleri çalışmaz. Tarayıcıda mutlaka:

**http://localhost:8080/podyum** (veya `podyum.html`)

Bunlardan biri (proje kökünde):

- `start-dev.bat` veya `start-dev.ps1` veya `npm run dev` (önerilen: `dev-server.py`, port **8080**)
- `python dev-server.py`

PowerShell’de `cd D:\gunde5 && npm run dev` çalışmazsa: `Set-Location D:\gunde5; npm run dev`

Hikaye iç linki: `http://localhost:8080/podyum?itiraf=7` (podyum), `http://localhost:8080/?itiraf=7` (anasayfa).

## Footer hikaye / mesaj gönderimi

1. SQL Editor → **`footer-submissions.sql`** (`user_submissions`, `contact_messages`, `master_bildirimler`, RPC’ler).
2. Vercel ortam değişkeni (önerilir): `GUNDE5_SUPABASE_SERVICE_ROLE_KEY` — `/api/footer-story` ve `/api/footer-message` IP hash ile rate limit uygular. Yoksa istemci doğrudan `footer_gonder_*` RPC çağırır (`visitor_id` ile).
3. Master gelen kutusu: `/admin/inbox` (hikaye + mesaj sekmeleri; yalnızca master oturumu). Eski URL’ler yönlendirilir.

## Ziyaret / trafik kaynağı

1. `master-admin.sql` veya `security-advisor-definer-fix.sql` çalışmış olmalı (`master_email_eslesir`).
2. SQL Editor → **`ziyaret-trafik.sql`** (tablo + `ziyaret_kaydet` + `master_ziyaret_istatistik`).
3. SQL Editor → **`index-analytics.sql`** (oturum/olay tabloları + `analytics_event_kaydet` + genişletilmiş `master_ziyaret_istatistik` — index okuma/etkileşim metrikleri; **varsayılan master hariç** filtre).
4. Sayfalar `gunde5-ziyaret.js` ile referrer / UTM / yol kaydeder (anonim `oturum_key`; girişte `user_id` dolar).
5. Anasayfa `gunde5-analytics.js` ile Daha Fazla Oku, oy, paylaşım, heartbeat ve hikâye görüntülenmesi ölçer (`visitor_id` + `session_id`).

İstatistik sayfası timeout alıyorsa bir kez **`master-trafik-istatistik.sql`** + **`master-metrik-istatistik.sql`** Run edin (ayrı RPC’ler).

Metrikler özeti sıfır, “en çok görülen” dolu ise: **`analytics-event-session-fix.sql`** → **`master-metrik-istatistik.sql`** (olay tablosundan özet). `event_type` hatası aldıysanız güncel `master-metrik-istatistik.sql` dosyasını tekrar Run edin.

Olay türlerini doğrulamak için: **`analytics-diagnostics.sql`** (`story_vote` / `story_share` / `load_more_click` satırları görünmeli).

- **Sitemap** (`scripts/generate-sitemap.js`) — yalnızca gerçekten yayında olan sayfalar (şu an `/`). Podyum/KVKK vb. dosya olsa bile üründe kapalıysa listeye ekleme.
- **`/istatistikler`** — trafik özeti + **günlük metrikler** + **anasayfa arayüzü** (Ara / Dünkü 5 / arama terimleri; `index-analytics.sql` + `master-gunluk-istatistik.sql` güncel Run)
- **`/metrikler`** — site içi davranış (`site_analytics_*`, oy, paylaşım)

İstatistik sayfası: `master_trafik_istatistik` + `master_gunluk_istatistik` (7|30|90|365 gün).

## Hikaye toplu ekleme (3 bot hikaye)

**SQL Editor (önerilen):** `supabase/seed-hikayeler-txt-3.sql` → Run (çift eklemez).

**Terminalden doğrudan (gunde5.txt):** Dashboard → API → `service_role` →

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
python scripts/gunde5-txt-to-sql.py "C:\Users\iklim\Downloads\gunde5.txt" --ekle
```

Yalnızca SQL üretmek için: `python scripts/gunde5-txt-to-sql.py gunde5.txt` → `supabase/seed-gunde5.sql`  
Dosyada `TARİH: 06-06-2026 07:04` varsa o saatler kullanılır (ör. `seed-gunde5-2026-06-06-08.sql`).

Eski sabit liste: `node scripts/hikaye-ekle.mjs` (`hikayeler` tablosu — yerine gunde5 script kullanın)

## Arama (podyum)

SQL Editor → `itiraf-ara.sql` (rumuz, hikaye metni, cevap/yorum). Sayaç kutusunun altındaki arama kutusu yazdıkça sonuçları listeler.

## Profil kaydet (profil.html)

**`profil-uye-rpc.sql`** — SQL Editor'da bir kez Run (zorunlu). Kulis/podyum master işlemleri farklı RPC kullanır; profil kaydı bu dosya olmadan çalışmaz.

## Hikaye yaz (üye + master)

Canlı şema **`itiraflar`** ise SQL Editor'da bir kez:

**`itiraf-hikaye-yaz-kurulum.sql`** — başlık sütunu (`baslik`, isteğe bağlı), RLS izinleri, master bot/planlı hikaye RPC

Önce **`master-admin.sql`** (veya `security-advisor-definer-fix.sql`) çalışmış olmalı (`master_email_eslesir`).

## Master manuel oy + gerçek oylar

Master moderasyonda **Oylar** ile yazdığınız sayılar `itiraflar` tablosuna gider; üye oyları `itiraf_oylar` tablosundadır. Eski kurulumda trigger yalnızca `itiraf_oylar` sayımını yazardı → bir üye oy verince master sayısı sıfırlanıyordu. **`itiraf-oy-offset.sql`** bir kez çalıştırın (`oy_offset_up` / `oy_offset_down` + güncel trigger + `master_hikaye_islem`).

**Anasayfa (üyeliksiz) oy:** **`itiraf-oy-ver-rpc.sql`** — SQL Editor'da bir kez Run. Ziyaretçi oyu `viewer_key` ile `itiraf_oylar`'a yazılır; sayaçlar `up_votes` / `down_votes` üzerinden herkese görünür.

## Paylaşım önizlemesi (OG görsel)

- Varsayılan kart: kökte **`og-share.png`** (1200×630).
- Hikaye linki: `https://gunde5.com/h/{id}` — Vercel **`api/itiraf-share`** (meta) + **`api/og`** (görsel). Eski `/itiraf/{id}` → `/h/{id}` yönlendirilir.
- Vercel proje ayarlarında ortam değişkenleri: `GUNDE5_SUPABASE_URL`, `GUNDE5_SUPABASE_ANON_KEY` (anon, yalnızca okuma).

## Kulis / otomatik podyum geçişi kaldırıldı

Canlı DB’de bir kez **`kulis-podyum-kaldir.sql`** çalıştırın (13:12 cron + podyum koruma trigger’ları siler).

## Podyum (diğer)
- `itiraf-istatistik-rpc.sql` — kart sayıları (yorum / oy senkronu).
- Karışık gün etiketleri: `podyum-donem-duzelt.sql`.

**Podyum canlı sayılar:** bir kez `podyum-realtime.sql` (veya Dashboard → Replication).

## Master yönetici

1. SQL Editor → `master-admin.sql` (e-posta `site_ayar.master_email` = `arifguvenc@gmail.com`).
2. Bu hesapla giriş yap → profil menüsü → **Moderasyon: Açık**.
3. Açıkken: rumuz altında **Gizli üye yap / Askıya al / Banla**; hikaye altında **Değiştir / Gizle / Sil**. Bot/seed kartlarda (üye hesabı yok) **Kart** satırından yaş, cinsiyet, il düzenlenir → `master-hikaye-kart-meta.sql`.
4. Mevcut DB için ek: `master-uye-gizli-patch.sql` (gizli üye + güncel RPC).
5. Üye listesi / profil düzenleme / fotoğraf yükleme / hesap silme: `master-uyeler-yonetim.sql` → hamburger **👥 Üyeler** → `uyeler.html` (avatar depolama için master storage politikası da bu dosyada). Hesap silmede içerikler kalır; hikaye/cevap bağı kopar ve görünen ad `Gizli Üye` olur.
6. Son aktif / IP / hikaye-yorum düzenleme: `master-uye-aktivite-icerik.sql` (`ziyaret_kaydet` güncellenir; IP proxy başlığı veya istemci ipify yedek).

## Bildirimler

1. `bildirimler.sql` — beğeni (👍) ve yorum bildirimi; dislike bildirimi yok. Bildirime tıklanınca ilgili hikayeye gider.
2. İsteğe bağlı canlı badge: `bildirim-realtime.sql`.
3. Eski kurulum: `bildirimler-status-patch.sql` + `bildirimler.sql` içindeki `bildirim_olustur` güncellemesi.

## Güvenlik (Security Advisor)

Canlı Supabase’de sırayla:

1. **`security-advisor-fix.sql`** (search_path, görüntülenme, trigger revoke)
2. **`security-advisor-definer-fix.sql`** — DEFINER + EXECUTE uyarıları (arama INVOKER, master INVOKER+RLS, trigger/kamikaze revoke)
3. **`security-advisor-definer-fix-2.sql`** — `ziyaret_kaydet`, `master_uye_guncelle`, `master_uye_islem` → INVOKER; `auth.users` / dedup → `private` şema (PostgREST dışı). **`master-uyeler-yonetim.sql` öncesi veya sonrası** bir kez çalıştırın.
4. **`security-advisor-definer-fix-4a.sql`** → **`4b.sql`** → **`4c.sql`** — analytics + oy + istatistik RPC’leri (`SECURITY INVOKER`). **Üçünü ayrı ayrı Run edin** (tek dosyada timeout olur). **`index-analytics.sql` sonrası**.

Dashboard → Security Advisor → **Rerun**. Kamikaze paneli kullanılmıyorsa **`kamikaze-drop.sql`** (RPC temizliği; aksi halde kamikaze yalnızca `service_role` ile çalışır).

Kamikaze (`/kamikaze`) — canlı DB **`itiraflar`** kullanır (`hikayeler` yok). SQL Editor: **`master-kamikaze-panel.sql`** (güncel; `itiraf_cevaplar`, `itiraf_oylar`, `itiraf_sikayetler`). Eski kopya: `master-kamikaze-itiraf-fix.sql` (aynı mantık).
