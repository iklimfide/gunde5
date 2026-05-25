/* gunde5 — Supabase bağlantısı */
(function (global) {
    var client = null;
    var cachedUser = null;
    var ready = false;

    function isConfigured() {
        var url = global.GUNDE5_SUPABASE_URL;
        var key = global.GUNDE5_SUPABASE_ANON_KEY;
        return !!(url && key && url.indexOf('http') === 0 && key.length > 20);
    }

    function getClient() {
        if (!client && isConfigured() && global.supabase) {
            var url = global.GUNDE5_SUPABASE_URL;
            var key = global.GUNDE5_SUPABASE_ANON_KEY;
            client = global.supabase.createClient(
                url,
                key,
                {
                    global: {
                        headers: {
                            apikey: key
                        }
                    }
                }
            );
        }
        return client;
    }

    function profileToUser(row) {
        if (!row) return null;
        var yil = parseInt(row.dogum_yili, 10);
        return {
            id: row.id,
            username: row.username,
            email: row.email,
            gender: row.gender,
            dogumYili: String(row.dogum_yili),
            age: isNaN(yil) ? null : new Date().getFullYear() - yil,
            avatarUrl: row.avatar_url || null,
            yasadigiYer: row.yasadigi_yer || null,
            yurtdisiSehir: row.yurtdisi_sehir || null,
            meslek: row.meslek || null,
            medeniDurum: row.medeni_durum || null,
            durum: row.durum || 'aktif',
            durumNotu: row.durum_notu || null,
            zorunluGizli: !!row.zorunlu_gizli
        };
    }

    function uyeDurumMesaji(durum) {
        if (durum === 'ban') return 'Hesabın kapatıldı. Destek için iletişime geç.';
        if (durum === 'askida') return 'Hesabın askıya alındı. Şu an hikaye yazamazsın.';
        return null;
    }

    async function uyeDurumKontrol(sb, row) {
        if (!row) return null;
        var durum = row.durum || 'aktif';
        var mesaj = uyeDurumMesaji(durum);
        if (durum === 'ban') {
            await sb.auth.signOut();
            cacheUser(null);
            throw new Error(mesaj);
        }
        return durum;
    }

    var PROFIL_SELECT = 'id, username, email, gender, dogum_yili, avatar_url, yasadigi_yer, yurtdisi_sehir, meslek, medeni_durum, durum, durum_notu, zorunlu_gizli';
    var UYE_KART_SELECT = 'id, username, gender, age, avatar_url, yasadigi_yer, yurtdisi_sehir, meslek, medeni_durum';

    function cacheUser(u) {
        cachedUser = u;
        try {
            if (u) localStorage.setItem('gunde5_user', JSON.stringify(u));
            else localStorage.removeItem('gunde5_user');
        } catch (e) { /* sessiz */ }
        if (global.Gunde5Shell && global.Gunde5Shell.applyShell) global.Gunde5Shell.applyShell();
    }

    async function loadProfile(userId) {
        var sb = getClient();
        if (!sb) return null;
        var res = await sb.from('uye').select(PROFIL_SELECT).eq('id', userId).maybeSingle();
        if (res.error) throw res.error;
        if (!res.data) {
            cacheUser(null);
            return null;
        }
        await uyeDurumKontrol(sb, res.data);
        var u = profileToUser(res.data);
        cacheUser(u);
        return u;
    }

    function getGunde5User() {
        if (cachedUser) return cachedUser;
        try {
            var raw = localStorage.getItem('gunde5_user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function metinPerdele(m) {
        if (global.Gunde5Perde && global.Gunde5Perde.metinPerdele) {
            return global.Gunde5Perde.metinPerdele(m);
        }
        return m;
    }

    function hataMesaji(err) {
        if (!err) return 'Bir hata oluştu.';
        if (err.code === '42501') {
            var yetkiMsg = err.message || '';
            if (yetkiMsg.indexOf('profil_uye_guncelle') >= 0 || yetkiMsg.indexOf('profil_uye_ensure') >= 0) {
                return 'Profil kaydedilemedi (veritabanı izni). Supabase SQL Editor\'da supabase/profil-uye-rpc.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_kamikaze_') >= 0 || yetkiMsg.indexOf('master_oy_islem') >= 0) {
                return 'Kamikaze için veritabanı izni eksik. Supabase SQL Editor\'da supabase/master-kamikaze-panel.sql dosyasını çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_hikaye_islem') >= 0 || yetkiMsg.indexOf('master_cevap_islem') >= 0 ||
                yetkiMsg.indexOf('itiraflar') >= 0 ||
                yetkiMsg.indexOf('itiraf_cevaplar') >= 0 || yetkiMsg.indexOf('itiraf_oylar') >= 0 ||
                yetkiMsg.indexOf('itiraf_puan_guncelle') >= 0) {
                return 'Master işlemi için veritabanı izni eksik. İlgili SQL kurulum dosyasını tekrar çalıştırıp sayfayı yenileyin.';
            }
            return 'Veritabanı izni eksik (42501). İlgili SQL kurulum dosyasını tekrar çalıştırıp sayfayı yenileyin.';
        }
        if (err.code === '23505') return 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.';
        var msg = err.message || '';
        if (msg.indexOf('avatar_url') >= 0 && (msg.indexOf('column') >= 0 || err.code === 'PGRST204')) {
            return 'Veritabanında avatar_url sütunu yok. Supabase SQL Editor\'da supabase/itiraf-avatar.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('bildirimler') >= 0 && (msg.indexOf('relation') >= 0 || err.code === 'PGRST205')) {
            return 'Bildirim tablosu yok. Supabase SQL Editor\'da supabase/bildirimler.sql dosyasını çalıştırın.';
        }
        if ((msg.indexOf('master_uye_listele') >= 0 || msg.indexOf('master_uye_guncelle') >= 0 ||
                msg.indexOf('master_uye_detay') >= 0 || msg.indexOf('master_uye_icerik') >= 0 ||
                msg.indexOf('master_cevap_islem') >= 0) &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Üye yönetimi henüz kurulmadı. Supabase SQL Editor\'da supabase/master-uyeler-yonetim.sql ve master-uye-aktivite-icerik.sql dosyalarını çalıştırın.';
        }
        if ((msg.indexOf('master_kamikaze_panel') >= 0 || msg.indexOf('master_kamikaze_ara') >= 0 ||
                msg.indexOf('master_kamikaze_hikaye_detay') >= 0 || msg.indexOf('master_oy_islem') >= 0) &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Kamikaze henüz kurulmadı. Supabase SQL Editor\'da supabase/master-kamikaze-panel.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('master_hikaye_islem') >= 0 && msg.indexOf('meta') >= 0 &&
            (msg.indexOf('bilinmeyen') >= 0 || msg.indexOf('gecersiz') >= 0)) {
            return 'Kart meta düzenleme için supabase/master-hikaye-kart-meta.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('master_') >= 0 && (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Master yönetim yok. Supabase SQL Editor\'da supabase/master-admin.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('itiraf_ara') >= 0 && (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Arama henüz kurulmadı. Supabase SQL Editor\'da supabase/itiraf-ara.sql dosyasını çalıştırın.';
        }
        if ((msg.indexOf('profil_uye_guncelle') >= 0 || msg.indexOf('profil_uye_ensure') >= 0) &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Profil kaydı için supabase/profil-uye-rpc.sql dosyasını Supabase SQL Editor\'da çalıştırın.';
        }
        if (msg) return msg;
        return String(err);
    }

    function dogrulaKayit(form) {
        var rumuz = String(form.username || '').replace(/^\s+|\s+$/g, '');
        var email = String(form.email || '').replace(/^\s+|\s+$/g, '');
        if (rumuz.length < 5) throw new Error('Kullanıcı adı en az 5 karakter olmalı.');
        if (!email || email.indexOf('@') < 1) throw new Error('Geçerli bir e-posta gir.');
        if (!form.password || String(form.password).length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
        if (!form.dogumYili) throw new Error('Doğum yılını seç.');
        if (form.gender !== 'male' && form.gender !== 'female') throw new Error('Kadın veya erkek seçeneğini işaretle.');
        if (!form.kvkk) throw new Error('Kullanıcı sözleşmesini onaylamalısın.');
        form.username = rumuz;
        form.email = email;
    }

    async function oturumHazirla(sb, signRes, form) {
        if (signRes.data.session) {
            await sb.auth.setSession({
                access_token: signRes.data.session.access_token,
                refresh_token: signRes.data.session.refresh_token
            });
            return;
        }
        var girisRes = await sb.auth.signInWithPassword({
            email: form.email,
            password: form.password
        });
        if (girisRes.error) {
            throw new Error('Kayıt oluştu. E-posta onayını tamamlayıp tekrar giriş yap.');
        }
    }

    /** Giriş yapmış kullanıcı (Auth sunucusu doğrular). */
    async function aktifOturum() {
        if (!isConfigured()) throw new Error('Supabase yapılandırılmadı.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        if (!ready) await init();

        var authRes = await sb.auth.getUser();
        if (authRes.error) throw authRes.error;
        var user = authRes.data && authRes.data.user;
        if (!user || !user.id) {
            cacheUser(null);
            throw new Error('Profil kaydetmek için giriş yapmalısın.');
        }
        return { sb: sb, uid: user.id };
    }

    async function init() {
        if (!isConfigured()) {
            ready = false;
            return false;
        }
        var sb = getClient();
        if (!sb) return false;

        var authRes = await sb.auth.getUser();
        if (authRes.data && authRes.data.user) {
            await loadProfile(authRes.data.user.id);
        } else {
            cacheUser(null);
        }

        sb.auth.onAuthStateChange(async function (event, session) {
            if (session && session.user) {
                await loadProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                cacheUser(null);
            }
            if (typeof global.guncelleHeaderOturum === 'function') {
                global.guncelleHeaderOturum();
            }
            if (typeof global.gunde5AuthDegisti === 'function') {
                global.gunde5AuthDegisti(event);
            }
        });

        ready = true;
        return true;
    }

    async function kayitOl(form) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı. js/gunde5-config.js dosyasını doldurun.');

        dogrulaKayit(form);
        var dogumYili = parseInt(form.dogumYili, 10);

        var signRes = await sb.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
                data: {
                    username: form.username,
                    gender: form.gender,
                    dogum_yili: dogumYili
                }
            }
        });
        if (signRes.error) throw signRes.error;
        if (!signRes.data.user) throw new Error('Kayıt tamamlanamadı.');

        var uid = signRes.data.user.id;
        await oturumHazirla(sb, signRes, form);

        var mevcut = await sb.from('uye').select('id').eq('id', uid).maybeSingle();
        if (mevcut.error) throw mevcut.error;

        if (!mevcut.data) {
            var profRes = await sb.from('uye').insert({
                id: uid,
                username: form.username,
                email: form.email,
                gender: form.gender,
                dogum_yili: dogumYili
            });
            if (profRes.error) throw profRes.error;
        }

        await loadProfile(uid);
        return getGunde5User();
    }

    async function girisYap(form) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var email = String(form.email || '').replace(/^\s+|\s+$/g, '');
        if (!email || email.indexOf('@') < 1) throw new Error('Geçerli bir e-posta gir.');

        var girisRes = await sb.auth.signInWithPassword({
            email: email,
            password: form.password
        });
        if (girisRes.error) throw girisRes.error;
        await loadProfile(girisRes.data.user.id);
        return getGunde5User();
    }

    async function cikisYap() {
        var sb = getClient();
        if (sb) await sb.auth.signOut();
        cacheUser(null);
    }

    async function uyeKartProfilleriGetir(userIds) {
        var sb = getClient();
        var map = {};
        if (!sb || !userIds || !userIds.length) return map;

        var uniq = [];
        var seen = {};
        var i;
        for (i = 0; i < userIds.length; i++) {
            var id = userIds[i];
            if (!id || seen[id]) continue;
            seen[id] = true;
            uniq.push(id);
        }
        if (!uniq.length) return map;

        var res = await sb.rpc('uye_kart_profilleri', { p_ids: uniq });
        if (res.error) {
            var msg = String(res.error.message || '');
            if (
                res.error.code === 'PGRST202' ||
                res.error.code === '42501' ||
                (msg.indexOf('uye_kart_profilleri') >= 0 && msg.indexOf('function') >= 0)
            ) {
                return map;
            }
            throw res.error;
        }
        var rows = res.data || [];
        for (i = 0; i < rows.length; i++) {
            map[rows[i].id] = rows[i];
        }
        return map;
    }

    function itirafSatirProfilBirlestir(row, profil) {
        if (!row || row.is_gizli || !profil) return row;
        row.username = profil.username || row.username;
        row.gender = profil.gender || row.gender;
        row.avatar_url = profil.avatar_url || null;
        row.yasadigi_yer = profil.yasadigi_yer || null;
        row.yurtdisi_sehir = profil.yurtdisi_sehir || null;
        row.meslek = profil.meslek || null;
        row.medeni_durum = profil.medeni_durum || null;
        var yas = parseInt(profil.age, 10);
        if (!isNaN(yas)) {
            row.age = yas;
        }
        return row;
    }

    async function itirafSatirlariProfilZenginlestir(rows) {
        if (!rows || !rows.length) return rows;
        var ids = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            if (!rows[i].is_gizli && rows[i].user_id) {
                ids.push(rows[i].user_id);
            }
        }
        var profiller = await uyeKartProfilleriGetir(ids);
        for (i = 0; i < rows.length; i++) {
            if (!rows[i].is_gizli && rows[i].user_id && profiller[rows[i].user_id]) {
                itirafSatirProfilBirlestir(rows[i], profiller[rows[i].user_id]);
            }
        }
        return rows;
    }

    var KULIS_SAYFA_BOYUT = 12;

    async function kulisListeleSayfa(offset, limit) {
        var sb = getClient();
        if (!sb) return [];
        var lim = limit || KULIS_SAYFA_BOYUT;
        var off = offset || 0;
        var res = await sb
            .from('itiraflar')
            .select('*')
            .eq('status', 'kulis')
            .is('silindi_at', null)
            .order('created_at', { ascending: false })
            .range(off, off + lim - 1);
        if (res.error) throw res.error;
        return itirafSatirlariProfilZenginlestir(res.data || []);
    }

    async function kulisSayfaHazirla(offset, limit) {
        var rows = await kulisListeleSayfa(offset, limit);
        if (!rows.length) return rows;
        var ids = rows.map(function (r) { return r.id; });
        var sayilar = await kokCevapSayilari(ids);
        return satirlaraCevapSayisiEkle(rows, sayilar);
    }

    async function kulisListele() {
        return kulisListeleSayfa(0, 80);
    }

    function itirafAraSonucParse(sonuc) {
        if (!sonuc) return [];
        if (Array.isArray(sonuc)) return sonuc;
        if (typeof sonuc === 'string') {
            try {
                var parsed = JSON.parse(sonuc);
                return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            } catch (e) {
                return [];
            }
        }
        if (typeof sonuc === 'object') return [sonuc];
        return [];
    }

    async function itirafAra(q, status, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var metin = String(q || '').trim();
        var st = status === 'podyum' ? 'podyum' : 'kulis';
        var lim = limit || 50;

        var res = await sb.rpc('itiraf_ara', {
            p_q: metin,
            p_status: st,
            p_limit: lim
        });
        if (res.error) throw res.error;

        var data = res.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                throw new Error('Arama yanıtı okunamadı');
            }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Arama başarısız');
        }

        var rows = itirafAraSonucParse(data.sonuc);
        var i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].cevap_sayisi == null) rows[i].cevap_sayisi = 0;
        }

        try {
            rows = await itirafSatirlariProfilZenginlestir(rows);
        } catch (eProfil) { /* kartlar yine de listelenir */ }

        if (rows.length) {
            try {
                var ids = rows.map(function (r) { return r.id; });
                var sayilar = await kokCevapSayilari(ids);
                rows = satirlaraCevapSayisiEkle(rows, sayilar);
            } catch (eSay) { /* yorum sayısı 0 kalır */ }
        }

        return {
            adet: data.adet != null ? data.adet : rows.length,
            gosterilen: data.gosterilen != null ? data.gosterilen : rows.length,
            rows: rows
        };
    }

    async function podyumBaslikGetir() {
        var sb = getClient();
        if (!sb) return null;
        var res = await sb
            .from('site_ayar')
            .select('deger')
            .eq('anahtar', 'podyum_baslik')
            .maybeSingle();
        if (res.error || !res.data) return null;
        return res.data.deger || null;
    }

    async function podyumDonemleriListele() {
        var sb = getClient();
        if (!sb) return [];
        var res = await sb
            .from('itiraflar')
            .select('podyum_donem')
            .eq('status', 'podyum')
            .is('silindi_at', null)
            .not('podyum_donem', 'is', null)
            .order('podyum_donem', { ascending: false });
        if (res.error) throw res.error;
        var seen = {};
        var out = [];
        var rows = res.data || [];
        var i;
        for (i = 0; i < rows.length; i++) {
            var d = rows[i].podyum_donem;
            if (d && !seen[d]) {
                seen[d] = 1;
                out.push(d);
            }
        }
        if (global.Gunde5UI && global.Gunde5UI.podyumDonemleriKronolojikSirala) {
            return global.Gunde5UI.podyumDonemleriKronolojikSirala(out);
        }
        return out.sort(function (a, b) { return String(b).localeCompare(String(a)); });
    }

    function podyumKartlariSirala(rows) {
        if (!Array.isArray(rows)) return [];
        return rows.slice().sort(function (a, b) {
            var sa = parseInt(a.podyum_sira, 10) || 99;
            var sb = parseInt(b.podyum_sira, 10) || 99;
            if (sa !== sb) return sa - sb;
            return String(a.created_at || '').localeCompare(String(b.created_at || ''));
        });
    }

    async function podyumDonemKartlari(donem) {
        var sb = getClient();
        if (!sb || !donem) return [];
        var res = await sb
            .from('itiraflar')
            .select('*')
            .eq('status', 'podyum')
            .eq('podyum_donem', donem)
            .is('silindi_at', null)
            .order('podyum_sira', { ascending: true, nullsFirst: false })
            .limit(5);
        if (res.error) throw res.error;
        var rows = podyumKartlariSirala(await itirafSatirlariProfilZenginlestir(res.data || []));
        if (!rows.length) return rows;
        var ids = rows.map(function (r) { return r.id; });
        var sayilar = await kokCevapSayilari(ids);
        return satirlaraCevapSayisiEkle(rows, sayilar);
    }

    async function podyumListele() {
        var donemler = await podyumDonemleriListele();
        if (!donemler.length) return [];
        return podyumDonemKartlari(donemler[0]);
    }

    async function profilGuncelle(alanlar) {
        var oturum = await aktifOturum();
        var body = {};

        if (alanlar.yasadigiYer !== undefined) {
            body.yasadigi_yer = alanlar.yasadigiYer || null;
        }
        if (alanlar.yurtdisiSehir !== undefined) {
            body.yurtdisi_sehir = String(alanlar.yurtdisiSehir || '').replace(/^\s+|\s+$/g, '') || null;
        }
        if (alanlar.meslek !== undefined) {
            body.meslek = alanlar.meslek || null;
        }
        if (alanlar.medeniDurum !== undefined) {
            body.medeni_durum = alanlar.medeniDurum || null;
        }
        if (alanlar.avatarUrl !== undefined) {
            body.avatar_url = alanlar.avatarUrl || null;
        }
        if (body.yasadigi_yer && body.yasadigi_yer !== 'yurtdisi') {
            body.yurtdisi_sehir = null;
        }

        var rpcRes = await oturum.sb.rpc('profil_uye_guncelle', { p_body: body });
        if (rpcRes.error) {
            if (rpcRes.error.code === 'PGRST202' ||
                (rpcRes.error.message || '').indexOf('profil_uye_guncelle') >= 0) {
                throw new Error('Profil kaydı için supabase/profil-uye-rpc.sql dosyasını Supabase SQL Editor\'da çalıştırın.');
            }
            throw rpcRes.error;
        }

        var sonuc = rpcRes.data;
        if (!sonuc || sonuc.ok === false) {
            throw new Error((sonuc && sonuc.hata) || 'Profil kaydedilemedi');
        }
        if (!sonuc.uye) {
            throw new Error('Profil yanıtı alınamadı. profil-uye-rpc.sql dosyasını kontrol edin.');
        }

        var guncel = profileToUser(sonuc.uye);
        cacheUser(guncel);
        return guncel;
    }

    async function avatarYukle(file) {
        var oturum = await aktifOturum();
        var sb = oturum.sb;

        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            throw new Error('JPEG, PNG veya WebP bir görsel seç.');
        }
        if (file.size > 2 * 1024 * 1024) {
            throw new Error('Görsel en fazla 2 MB olabilir.');
        }

        var ext = 'jpg';
        if (file.type === 'image/png') ext = 'png';
        else if (file.type === 'image/webp') ext = 'webp';
        else if (file.type === 'image/gif') ext = 'gif';

        var path = oturum.uid + '/avatar.' + ext;
        var up = await sb.storage.from('avatars').upload(path, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: '3600'
        });
        if (up.error) throw up.error;

        var pub = sb.storage.from('avatars').getPublicUrl(path);
        var url = pub.data.publicUrl + '?t=' + Date.now();

        return profilGuncelle({ avatarUrl: url });
    }

    async function avatarKaldir() {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Fotoğraf kaldırmak için giriş yapmalısın.');
        return profilGuncelle({ avatarUrl: null });
    }

    async function masterRpc(fn, body) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb.rpc(fn, { p_body: body || {} });
        if (res.error) throw res.error;
        return res.data;
    }

    async function masterDurum() {
        var sb = getClient();
        if (!sb) return { master: false };
        var res = await sb.rpc('master_durum');
        if (res.error) return { master: false };
        return res.data || { master: false };
    }

    async function masterHikayeIslem(body) {
        var b = Object.assign({}, body || {});
        if (b.content_full != null) {
            b.content_full = metinPerdele(String(b.content_full).replace(/^\s+|\s+$/g, ''));
        }
        return masterRpc('master_hikaye_islem', b);
    }

    async function masterUyeIcerik(uyeId, opts) {
        var o = opts || {};
        return masterRpc('master_uye_icerik', {
            uye_id: uyeId,
            hikaye_limit: o.hikayeLimit || 80,
            yorum_limit: o.yorumLimit || 120
        });
    }

    async function masterCevapIslem(body) {
        var b = Object.assign({}, body || {});
        if (b.content != null) {
            b.content = metinPerdele(String(b.content).replace(/^\s+|\s+$/g, ''));
        }
        return masterRpc('master_cevap_islem', b);
    }

    async function masterUyeIslem(body) {
        return masterRpc('master_uye_islem', body);
    }

    async function masterUyeAra(q, limit) {
        return masterRpc('master_uye_ara', { q: q, limit: limit || 30 });
    }

    async function masterUyeBul(username) {
        return masterRpc('master_uye_bul', { username: username });
    }

    async function masterUyeListele(opts) {
        var o = opts || {};
        return masterRpc('master_uye_listele', {
            q: o.q != null ? o.q : '',
            limit: o.limit || 40,
            offset: o.offset || 0,
            durum: o.durum || ''
        });
    }

    async function masterUyeDetay(uyeId) {
        return masterRpc('master_uye_detay', { uye_id: uyeId });
    }

    async function masterUyeGuncelle(body) {
        return masterRpc('master_uye_guncelle', body);
    }

    async function masterKamikazePanel() {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_kamikaze_panel');
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function masterKamikazeAra(q, limit) {
        return masterRpc('master_kamikaze_ara', {
            q: q != null ? q : '',
            limit: limit || 40
        });
    }

    async function masterKamikazeHikayeDetay(itirafId) {
        return masterRpc('master_kamikaze_hikaye_detay', { itiraf_id: itirafId });
    }

    async function masterOyIslem(body) {
        return masterRpc('master_oy_islem', body);
    }

    function avatarDosyaDogrula(file) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            throw new Error('JPEG, PNG veya WebP bir görsel seç.');
        }
        if (file.size > 2 * 1024 * 1024) {
            throw new Error('Görsel en fazla 2 MB olabilir.');
        }
        var ext = 'jpg';
        if (file.type === 'image/png') ext = 'png';
        else if (file.type === 'image/webp') ext = 'webp';
        else if (file.type === 'image/gif') ext = 'gif';
        return ext;
    }

    async function masterUyeAvatarYukle(uyeId, file) {
        if (!uyeId) throw new Error('Üye seçilmedi.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var ext = avatarDosyaDogrula(file);
        var path = uyeId + '/avatar.' + ext;
        var up = await sb.storage.from('avatars').upload(path, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: '3600'
        });
        if (up.error) throw up.error;

        var pub = sb.storage.from('avatars').getPublicUrl(path);
        var url = pub.data.publicUrl + '?t=' + Date.now();
        var sonuc = await masterUyeGuncelle({ uye_id: uyeId, avatar_url: url });
        if (!sonuc || !sonuc.ok) {
            throw new Error((sonuc && sonuc.hata) || 'Profil fotoğrafı kaydedilemedi.');
        }
        return sonuc;
    }

    async function masterUyeAvatarKaldir(uyeId) {
        if (!uyeId) throw new Error('Üye seçilmedi.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        try {
            var liste = await sb.storage.from('avatars').list(uyeId, { limit: 20 });
            if (!liste.error && liste.data && liste.data.length) {
                var yollar = liste.data.map(function (o) {
                    return uyeId + '/' + o.name;
                });
                await sb.storage.from('avatars').remove(yollar);
            }
        } catch (e) { /* depolama temizliği isteğe bağlı */ }

        var sonuc = await masterUyeGuncelle({ uye_id: uyeId, avatar_url: null });
        if (!sonuc || !sonuc.ok) {
            throw new Error((sonuc && sonuc.hata) || 'Fotoğraf kaldırılamadı.');
        }
        return sonuc;
    }

    async function itirafGuncelle(itirafId, metin) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Hikaye düzenlemek için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var id = parseInt(itirafId, 10);
        if (!id) throw new Error('Geçersiz hikaye.');

        var tam = metinPerdele(String(metin || '').replace(/^\s+|\s+$/g, ''));
        if (!tam) throw new Error('Metin boş olamaz.');

        var mevcut = await sb.from('itiraflar').select('id, is_gizli').eq('id', id).eq('user_id', u.id).is('silindi_at', null).maybeSingle();
        if (mevcut.error) throw mevcut.error;
        if (!mevcut.data) throw new Error('Bu hikayeyi düzenleyemezsin.');

        var kisa = tam.length <= 140 ? tam : tam.slice(0, 137) + '...';
        var payload = { content_full: tam, content_short: kisa };

        var res = await sb.from('itiraflar').update(payload).eq('id', id).eq('user_id', u.id).is('silindi_at', null).select().single();
        if (res.error) throw res.error;
        return (await itirafSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function profilItiraflarim() {
        var u = getGunde5User();
        if (!u || !u.id) return [];
        var sb = getClient();
        if (!sb) return [];
        var res = await sb
            .from('itiraflar')
            .select('*')
            .eq('user_id', u.id)
            .is('silindi_at', null)
            .order('created_at', { ascending: false })
            .limit(50);
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function itirafGonder(metin, gizli) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var sessionRes = await sb.auth.getSession();
        if (!sessionRes.data.session) {
            throw new Error('Hikaye yazmak için giriş yapmalısın.');
        }
        var u = await loadProfile(sessionRes.data.session.user.id);
        if (!u || !u.id) throw new Error('Hikaye yazmak için giriş yapmalısın.');
        if (u.durum === 'askida') {
            throw new Error(uyeDurumMesaji('askida'));
        }

        var tam = metinPerdele(String(metin).replace(/^\s+|\s+$/g, ''));
        if (!tam) throw new Error('Metin boş olamaz.');
        var zorunluGizli = !!u.zorunluGizli;
        var gizliMi = zorunluGizli || !!gizli;
        var username = gizliMi ? 'Gizli Üye' : u.username;
        var kisa = tam.length <= 140 ? tam : tam.slice(0, 137) + '...';
        var kayit = {
            user_id: u.id,
            username: username,
            age: u.age,
            gender: u.gender,
            city: null,
            content_full: tam,
            content_short: kisa,
            status: 'kulis',
            is_gizli: gizliMi
        };

        var res = await sb.from('itiraflar').insert(kayit).select().single();

        if (res.error) throw res.error;
        return (await itirafSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function sikayetGonder(itirafId, sebep, aciklama) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Şikayet göndermek için giriş yapmalısın.');

        var id = parseInt(itirafId, 10);
        if (!sebep) throw new Error('Bir şikayet sebebi seç.');

        var not = String(aciklama || '').replace(/^\s+|\s+$/g, '');
        var res = await sb.from('itiraf_sikayetler').insert({
            itiraf_id: id,
            reporter_id: u.id,
            sebep: sebep,
            aciklama: not || null
        });
        if (res.error) {
            if (res.error.code === '23505') {
                throw new Error('Bu hikaye için zaten şikayet gönderdin.');
            }
            throw res.error;
        }
        return true;
    }

    var CEVAP_SAYFA = 15;
    var YORUM_SAYFA = 8;

    async function itirafGetir(id) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var nid = parseInt(id, 10);
        if (!nid) throw new Error('Geçersiz hikaye.');
        var res = await sb.from('itiraflar').select('*').eq('id', nid).is('silindi_at', null).maybeSingle();
        if (res.error) throw res.error;
        if (!res.data) return null;
        return (await itirafSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function kokCevapSayilari(itirafIds) {
        var map = {};
        var i;
        if (!itirafIds || !itirafIds.length) return map;
        var sb = getClient();
        if (!sb) return map;
        var ids = [];
        for (i = 0; i < itirafIds.length; i++) {
            var nid = parseInt(itirafIds[i], 10);
            if (nid) ids.push(nid);
        }
        if (!ids.length) return map;

        try {
            var rpc = await sb.rpc('itiraf_cevap_sayilari', { p_ids: ids });
            if (!rpc.error && rpc.data && rpc.data.length) {
                for (i = 0; i < rpc.data.length; i++) {
                    var row = rpc.data[i];
                    map[String(row.itiraf_id)] = row.adet != null ? row.adet : 0;
                }
                return map;
            }
        } catch (eRpc) { /* RPC yoksa sayım sorgusuna düş */ }

        var tasks = ids.map(function (id) {
            return sb
                .from('itiraf_cevaplar')
                .select('id', { count: 'exact', head: true })
                .eq('itiraf_id', id)
                .then(function (res) {
                    if (res.error) throw res.error;
                    map[String(id)] = res.count || 0;
                });
        });
        await Promise.all(tasks);
        return map;
    }

    async function itirafYorumToplam(itirafId) {
        var sb = getClient();
        if (!sb) return 0;
        var nid = parseInt(itirafId, 10);
        var res = await sb
            .from('itiraf_cevaplar')
            .select('id', { count: 'exact', head: true })
            .eq('itiraf_id', nid);
        if (res.error) throw res.error;
        return res.count || 0;
    }

    function satirlaraCevapSayisiEkle(rows, sayiMap) {
        var i;
        for (i = 0; i < rows.length; i++) {
            var id = String(rows[i].id);
            rows[i].cevap_sayisi = sayiMap[id] != null ? sayiMap[id] : 0;
        }
        return rows;
    }

    async function cevapSatirlariCinsZenginlestir(rows) {
        if (!rows || !rows.length) return rows || [];
        var ids = [];
        var seen = {};
        var i;
        for (i = 0; i < rows.length; i++) {
            var uid = rows[i].user_id;
            if (uid && !seen[uid]) {
                seen[uid] = true;
                ids.push(uid);
            }
        }
        if (!ids.length) return rows;
        var profiller = await uyeKartProfilleriGetir(ids);
        for (i = 0; i < rows.length; i++) {
            var p = rows[i].user_id ? profiller[rows[i].user_id] : null;
            if (p && p.gender) {
                rows[i].gender = p.gender;
            } else if (!rows[i].gender) {
                rows[i].gender = 'female';
            }
        }
        return rows;
    }

    async function kokCevaplariListele(itirafId, offset, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var nid = parseInt(itirafId, 10);
        var off = offset || 0;
        var lim = limit || CEVAP_SAYFA;
        var res = await sb
            .from('itiraf_cevaplar')
            .select('*')
            .eq('itiraf_id', nid)
            .is('parent_id', null)
            .order('created_at', { ascending: false })
            .range(off, off + lim - 1);
        if (res.error) throw res.error;
        return cevapSatirlariCinsZenginlestir(res.data || []);
    }

    async function kokCevapToplam(itirafId) {
        var sb = getClient();
        if (!sb) return 0;
        var nid = parseInt(itirafId, 10);
        var res = await sb
            .from('itiraf_cevaplar')
            .select('id', { count: 'exact', head: true })
            .eq('itiraf_id', nid)
            .is('parent_id', null);
        if (res.error) throw res.error;
        return res.count || 0;
    }

    async function yorumlariListele(cevapId, offset, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var cid = parseInt(cevapId, 10);
        var off = offset || 0;
        var lim = limit || YORUM_SAYFA;
        var res = await sb
            .from('itiraf_cevaplar')
            .select('*')
            .eq('parent_id', cid)
            .order('created_at', { ascending: true })
            .range(off, off + lim - 1);
        if (res.error) throw res.error;
        return cevapSatirlariCinsZenginlestir(res.data || []);
    }

    async function yorumToplam(cevapId) {
        var sb = getClient();
        if (!sb) return 0;
        var cid = parseInt(cevapId, 10);
        var res = await sb
            .from('itiraf_cevaplar')
            .select('id', { count: 'exact', head: true })
            .eq('parent_id', cid);
        if (res.error) throw res.error;
        return res.count || 0;
    }

    async function cevapGonder(itirafId, metin, parentCevapId) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Yanıt yazmak için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var nid = parseInt(itirafId, 10);
        var icerik = metinPerdele(String(metin || '').replace(/^\s+|\s+$/g, ''));
        if (!icerik) throw new Error('Metin boş olamaz.');
        if (icerik.length > 2000) throw new Error('En fazla 2000 karakter yazabilirsin.');

        var itirafRes = await sb
            .from('itiraflar')
            .select('id, user_id')
            .eq('id', nid)
            .is('silindi_at', null)
            .maybeSingle();
        if (itirafRes.error) throw itirafRes.error;
        if (!itirafRes.data) throw new Error('Hikaye bulunamadı veya süresi dolmuş.');

        var parentId = null;
        if (parentCevapId) {
            var pid = parseInt(parentCevapId, 10);
            var parRes = await sb.from('itiraf_cevaplar').select('id, itiraf_id, parent_id').eq('id', pid).maybeSingle();
            if (parRes.error) throw parRes.error;
            if (!parRes.data) throw new Error('Cevap bulunamadı.');
            if (parRes.data.parent_id) throw new Error('Yalnızca ana cevaplara yanıt yazılabilir.');
            if (parRes.data.itiraf_id !== nid) throw new Error('Geçersiz yanıt.');
            parentId = pid;
        } else if (
            u.id &&
            itirafRes.data.user_id &&
            u.id === itirafRes.data.user_id
        ) {
            throw new Error('Kendi hikayene doğrudan cevap yazamazsın. Başkalarının cevaplarına yanıt verebilirsin.');
        }

        var kayit = {
            itiraf_id: nid,
            parent_id: parentId,
            user_id: u.id,
            username: u.username,
            content: icerik
        };
        var res = await sb.from('itiraf_cevaplar').insert(kayit).select().single();
        if (res.error) throw res.error;
        var satir = res.data;
        if (satir) {
            satir.gender = u.gender === 'male' ? 'male' : 'female';
        }
        return satir;
    }

    async function oyVer(itirafId, oy) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Oy vermek için giriş yapmalısın.');

        var id = parseInt(itirafId, 10);
        oy = oy === 1 ? 1 : -1;

        var mevcutRes = await sb.from('itiraf_oylar')
            .select('oy')
            .eq('itiraf_id', id)
            .eq('user_id', u.id)
            .maybeSingle();
        if (mevcutRes.error) throw mevcutRes.error;

        if (mevcutRes.data && mevcutRes.data.oy === oy) {
            var ayniSay = await sb.from('itiraflar').select('up_votes, down_votes').eq('id', id).is('silindi_at', null).single();
            if (ayniSay.error) throw ayniSay.error;
            return Object.assign({}, ayniSay.data, { oy: oy });
        }

        var oyRes = await sb.from('itiraf_oylar').upsert(
            { itiraf_id: id, user_id: u.id, oy: oy },
            { onConflict: 'itiraf_id,user_id' }
        );
        if (oyRes.error) throw oyRes.error;

        var sayRes = await sb.from('itiraflar').select('up_votes, down_votes').eq('id', id).is('silindi_at', null).single();
        if (sayRes.error) throw sayRes.error;
        return Object.assign({}, sayRes.data, { oy: oy });
    }

    function getViewerKey() {
        var u = getGunde5User();
        if (u && u.id) return 'u:' + u.id;
        try {
            var k = global.localStorage.getItem('gunde5_viewer_key');
            if (!k) {
                if (global.crypto && global.crypto.randomUUID) {
                    k = 'a:' + global.crypto.randomUUID();
                } else {
                    k = 'a:' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
                }
                global.localStorage.setItem('gunde5_viewer_key', k);
            }
            return k;
        } catch (e) {
            return 'a:anon-' + Date.now();
        }
    }

    async function ziyaretKaydet(body) {
        var sb = getClient();
        if (!sb) return null;
        try {
            var res = await sb.rpc('ziyaret_kaydet', { p_body: body || {} });
            if (res.error) return null;
            return res.data;
        } catch (e) {
            return null;
        }
    }

    async function masterZiyaretIstatistik(gun) {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_ziyaret_istatistik', { p_gun: gun || 30 });
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function goruntulenmeKaydet(itirafId) {
        var sb = getClient();
        if (!sb) return null;
        var id = parseInt(itirafId, 10);
        if (!id) return null;
        try {
            var res = await sb.rpc('itiraf_goruntulenme_kaydet', {
                p_itiraf_id: id,
                p_viewer_key: getViewerKey()
            });
            if (res.error) return null;
            return res.data;
        } catch (e) {
            return null;
        }
    }

    var bildirimRtKanal = null;

    async function bildirimleriListele(limit) {
        var sb = getClient();
        var u = getGunde5User();
        if (!sb || !u || !u.id) return [];
        var lim = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
        var res = await sb
            .from('bildirimler')
            .select('id, tip, itiraf_id, itiraf_status, yapan_id, yapan_username, cevap_id, okundu, created_at')
            .eq('alici_id', u.id)
            .order('created_at', { ascending: false })
            .limit(lim);
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function bildirimOkunmamisSayisi() {
        var sb = getClient();
        var u = getGunde5User();
        if (!sb || !u || !u.id) return 0;
        var res = await sb
            .from('bildirimler')
            .select('id', { count: 'exact', head: true })
            .eq('alici_id', u.id)
            .eq('okundu', false);
        if (res.error) throw res.error;
        return res.count != null ? res.count : 0;
    }

    async function bildirimOkunduIsaretle(bildirimId) {
        var sb = getClient();
        var u = getGunde5User();
        if (!sb || !u || !u.id) return;
        var id = parseInt(bildirimId, 10);
        if (!id) return;
        var res = await sb
            .from('bildirimler')
            .update({ okundu: true })
            .eq('id', id)
            .eq('alici_id', u.id);
        if (res.error) throw res.error;
    }

    async function bildirimTumunuOkundu() {
        var sb = getClient();
        var u = getGunde5User();
        if (!sb || !u || !u.id) return;
        var res = await sb
            .from('bildirimler')
            .update({ okundu: true })
            .eq('alici_id', u.id)
            .eq('okundu', false);
        if (res.error) throw res.error;
    }

    function bildirimAboneligiBaslat(userId, onYeni) {
        var sb = getClient();
        if (!sb || !userId) return null;
        bildirimAboneligiKapat();
        var ch = sb.channel('g5_bildirim_' + String(userId).slice(0, 8) + '_' + Date.now());
        ch.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'bildirimler',
                filter: 'alici_id=eq.' + userId
            },
            function () {
                if (typeof onYeni === 'function') onYeni();
            }
        );
        ch.subscribe();
        bildirimRtKanal = ch;
        return ch;
    }

    function bildirimAboneligiKapat() {
        if (!bildirimRtKanal) return;
        try {
            var sb = getClient();
            if (sb) sb.removeChannel(bildirimRtKanal);
        } catch (e) { /* sessiz */ }
        bildirimRtKanal = null;
    }

    async function yukleKulisListe(konteynerId) {
        if (global.Gunde5LazyListe && global.Gunde5LazyListe.initKulis) {
            return global.Gunde5LazyListe.initKulis(konteynerId);
        }
        var el = document.getElementById(konteynerId);
        if (!el) return;
        if (!isConfigured()) {
            el.innerHTML = Gunde5UI.bosListe('Supabase bağlantısı kurulmadı. js/gunde5-config.js dosyasını doldurun.');
            return;
        }
        el.innerHTML = '<p class="liste-bos">Yükleniyor…</p>';
        try {
            var rows = await kulisListele();
            el.innerHTML = '';
            var i;
            for (i = 0; i < rows.length; i++) {
                el.appendChild(Gunde5UI.renderKulisCard(rows[i]));
            }
            if (Gunde5UI.kulisBarajGuncelle) Gunde5UI.kulisBarajGuncelle(el);
            if (global.Gunde5KartCevap) global.Gunde5KartCevap.initSayfa();
        } catch (err) {
            el.innerHTML = Gunde5UI.bosListe(hataMesaji(err));
            Gunde5UI.showToast(hataMesaji(err), 'hata');
        }
    }

    var PODYUM_BANNER_UST_ETIKET = 'EFSANELER';

    function podyumDonemTarihSatir(kaynak) {
        var s = String(kaynak || '').trim();
        var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
            return parseInt(iso[3], 10) + '/' + parseInt(iso[2], 10) + '/' + iso[1];
        }
        var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) {
            return parseInt(m[1], 10) + '/' + parseInt(m[2], 10) + '/' + m[3];
        }
        if (s && !/şampiyon/i.test(s)) {
            return s;
        }
        return '22/5/2026';
    }

    function podyumDonemAltSatir(kaynak) {
        return podyumDonemTarihSatir(kaynak);
    }

    /** Podyum: gün başına bir kez yenilenir — son 13:12 TR dönemine kadar önbellek. */
    var PODYUM_CACHE_COOKIE = 'g5_podyum_v1';
    var PODYUM_CACHE_LS = 'g5_podyum_ls_v1';
    var PODYUM_COOKIE_MAX_ENC = 3800;

    function podyumCacheSatirPaketle(r) {
        return {
            id: r.id,
            u: r.user_id,
            g: r.gender,
            n: r.username,
            i: r.is_gizli ? 1 : 0,
            cf: r.content_full || null,
            cs: r.content_short || null,
            up: r.up_votes != null ? r.up_votes : 0,
            dn: r.down_votes != null ? r.down_votes : 0,
            c: r.cevap_sayisi != null ? r.cevap_sayisi : 0,
            v: r.sayfa_goruntulenme != null ? r.sayfa_goruntulenme : 0,
            ps: r.podyum_sira,
            pd: r.podyum_donem,
            av: r.avatar_url || null,
            yz: r.yasadigi_yer || null,
            ys: r.yurtdisi_sehir || null,
            m: r.meslek || null,
            md: r.medeni_durum || null,
            dy: r.dogum_yili || null
        };
    }

    function podyumCacheSatirAc(p) {
        if (!p) return null;
        if (p.content_full != null || (p.content_short != null && p.id != null && p.gender != null)) {
            return p;
        }
        return {
            id: p.id,
            user_id: p.u,
            gender: p.g,
            username: p.n,
            is_gizli: !!p.i,
            content_full: p.cf,
            content_short: p.cs,
            up_votes: p.up,
            down_votes: p.dn,
            cevap_sayisi: p.c,
            sayfa_goruntulenme: p.v,
            podyum_sira: p.ps,
            podyum_donem: p.pd,
            avatar_url: p.av,
            yasadigi_yer: p.yz,
            yurtdisi_sehir: p.ys,
            meslek: p.m,
            medeni_durum: p.md,
            dogum_yili: p.dy
        };
    }

    function podyumCacheSatirlariAc(liste) {
        var out = [];
        var i;
        for (i = 0; i < (liste || []).length; i++) {
            var row = podyumCacheSatirAc(liste[i]);
            if (row) out.push(row);
        }
        return out;
    }

    function podyumCacheHamOku() {
        try {
            var ls = global.localStorage.getItem(PODYUM_CACHE_LS);
            if (ls) return JSON.parse(ls);
        } catch (e) { /* sessiz */ }
        try {
            var parcalar = document.cookie.split(';');
            var i;
            var pref = PODYUM_CACHE_COOKIE + '=';
            for (i = 0; i < parcalar.length; i++) {
                var parca = parcalar[i].replace(/^\s+/, '');
                if (parca.indexOf(pref) === 0) {
                    return JSON.parse(decodeURIComponent(parca.slice(pref.length)));
                }
            }
        } catch (e2) { /* sessiz */ }
        return null;
    }

    function podyumCacheOku(donemUtc) {
        try {
            var o = podyumCacheHamOku();
            if (o && o.d === donemUtc && Array.isArray(o.r) && o.r.length) {
                return {
                    donem: o.pd || (o.r[0] && (o.r[0].pd || o.r[0].podyum_donem)) || '',
                    baslik: o.b || '',
                    rows: podyumCacheSatirlariAc(o.r)
                };
            }
        } catch (e) { /* sessiz */ }
        return null;
    }

    function podyumCacheYaz(donemUtc, donem, baslik, rows) {
        var UI = global.Gunde5UI;
        if (!UI || !UI.hedefSaatTr || donemUtc == null || !rows || !rows.length) return;
        var paketli = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            paketli.push(podyumCacheSatirPaketle(rows[i]));
        }
        var o = { d: donemUtc, pd: donem || '', b: baslik || '', r: paketli };
        var json = JSON.stringify(o);
        try {
            global.localStorage.setItem(PODYUM_CACHE_LS, json);
        } catch (eLs) { /* sessiz */ }
        try {
            var kodlu = encodeURIComponent(json);
            if (kodlu.length > PODYUM_COOKIE_MAX_ENC) return;
            var maxAge = Math.floor((UI.hedefSaatTr().getTime() - Date.now()) / 1000);
            if (maxAge < 120) maxAge = 120;
            var guvenli = global.location && global.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie =
                PODYUM_CACHE_COOKIE +
                '=' +
                kodlu +
                '; path=/; max-age=' +
                maxAge +
                '; SameSite=Lax' +
                guvenli;
        } catch (eCk) { /* sessiz */ }
    }

    function podyumCacheDonemUtc() {
        var UI = global.Gunde5UI;
        return UI && UI.sonPodyumTrAniUtc ? UI.sonPodyumTrAniUtc() : null;
    }

    var podyumRtKanal = null;
    var podyumCevapTazeZamanlayicilar = {};

    function podyumRealtimeKapat() {
        var k;
        for (k in podyumCevapTazeZamanlayicilar) {
            if (Object.prototype.hasOwnProperty.call(podyumCevapTazeZamanlayicilar, k)) {
                clearTimeout(podyumCevapTazeZamanlayicilar[k]);
            }
        }
        podyumCevapTazeZamanlayicilar = {};
        var sb = getClient();
        if (podyumRtKanal && sb) {
            try {
                sb.removeChannel(podyumRtKanal);
            } catch (e) { /* sessiz */ }
            podyumRtKanal = null;
        }
    }

    /** Podyum kartları: güncel up/down + tüm kök/yanıt satırlarından yorum (cevap) sayısı — hafif sorgu. */
    async function podyumSayilariTazeGetir(itirafIds) {
        var sb = getClient();
        if (!sb || !itirafIds || !itirafIds.length) return {};
        var ids = [];
        var i;
        for (i = 0; i < itirafIds.length; i++) {
            var n = parseInt(itirafIds[i], 10);
            if (n) ids.push(n);
        }
        if (!ids.length) return {};
        var res = await sb.from('itiraflar').select('id,up_votes,down_votes').in('id', ids).is('silindi_at', null);
        if (res.error) throw res.error;
        var sayMap = await kokCevapSayilari(ids);
        var out = {};
        var rows = res.data || [];
        for (i = 0; i < rows.length; i++) {
            var row = rows[i];
            var sid = String(row.id);
            out[sid] = {
                up_votes: row.up_votes != null ? row.up_votes : 0,
                down_votes: row.down_votes != null ? row.down_votes : 0,
                cevap_sayisi: sayMap[sid] != null ? sayMap[sid] : 0
            };
        }
        return out;
    }

    function podyumSayilariKartlaraUygula(listeEl, byId) {
        var UI = global.Gunde5UI;
        if (!listeEl || !listeEl.isConnected || !UI || !UI.kartPodyumIstatistikEnjekteEt) return;
        var id;
        for (id in byId) {
            if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
            var card = listeEl.querySelector('.card[data-id="' + id + '"]');
            if (card) {
                UI.kartPodyumIstatistikEnjekteEt(card, byId[id]);
            }
        }
    }

    function podyumHibritZamanlanmisCevapTaze(listeEl, itirafId) {
        var key = String(itirafId);
        if (podyumCevapTazeZamanlayicilar[key]) {
            clearTimeout(podyumCevapTazeZamanlayicilar[key]);
        }
        podyumCevapTazeZamanlayicilar[key] = setTimeout(function () {
            delete podyumCevapTazeZamanlayicilar[key];
            if (!listeEl || !listeEl.isConnected) return;
            var nid = parseInt(key, 10);
            if (!nid) return;
            podyumSayilariTazeGetir([nid])
                .then(function (map) {
                    podyumSayilariKartlaraUygula(listeEl, map);
                })
                .catch(function () { /* sessiz */ });
        }, 280);
    }

    function podyumAboneligiBaslat(listeEl, ids) {
        var sb = getClient();
        if (!sb || !listeEl || !ids || !ids.length) return;
        podyumRealtimeKapat();
        var ch = sb.channel('g5_podyum_' + String(Date.now()) + '_' + String(Math.random()).slice(2, 9));
        var j;
        for (j = 0; j < ids.length; j++) {
            (function (itirafNum) {
                if (!itirafNum) return;
                var idFiltre = String(itirafNum);
                ch.on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'itiraflar', filter: 'id=eq.' + idFiltre },
                    function (payload) {
                        if (!listeEl.isConnected) return;
                        var yeni = payload.new;
                        if (!yeni || yeni.id == null) return;
                        var UI = global.Gunde5UI;
                        var card = listeEl.querySelector('.card[data-id="' + String(yeni.id) + '"]');
                        if (!card || !UI || !UI.kartPodyumIstatistikEnjekteEt) return;
                        var stat = {};
                        if (yeni.up_votes != null) stat.up_votes = yeni.up_votes;
                        if (yeni.down_votes != null) stat.down_votes = yeni.down_votes;
                        if (stat.up_votes !== undefined || stat.down_votes !== undefined) {
                            UI.kartPodyumIstatistikEnjekteEt(card, stat);
                        }
                    }
                );
                ch.on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'itiraf_cevaplar', filter: 'itiraf_id=eq.' + idFiltre },
                    function () {
                        podyumHibritZamanlanmisCevapTaze(listeEl, itirafNum);
                    }
                );
                ch.on(
                    'postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'itiraf_cevaplar', filter: 'itiraf_id=eq.' + idFiltre },
                    function () {
                        podyumHibritZamanlanmisCevapTaze(listeEl, itirafNum);
                    }
                );
            })(parseInt(ids[j], 10));
        }
        ch.subscribe();
        podyumRtKanal = ch;
    }

    /** Çerezden anında basıldıktan sonra: isteğe bağlı tüy sorgu + Realtime (g5_podyum_v1 mantığına dokunmaz). */
    function podyumHibritCanlandir(listeEl, rows, arkaPlanSorgu) {
        if (!listeEl || !rows || !rows.length) return;
        var ids = rows.map(function (r) { return r.id; });
        podyumAboneligiBaslat(listeEl, ids);
        if (arkaPlanSorgu) {
            var idsCopy = ids.slice();
            var hedefEl = listeEl;
            setTimeout(function () {
                if (!hedefEl.isConnected) return;
                podyumSayilariTazeGetir(idsCopy)
                    .then(function (map) {
                        if (!hedefEl.isConnected) return;
                        podyumSayilariKartlaraUygula(hedefEl, map);
                    })
                    .catch(function () { /* sessiz */ });
            }, 0);
        }
    }

    async function yuklePodyumListe(konteynerId) {
        if (global.Gunde5PodyumLazy && global.Gunde5PodyumLazy.init) {
            return global.Gunde5PodyumLazy.init(konteynerId);
        }
        var el = document.getElementById(konteynerId);
        if (!el) return;
        podyumRealtimeKapat();
        if (!isConfigured()) {
            el.innerHTML = Gunde5UI.bosListe('Supabase bağlantısı kurulmadı. js/gunde5-config.js dosyasını doldurun.');
            return;
        }
        el.innerHTML = '<p class="liste-bos">Yükleniyor…</p>';
        try {
            var rows = await podyumListele();
            var donemler = await podyumDonemleriListele();
            var baslikEl = document.getElementById('podyumDonemBaslik');
            var topEtiketEl = document.getElementById('podyumTopEtiket');
            var sampiyonlarEl = document.getElementById('podyumSampiyonlar');
            if (topEtiketEl) topEtiketEl.textContent = PODYUM_BANNER_UST_ETIKET;
            if (baslikEl && donemler.length) {
                var iso = String(donemler[0]).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                var kaynak = iso ? iso[3] + '/' + iso[2] + '/' + iso[1] : donemler[0];
                baslikEl.textContent = podyumDonemAltSatir(kaynak);
            }
            el.innerHTML = '';
            if (!rows.length) {
                if (sampiyonlarEl) sampiyonlarEl.hidden = true;
                el.innerHTML = Gunde5UI.podyumBosMesajiHtml();
                return;
            }
            if (sampiyonlarEl) sampiyonlarEl.hidden = false;
            var i;
            for (i = 0; i < rows.length; i++) {
                el.appendChild(Gunde5UI.renderPodyumCard(rows[i]));
            }
            if (global.Gunde5KartCevap) global.Gunde5KartCevap.initSayfa();
            podyumHibritCanlandir(el, rows, true);
        } catch (err) {
            el.innerHTML = Gunde5UI.bosListe(hataMesaji(err));
            Gunde5UI.showToast(hataMesaji(err), 'hata');
        }
    }

    global.Gunde5DB = {
        init: init,
        isConfigured: isConfigured,
        isReady: function () { return ready; },
        getSupabaseClient: getClient,
        getGunde5User: getGunde5User,
        bildirimleriListele: bildirimleriListele,
        bildirimOkunmamisSayisi: bildirimOkunmamisSayisi,
        bildirimOkunduIsaretle: bildirimOkunduIsaretle,
        bildirimTumunuOkundu: bildirimTumunuOkundu,
        bildirimAboneligiBaslat: bildirimAboneligiBaslat,
        bildirimAboneligiKapat: bildirimAboneligiKapat,
        kayitOl: kayitOl,
        girisYap: girisYap,
        cikisYap: cikisYap,
        itirafGonder: itirafGonder,
        oyVer: oyVer,
        goruntulenmeKaydet: goruntulenmeKaydet,
        ziyaretKaydet: ziyaretKaydet,
        masterZiyaretIstatistik: masterZiyaretIstatistik,
        getViewerKey: getViewerKey,
        sikayetGonder: sikayetGonder,
        itirafGetir: itirafGetir,
        kokCevapSayilari: kokCevapSayilari,
        itirafYorumToplam: itirafYorumToplam,
        kokCevaplariListele: kokCevaplariListele,
        kokCevapToplam: kokCevapToplam,
        yorumlariListele: yorumlariListele,
        yorumToplam: yorumToplam,
        cevapGonder: cevapGonder,
        CEVAP_SAYFA: CEVAP_SAYFA,
        YORUM_SAYFA: YORUM_SAYFA,
        KULIS_SAYFA_BOYUT: KULIS_SAYFA_BOYUT,
        kulisListele: kulisListele,
        itirafAra: itirafAra,
        kulisListeleSayfa: kulisListeleSayfa,
        kulisSayfaHazirla: kulisSayfaHazirla,
        podyumBaslikGetir: podyumBaslikGetir,
        podyumDonemleriListele: podyumDonemleriListele,
        podyumDonemKartlari: podyumDonemKartlari,
        podyumListele: podyumListele,
        itirafSatirlariProfilZenginlestir: itirafSatirlariProfilZenginlestir,
        profilGuncelle: profilGuncelle,
        avatarYukle: avatarYukle,
        avatarKaldir: avatarKaldir,
        itirafGuncelle: itirafGuncelle,
        masterDurum: masterDurum,
        masterHikayeIslem: masterHikayeIslem,
        masterUyeIslem: masterUyeIslem,
        masterUyeAra: masterUyeAra,
        masterUyeBul: masterUyeBul,
        masterUyeListele: masterUyeListele,
        masterUyeDetay: masterUyeDetay,
        masterUyeGuncelle: masterUyeGuncelle,
        masterUyeAvatarYukle: masterUyeAvatarYukle,
        masterUyeAvatarKaldir: masterUyeAvatarKaldir,
        masterUyeIcerik: masterUyeIcerik,
        masterCevapIslem: masterCevapIslem,
        masterKamikazePanel: masterKamikazePanel,
        masterKamikazeAra: masterKamikazeAra,
        masterKamikazeHikayeDetay: masterKamikazeHikayeDetay,
        masterOyIslem: masterOyIslem,
        profilItiraflarim: profilItiraflarim,
        yukleKulisListe: yukleKulisListe,
        yuklePodyumListe: yuklePodyumListe,
        podyumHibritCanlandir: podyumHibritCanlandir,
        podyumRealtimeKapat: podyumRealtimeKapat,
        podyumCacheOku: podyumCacheOku,
        podyumCacheYaz: podyumCacheYaz,
        podyumCacheDonemUtc: podyumCacheDonemUtc,
        PODYUM_BANNER_UST_ETIKET: PODYUM_BANNER_UST_ETIKET,
        podyumDonemTarihSatir: podyumDonemTarihSatir,
        podyumDonemAltSatir: podyumDonemAltSatir,
        hataMesaji: hataMesaji
    };

    global.getGunde5User = getGunde5User;
})(window);
