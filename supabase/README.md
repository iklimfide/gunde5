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

**http://localhost:8080/** (veya `index.html`)

Bunlardan biri (proje kökünde):

- `start-dev.bat` veya `start-dev.ps1` veya `npm run dev` (önerilen: `dev-server.py`, port **8080**)
- `python dev-server.py`

PowerShell’de `cd D:\gunde5 && npm run dev` çalışmazsa: `Set-Location D:\gunde5; npm run dev`

Hikaye iç linki: `http://localhost:8080/index.html?itiraf=7` (podyum), `http://localhost:8080/kulis.html?itiraf=7` (kulis).

## Ziyaret / trafik kaynağı

1. `master-admin.sql` veya `security-advisor-definer-fix.sql` çalışmış olmalı (`master_email_eslesir`).
2. SQL Editor → **`ziyaret-trafik.sql`** (tablo + `ziyaret_kaydet` + `master_ziyaret_istatistik`).
3. Sayfalar `gunde5-ziyaret.js` ile referrer / UTM / yol kaydeder (anonim `oturum_key`; girişte `user_id` dolar).

İleride istatistik menüsü: `Gunde5DB.masterZiyaretIstatistik(30)`.

## Hikaye toplu ekleme (3 bot hikaye)

**SQL Editor (önerilen):** `supabase/seed-hikayeler-txt-3.sql` → Run (çift eklemez).

**Service role ile:** Dashboard → API → `service_role` anahtarı →

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
node scripts/hikaye-ekle.mjs
```

Yeni txt dosyaları için: `python scripts/hikaye-txt-to-sql.py dosya.txt -o supabase/seed-yeni.sql`

## Arama (kulis + podyum)

SQL Editor → `itiraf-ara.sql` (rumuz, hikaye metni, cevap/yorum). Sayaç kutusunun altındaki arama kutusu yazdıkça sonuçları listeler.

## Her gün 13:12 — Kulis → Podyum

1. `itiraf-puan.sql` — `r` puan sütunu
2. `saat-1312-podyum.sql` — cron: **r top 5** → podyum; kuliste kalanlar `silindi_at` (mevcut podyuma dokunmaz)
3. `podyum-koruma.sql` — podyum silinmez / kulise inmez

## Podyum (diğer)
- `itiraf-istatistik-rpc.sql` — kart sayıları (yorum / oy senkronu).
- Karışık gün etiketleri: `podyum-donem-duzelt.sql`.

**Podyum canlı sayılar:** bir kez `podyum-realtime.sql` (veya Dashboard → Replication).

## Master yönetici

1. SQL Editor → `master-admin.sql` (e-posta `site_ayar.master_email` = `arifguvenc@gmail.com`).
2. Bu hesapla giriş yap → profil menüsü → **Moderasyon: Açık**.
3. Açıkken: rumuz altında **Gizli üye yap / Askıya al / Banla**; hikaye altında **Değiştir / Gizle / Sil**. Bot/seed kartlarda (üye hesabı yok) **Kart** satırından yaş, cinsiyet, il düzenlenir → `master-hikaye-kart-meta.sql`.
4. Mevcut DB için ek: `master-uye-gizli-patch.sql` (gizli üye + güncel RPC).
5. Üye listesi / profil düzenleme / fotoğraf yükleme / hesap silme: `master-uyeler-yonetim.sql` → hamburger **👥 Üyeler** → `uyeler.html` (avatar depolama için master storage politikası da bu dosyada).
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

Dashboard → Security Advisor → **Rerun**. Kamikaze paneli kullanılmıyorsa **`kamikaze-drop.sql`** (RPC temizliği; aksi halde kamikaze yalnızca `service_role` ile çalışır).
