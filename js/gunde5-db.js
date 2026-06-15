/* gunde5 — Supabase bağlantısı */
(function (global) {
    var client = null;
    var cachedUser = null;
    var ready = false;
    var authListenerKayitli = false;
    var masterRpcBilet = 0;
    var authGate = { hazir: false, oturum: null, bekle: null };
    var masterPanelHazirPromise = null;
    var initPromise = null;

    function isConfigured() {
        var url = global.GUNDE5_SUPABASE_URL;
        var key = global.GUNDE5_SUPABASE_ANON_KEY;
        return !!(url && key && url.indexOf('http') === 0 && key.length > 20);
    }

    /** RPC adı kuruluma göre değişebilir (itiraf_* / hikaye_*). */
    async function rpcIlk(adlar, params) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var i;
        var res;
        var sonHata = null;
        for (i = 0; i < adlar.length; i++) {
            res = await sb.rpc(adlar[i], params);
            if (!res.error) return res;
            sonHata = res.error;
            if (res.error.code !== 'PGRST202') throw res.error;
        }
        throw sonHata || new Error('RPC bulunamadı: ' + adlar.join(', '));
    }

    function getClient() {
        if (!client && isConfigured() && global.supabase) {
            var url = global.GUNDE5_SUPABASE_URL;
            var key = global.GUNDE5_SUPABASE_ANON_KEY;
            client = global.supabase.createClient(
                url,
                key,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: false
                    },
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
        var res = await supabaseRace(
            sb.from('uye').select(PROFIL_SELECT).eq('id', userId).maybeSingle(),
            10000,
            'Profil yüklenemedi.'
        );
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

    function ikiHanePlan(n) {
        return n < 10 ? '0' + n : String(n);
    }

    /** datetime-local / Date / ISO → Istanbul duvar saati (+03:00). */
    function planliTarihIso(val) {
        if (val == null) return null;
        var d;
        if (val instanceof Date) {
            d = val;
        } else {
            var raw = String(val).replace(/^\s+|\s+$/g, '');
            if (!raw) return null;
            var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
            if (m) {
                d = new Date(
                    parseInt(m[1], 10),
                    parseInt(m[2], 10) - 1,
                    parseInt(m[3], 10),
                    parseInt(m[4], 10),
                    parseInt(m[5], 10),
                    m[6] ? parseInt(m[6], 10) : 0,
                    0
                );
            } else {
                var ms = Date.parse(raw);
                if (isNaN(ms)) return null;
                d = new Date(ms);
            }
        }
        if (isNaN(d.getTime())) return null;
        return d.getFullYear() + '-' + ikiHanePlan(d.getMonth() + 1) + '-' + ikiHanePlan(d.getDate()) +
            'T' + ikiHanePlan(d.getHours()) + ':' + ikiHanePlan(d.getMinutes()) + ':00+03:00';
    }

    function hataMesaji(err) {
        if (!err) return 'Bir hata oluştu.';
        var http403 = err.status === 403 || err.statusCode === 403 ||
            String(err.message || '').indexOf('403') >= 0;
        if (http403 && err.code !== '42501') {
            return 'Master panel erişimi reddedildi (403). Master hesabıyla giriş yapın; Supabase SQL Editor\'da supabase/master-panel-canli-403-fix.sql dosyasını çalıştırın. Eksik RPC için sırayla: master-kamikaze-panel.sql, master-metrik-istatistik.sql, master-gunluk-istatistik.sql, master-mudavim-istatistik.sql, index-analytics.sql.';
        }
        if (err.code === '42501') {
            var yetkiMsg = err.message || '';
            if (yetkiMsg.indexOf('profil_uye_guncelle') >= 0 || yetkiMsg.indexOf('profil_uye_ensure') >= 0) {
                return 'Profil kaydedilemedi (veritabanı izni). Supabase SQL Editor\'da supabase/profil-uye-rpc.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_kamikaze_') >= 0 || yetkiMsg.indexOf('master_oy_islem') >= 0) {
                return 'Kamikaze için veritabanı izni eksik. Supabase SQL Editor\'da supabase/master-kamikaze-itiraf-fix.sql dosyasını çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_hikaye_ekle') >= 0) {
                return 'Master hikaye ekleme izni eksik. Supabase SQL Editor\'da supabase/itiraf-hikaye-yaz-kurulum.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_hikaye_islem') >= 0 || yetkiMsg.indexOf('master_cevap_islem') >= 0 ||
                yetkiMsg.indexOf('itiraf_cevaplar') >= 0 || yetkiMsg.indexOf('hikaye_cevaplar') >= 0 ||
                yetkiMsg.indexOf('itiraf_oylar') >= 0 || yetkiMsg.indexOf('hikaye_oylar') >= 0 ||
                yetkiMsg.indexOf('hikaye_puan_guncelle') >= 0) {
                return 'Master işlemi için veritabanı izni eksik. İlgili SQL kurulum dosyasını tekrar çalıştırıp sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('itiraflar') >= 0 || yetkiMsg.indexOf('hikayeler') >= 0) {
                return 'Hikaye gönderilemedi (veritabanı izni). Supabase SQL Editor\'da supabase/itiraf-hikaye-yaz-kurulum.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_ziyaret_istatistik') >= 0 ||
                yetkiMsg.indexOf('analytics_kayit_dahil') >= 0 ||
                yetkiMsg.indexOf('site_analytics_') >= 0) {
                return 'İstatistik izni eksik. Supabase SQL Editor\'da supabase/index-analytics.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('goruntulenme_kaydet') >= 0 ||
                yetkiMsg.indexOf('itiraf_goruntulenmeler') >= 0 ||
                yetkiMsg.indexOf('itiraflar_goruntulenme') >= 0) {
                return 'Görüntülenme sayacı izni eksik. Supabase SQL Editor\'da supabase/itiraf-goruntulenme-42501-fix.sql dosyasını bir kez çalıştırın, sonra sayfayı yenileyin.';
            }
            if (yetkiMsg.indexOf('master_') >= 0) {
                return 'Master panel izni eksik. Supabase SQL Editor\'da supabase/master-panel-canli-403-fix.sql dosyasını çalıştırın; ardından eksik RPC dosyalarını (kamikaze, metrik, müdavim) Run edin.';
            }
            return 'Veritabanı izni eksik (42501). İlgili SQL kurulum dosyasını tekrar çalıştırıp sayfayı yenileyin.';
        }
        if (err.code === '23505') return 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.';
        var msg = err.message || '';
        if (msg.indexOf('zaten_oyladin') >= 0) {
            return 'Bu hikayeyi zaten oyladın esnaf!';
        }
        if (msg.indexOf('itiraf_oy_ver') >= 0 && err.code === 'PGRST202') {
            return 'Oy sistemi kurulmamış. Supabase\'de supabase/itiraf-oy-ver-rpc.sql dosyasını bir kez çalıştırın.';
        }
        if (msg.indexOf('avatar_url') >= 0 && (msg.indexOf('column') >= 0 || err.code === 'PGRST204')) {
            return 'Veritabanında avatar_url sütunu yok. Supabase SQL Editor\'da supabase/hikaye-avatar.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('baslik') >= 0 && (msg.indexOf('column') >= 0 || err.code === 'PGRST204')) {
            return 'Başlık sütunu yok. Supabase SQL Editor\'da supabase/itiraf-hikaye-yaz-kurulum.sql dosyasını bir kez çalıştırın.';
        }
        if ((msg.indexOf('slug') >= 0 || msg.indexOf('slug_hint') >= 0) &&
            (msg.indexOf('column') >= 0 || err.code === 'PGRST204')) {
            return 'URL slug kurulumu eksik. Supabase SQL Editor\'da supabase/itiraf-slug.sql dosyasını bir kez çalıştırın.';
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
            return 'Kamikaze henüz kurulmadı. Supabase SQL Editor\'da supabase/master-kamikaze-itiraf-fix.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('master_hikaye_islem') >= 0 && msg.indexOf('meta') >= 0 &&
            (msg.indexOf('bilinmeyen') >= 0 || msg.indexOf('gecersiz') >= 0)) {
            return 'Kart meta düzenleme için supabase/master-hikaye-kart-meta.sql dosyasını çalıştırın.';
        }
        if (msg.indexOf('bilinmeyen islem') >= 0 && msg.indexOf('yayin') >= 0) {
            return 'Planlama tarihi için supabase/master-hikaye-yayin-tarihi.sql dosyasını Supabase SQL Editor\'da çalıştırın.';
        }
        if (msg.indexOf('Planlı hikaye kaydı') >= 0 || msg.indexOf('planli hikaye') >= 0) {
            return msg;
        }
        if (msg.indexOf('master_hikaye_ekle') >= 0 &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Master hikaye ekleme kurulmamış. Supabase SQL Editor\'da supabase/itiraf-hikaye-yaz-kurulum.sql dosyasını bir kez çalıştırın.';
        }
        if (msg.indexOf('invalid input syntax for type timestamp') >= 0 ||
            msg.indexOf('gecersiz yayin tarihi') >= 0) {
            return 'Yayın tarihi geçersiz. Tarih/saat alanını temizleyip tekrar seçin.';
        }
        if (msg.indexOf('master_submission_planla') >= 0 &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Gelen kutusu planlama kurulmamış. Supabase SQL Editor\'da supabase/master-submission-planla.sql dosyasını bir kez çalıştırın.';
        }
        if ((msg.indexOf('footer_gonder_') >= 0 || msg.indexOf('master_submissions') >= 0 ||
                msg.indexOf('master_submission_guncelle') >= 0 ||
                msg.indexOf('master_messages') >= 0 || msg.indexOf('master_bildirim') >= 0) &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Footer gönderim kurulumu eksik. Supabase SQL Editor\'da supabase/footer-submissions.sql dosyasını çalıştırın. Rumuz için ayrıca supabase/footer-submission-username.sql.';
        }
        if (msg.indexOf('master_') >= 0 && (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Master yönetim yok. Supabase SQL Editor\'da supabase/master-admin.sql dosyasını çalıştırın.';
        }
        if ((msg.indexOf('itiraf_ara') >= 0 || msg.indexOf('hikaye_ara') >= 0) &&
            (msg.indexOf('function') >= 0 || err.code === 'PGRST202')) {
            return 'Arama henüz kurulmadı. Supabase SQL Editor\'da supabase/hikaye-ara.sql dosyasını çalıştırın.';
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

    function authGateTamamla(oturum) {
        authGate.hazir = true;
        authGate.oturum = oturum || null;
    }

    function authGateSifirla() {
        authGate.hazir = false;
        authGate.oturum = null;
        authGate.bekle = null;
        masterPanelHazirPromise = null;
    }

    function authGateBekle(maxMs) {
        if (authGate.hazir) {
            return Promise.resolve(authGate.oturum);
        }
        if (authGate.bekle) return authGate.bekle;
        var limit = maxMs != null ? maxMs : 15000;
        authGate.bekle = new Promise(function (resolve) {
            var start = Date.now();
            function kontrol() {
                if (authGate.hazir || Date.now() - start >= limit) {
                    resolve(authGate.oturum);
                    return;
                }
                setTimeout(kontrol, 40);
            }
            kontrol();
        });
        return authGate.bekle;
    }

    function authDinleyiciKaydet(sb) {
        if (authListenerKayitli || !sb) return;
        authListenerKayitli = true;
        sb.auth.onAuthStateChange(function (event, session) {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                authGateTamamla(session);
                if (session && session.user) {
                    loadProfile(session.user.id).catch(function () {
                        /* JWT geçerli; profil yüklenemese yedek kalsın */
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                cacheUser(null);
                authGateSifirla();
            }
            if (typeof global.guncelleHeaderOturum === 'function') {
                global.guncelleHeaderOturum();
            }
            if (typeof global.gunde5AuthDegisti === 'function') {
                global.gunde5AuthDegisti(event);
            }
        });
    }

    async function init() {
        if (ready) return true;
        if (initPromise) return initPromise;
        initPromise = (async function () {
            if (!isConfigured()) {
                ready = false;
                return false;
            }
            var sb = getClient();
            if (!sb) return false;

            authDinleyiciKaydet(sb);

            try {
                var sesRes = await sb.auth.getSession();
                if (sesRes.data && sesRes.data.session) {
                    if (!authGate.hazir) authGateTamamla(sesRes.data.session);
                    loadProfile(sesRes.data.session.user.id).catch(function () {
                        /* JWT geçerli; profil yüklenemese yedek kalsın */
                    });
                }
            } catch (eSes) { /* */ }

            if (!authGate.hazir) {
                await authGateBekle(2000);
            }

            if (!authGate.hazir) {
                try {
                    var refInit = await supabaseRace(sb.auth.refreshSession(), 10000, '');
                    if (refInit.data && refInit.data.session) {
                        authGateTamamla(refInit.data.session);
                    } else {
                        var ses2 = await sb.auth.getSession();
                        if (ses2.data && ses2.data.session) {
                            authGateTamamla(ses2.data.session);
                        } else {
                            authGateTamamla(null);
                        }
                    }
                } catch (e2) {
                    authGateTamamla(null);
                }
            }

            ready = true;
            return true;
        })();
        return initPromise;
    }

    /** Tüm master RPC öncesi tek kapı: JWT localStorage'dan yüklenene / yenilenene kadar bekler. */
    async function authHazir() {
        await init();
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var sesRes = await sb.auth.getSession();
        var session = sesRes.data && sesRes.data.session;
        if (session) {
            var exp = session.expires_at;
            if (exp && exp * 1000 < Date.now() + 45000) {
                var yenile = await supabaseRace(sb.auth.refreshSession(), 12000, 'Oturum yenilenemedi.');
                if (yenile.data && yenile.data.session) {
                    authGateTamamla(yenile.data.session);
                    return yenile.data.session;
                }
            }
            authGateTamamla(session);
            return session;
        }

        if (!authGate.hazir) {
            await authGateBekle(2000);
            sesRes = await sb.auth.getSession();
            session = sesRes.data && sesRes.data.session;
            if (session) {
                authGateTamamla(session);
                return session;
            }
        }

        var ref = await supabaseRace(sb.auth.refreshSession(), 12000, 'Oturum yenilenemedi.');
        if (ref.data && ref.data.session) {
            authGateTamamla(ref.data.session);
            return ref.data.session;
        }

        var userRes = await supabaseRace(sb.auth.getUser(), 12000, 'Kullanıcı doğrulanamadı.');
        if (userRes.data && userRes.data.user) {
            sesRes = await sb.auth.getSession();
            if (sesRes.data && sesRes.data.session) {
                authGateTamamla(sesRes.data.session);
                return sesRes.data.session;
            }
        }

        throw new Error('Oturum hazır değil. /bulut sayfasından tekrar giriş yap.');
    }

    async function masterPanelHazir() {
        if (masterPanelHazirPromise) return masterPanelHazirPromise;
        masterPanelHazirPromise = supabaseRace(
            (async function () {
                var session = await authHazir();
                if (!session || !session.user) {
                    throw new Error('Giriş gerekli');
                }
                var sb = getClient();
                var res = await sb.rpc('master_durum');
                if (res.error || !res.data || !res.data.master) {
                    throw new Error('yetkisiz');
                }
                return { master: true, user: getGunde5User(), session: session };
            })(),
            20000,
            'Panel oturumu hazır değil (20 sn). /bulut sayfasından giriş yapıp tekrar dene.'
        ).catch(function (e) {
            masterPanelHazirPromise = null;
            throw e;
        });
        return masterPanelHazirPromise;
    }

    /** @deprecated authHazir kullan */
    async function oturumHazirBekle(maxMs) {
        try {
            await authHazir();
            return true;
        } catch (e) {
            if (maxMs != null && maxMs > 0) {
                try {
                    await authGateBekle(maxMs);
                    await authHazir();
                    return true;
                } catch (e2) { /* */ }
            }
            return false;
        }
    }

    async function oturumGecerliMi() {
        try {
            await authHazir();
            return true;
        } catch (e) {
            return false;
        }
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

    function hikayeSatirProfilBirlestir(row, profil) {
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

    async function hikayeSatirlariProfilZenginlestir(rows) {
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
                hikayeSatirProfilBirlestir(rows[i], profiller[rows[i].user_id]);
            }
        }
        return rows;
    }


    var INDEX_SAYFA_BOYUT = 5;

    /** Index — yalnızca kartta kullanılan sütunlar (ek sorgu / profil birleştirme yok). */
    var INDEX_ITIRAF_SELECT =
        'id,baslik,slug,slug_hint,username,age,gender,city,yasadigi_yer,yurtdisi_sehir,content_short,content_full,up_votes,down_votes,created_at';

    /** Gelecek tarihli kayıtlar (planlı yayın) anasayfada görünmez. */
    function indexYayindaFiltre(q) {
        return q.lte('created_at', new Date().toISOString()).is('silindi_at', null);
    }

    /** Anasayfada görünen (index) hikaye sayısı — kamikaze index filtresi ile uyumlu. */
    async function indexYayindaHikayeSay() {
        await init();
        var sb = getClient();
        if (!sb) return 0;
        var simdi = new Date().toISOString();
        var res = await sb
            .from('itiraflar')
            .select('id', { count: 'exact', head: true })
            .is('silindi_at', null)
            .neq('status', 'silindi')
            .neq('status', 'podyum')
            .or('is_gizli.is.null,is_gizli.eq.false')
            .lte('created_at', simdi);
        if (res.error) throw res.error;
        return res.count || 0;
    }

    /** /planli — created_at > şimdi, kulis, silinmemiş */
    async function planliHikayeListele() {
        await init();
        var sb = getClient();
        if (!sb) return [];
        var simdi = new Date().toISOString();
        var res = await sb
            .from('itiraflar')
            .select(INDEX_ITIRAF_SELECT)
            .is('silindi_at', null)
            .eq('status', 'kulis')
            .gt('created_at', simdi)
            .order('created_at', { ascending: true });
        if (res.error) throw res.error;
        return res.data || [];
    }

    /** @param {'yeni'|'tum'|'gulumseten'|'populer'|'efsane'} sort */
    async function indexHikayeListeleSayfa(offset, limit, sort) {
        var sb = getClient();
        if (!sb) return [];
        var lim = limit || INDEX_SAYFA_BOYUT;
        var off = offset || 0;
        var s = sort || 'yeni';
        var q = indexYayindaFiltre(sb.from('itiraflar').select(INDEX_ITIRAF_SELECT));

        if (s === 'populer') {
            q = q.order('r', { ascending: false }).order('created_at', { ascending: false });
        } else if (s === 'gulumseten' || s === 'efsane') {
            try {
                var efsRes = await sb.rpc('index_itiraf_listele_efsane', {
                    p_offset: off,
                    p_limit: lim
                });
                if (!efsRes.error && efsRes.data != null) {
                    var efsRows = efsRes.data;
                    if (typeof efsRows === 'string') {
                        try { efsRows = JSON.parse(efsRows); } catch (eParse) { efsRows = []; }
                    }
                    return Array.isArray(efsRows) ? efsRows : [];
                }
            } catch (eEfs) { /* RPC yoksa DB sırasına düş */ }
            q = q
                .order('tekil_goruntulenme', { ascending: false })
                .order('sayfa_goruntulenme', { ascending: false })
                .order('created_at', { ascending: false });
        } else {
            q = q.order('created_at', { ascending: false });
        }

        var res = await q.range(off, off + lim - 1);
        if (res.error) throw res.error;
        return res.data || [];
    }

    function ymdGunEkle(ymd, delta) {
        var p = String(ymd || '').split('-');
        if (p.length !== 3) return null;
        var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
        d.setUTCDate(d.getUTCDate() + delta);
        var y = d.getUTCFullYear();
        var m = d.getUTCMonth() + 1;
        var g = d.getUTCDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (g < 10 ? '0' : '') + g;
    }

    function istanbulYmdSimdi() {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    }

    function istanbulYmdFromIso(iso) {
        if (!iso) return null;
        var t = new Date(iso);
        if (isNaN(t.getTime())) return null;
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(t);
    }

    function istanbulYmdDun() {
        return ymdGunEkle(istanbulYmdSimdi(), -1);
    }

    /** YYYY-MM-DD (İstanbul takvim günü) → [00:00, ertesi 00:00) ISO aralığı. */
    function istanbulGunAraligi(ymd) {
        var sonYmd = ymdGunEkle(ymd, 1);
        if (!sonYmd) return null;
        return {
            bas: ymd + 'T00:00:00+03:00',
            son: sonYmd + 'T00:00:00+03:00'
        };
    }

    function rpcTarihCoz(data) {
        if (data == null) return null;
        var s = String(data);
        return s.length >= 10 ? s.slice(0, 10) : null;
    }

    /** Takvim bugünü için yayında (created_at ≤ şimdi) en az bir hikâye var mı? */
    async function bugunTakvimYayindaVarMi() {
        var sb = getClient();
        if (!sb) return false;
        var takvim = istanbulYmdSimdi();
        if (!takvim) return false;
        var aralik = istanbulGunAraligi(takvim);
        if (!aralik) return false;
        var bugunRes = await indexYayindaFiltre(
            sb
                .from('itiraflar')
                .select('id')
                .gte('created_at', aralik.bas)
                .lt('created_at', aralik.son)
        ).limit(1);
        return !bugunRes.error && !!(bugunRes.data && bugunRes.data.length);
    }

    /** Aktif baskı: takvim bugünü; yayınlı gün varsa RPC/onaylı gün, yoksa yine bugün (rastgele 5). */
    async function aktifBaskiGunGetir() {
        var sb = getClient();
        var takvim = istanbulYmdSimdi();
        if (!takvim) return null;
        if (!sb) return takvim;

        if (await bugunTakvimYayindaVarMi()) {
            try {
                var rpcRes = await sb.rpc('gunde5_aktif_baski_gunu');
                if (!rpcRes.error && rpcRes.data != null) {
                    var rpcGun = rpcTarihCoz(rpcRes.data);
                    if (rpcGun) return rpcGun;
                }
            } catch (eRpc) { /* istemci yedeği */ }
        }

        return takvim;
    }

    async function oncekiBaskiGunGetir(aktifGun) {
        var sb = getClient();
        if (!sb || !aktifGun) return null;

        try {
            var rpcRes = await sb.rpc('gunde5_onceki_baski_gunu', { p_aktif: aktifGun });
            if (!rpcRes.error && rpcRes.data != null) {
                return rpcTarihCoz(rpcRes.data);
            }
        } catch (eRpc) { /* istemci yedeği */ }

        var aralik = istanbulGunAraligi(aktifGun);
        if (!aralik) return null;
        var res = await indexYayindaFiltre(
            sb
                .from('itiraflar')
                .select('created_at')
                .lt('created_at', aralik.bas)
                .order('created_at', { ascending: false })
        ).limit(1);
        if (res.error || !res.data || !res.data.length) {
            return null;
        }
        return istanbulYmdFromIso(res.data[0].created_at);
    }

    async function baskiGunHikayeleriGetir(ymd, limit) {
        var sb = getClient();
        if (!sb || !ymd) return [];
        var aralik = istanbulGunAraligi(ymd);
        if (!aralik) return [];
        var res = await indexYayindaFiltre(
            sb
                .from('itiraflar')
                .select(INDEX_ITIRAF_SELECT)
                .gte('created_at', aralik.bas)
                .lt('created_at', aralik.son)
        )
            .order('created_at', { ascending: true })
            .limit(limit || 5);
        if (res.error) throw res.error;
        return res.data || [];
    }

    function rpcSatirlarCoz(data) {
        var rows = data;
        if (rows == null) return [];
        if (typeof rows === 'string') {
            try { rows = JSON.parse(rows); } catch (e) { return []; }
        }
        return Array.isArray(rows) ? rows : [];
    }

    function indexSatirGosterimVerisiVar(row) {
        if (!row) return false;
        if (String(row.baslik || '').trim()) return true;
        if (String(row.slug_hint || '').trim()) return true;
        if (String(row.username || '').trim()) return true;
        if (String(row.content_full || '').trim()) return true;
        if (String(row.content_short || '').trim()) return true;
        return false;
    }

    /** RPC yalnızca id döndürdüyse kart alanlarını tek sorguda tamamla. */
    async function indexSatirlarBaslikZenginlestir(rows) {
        if (!rows || !rows.length) return rows || [];
        var eksikIdler = [];
        var i;
        for (i = 0; i < rows.length; i++) {
            if (!indexSatirGosterimVerisiVar(rows[i]) && rows[i].id != null) {
                eksikIdler.push(parseInt(rows[i].id, 10));
            }
        }
        eksikIdler = eksikIdler.filter(function (n) { return isFinite(n) && n > 0; });
        if (!eksikIdler.length) return rows;
        var sb = getClient();
        if (!sb) return rows;
        var res = await indexYayindaFiltre(
            sb.from('itiraflar').select(INDEX_ITIRAF_SELECT).in('id', eksikIdler)
        );
        if (res.error || !res.data || !res.data.length) return rows;
        var byId = {};
        for (i = 0; i < res.data.length; i++) {
            byId[String(res.data[i].id)] = res.data[i];
        }
        return rows.map(function (r) {
            var tam = byId[String(r.id)];
            return tam ? Object.assign({}, r, tam) : r;
        });
    }

    function rastgeleSec(dizi, adet) {
        var a = Array.isArray(dizi) ? dizi.slice() : [];
        var n = Math.min(adet || 5, a.length);
        if (!n) return [];
        var i, j, t;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a.slice(0, n);
    }

    /** Yayında arşivden rastgele 5 (yeni gün hikâyesi yokken anasayfa). */
    async function indexRastgele5Getir() {
        var havuz = await indexItirafHavuzGetir();
        return rastgeleSec(havuz, 5);
    }

    /** Anasayfa — bugünün 5'i; takvim gününde yayın yoksa arşivden rastgele 5. */
    async function indexBugunun5Getir() {
        var sb = getClient();
        if (!sb) return [];

        try {
            var rpcRes = await sb.rpc('index_bugunun5_getir');
            if (!rpcRes.error && rpcRes.data != null) {
                var rpcRows = rpcSatirlarCoz(rpcRes.data);
                if (rpcRows.length) return indexSatirlarBaslikZenginlestir(rpcRows);
            }
        } catch (eRpc) { /* RPC yoksa istemci yedeği */ }

        var bugun = istanbulYmdSimdi();
        if (!bugun) return [];

        if (await bugunTakvimYayindaVarMi()) {
            return indexSatirlarBaslikZenginlestir(await baskiGunHikayeleriGetir(bugun, 5));
        }

        return indexSatirlarBaslikZenginlestir(await indexRastgele5Getir());
    }

    async function masterBugun5SiraKaydet(hikayeIds) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var ids = Array.isArray(hikayeIds) ? hikayeIds : [];
        var clean = ids.map(function (id) { return parseInt(id, 10); }).filter(function (n) { return isFinite(n) && n > 0; });
        var res = await sb.rpc('master_bugun5_sira_kaydet', { p_hikaye_ids: clean });
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Sıra kaydedilemedi.');
        }
        return data;
    }

    async function masterBugun5SiraSifirla() {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb.rpc('master_bugun5_sira_sifirla');
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Sıra sıfırlanamadı.');
        }
        return data;
    }

    /** Anasayfa — aktif baskıdan önceki günün en fazla 5 hikâyesi. */
    async function indexDunun5Getir() {
        var sb = getClient();
        if (!sb) return [];

        try {
            var rpcRes = await sb.rpc('index_dunun5_getir');
            if (!rpcRes.error && rpcRes.data != null) {
                var rpcRows = rpcSatirlarCoz(rpcRes.data);
                if (rpcRows.length) return indexSatirlarBaslikZenginlestir(rpcRows);
            }
        } catch (eRpc) { /* istemci yedeği */ }

        var aktif = await aktifBaskiGunGetir();
        var dun = aktif ? await oncekiBaskiGunGetir(aktif) : null;
        if (!dun) return [];
        return baskiGunHikayeleriGetir(dun, 5);
    }

    /** Ortaya karışık: yayında tüm hikayeler (sayfalı çekim). */
    async function indexItirafHavuzGetir() {
        var sb = getClient();
        if (!sb) return [];
        var tumu = [];
        var off = 0;
        var batch = 200;
        while (true) {
            var res = await indexYayindaFiltre(
                sb
                    .from('itiraflar')
                    .select(INDEX_ITIRAF_SELECT)
                    .order('created_at', { ascending: false })
            ).range(off, off + batch - 1);
            if (res.error) throw res.error;
            var parca = res.data || [];
            if (!parca.length) break;
            tumu = tumu.concat(parca);
            if (parca.length < batch) break;
            off += batch;
        }
        return tumu;
    }

    async function indexAramaGecmisiOneri(q, limit) {
        var sb = getClient();
        if (!sb) return [];
        var metin = String(q || '').trim();
        if (metin.length < 3) return [];
        var lim = Math.min(limit || 6, 8);

        try {
            var rpcRes = await sb.rpc('index_arama_oneri_getir', {
                p_onek: metin,
                p_limit: lim
            });
            if (!rpcRes.error && rpcRes.data != null) {
                return rpcSatirlarCoz(rpcRes.data).map(function (row) {
                    if (typeof row === 'string') return row.trim();
                    if (row && row.terim) return String(row.terim).trim();
                    return '';
                }).filter(function (s) { return s.length >= 3; });
            }
        } catch (eRpc) { /* RPC yoksa boş */ }

        return [];
    }

    async function indexItirafAraOneri(q, limit) {
        return indexAramaGecmisiOneri(q, limit);
    }

    async function indexItirafAra(q, offset, limit) {
        var sb = getClient();
        if (!sb) return [];
        var metin = String(q || '').trim();
        if (metin.length < 3) return [];
        var lim = limit || INDEX_SAYFA_BOYUT;
        var off = offset || 0;

        try {
            var rpcRes = await sb.rpc('index_itiraf_ara', {
                p_q: metin,
                p_offset: off,
                p_limit: lim
            });
            if (!rpcRes.error && rpcRes.data != null) {
                var rpcRows = rpcRes.data;
                if (typeof rpcRows === 'string') {
                    try { rpcRows = JSON.parse(rpcRows); } catch (eParse) { rpcRows = []; }
                }
                if (Array.isArray(rpcRows)) return rpcRows;
            }
        } catch (eRpc) { /* RPC yoksa ilike yedek */ }

        var p = '%' + metin.replace(/[%_\\]/g, '') + '%';
        var res = await indexYayindaFiltre(
            sb
                .from('itiraflar')
                .select(INDEX_ITIRAF_SELECT)
                .or(
                    'username.ilike.' + p +
                    ',baslik.ilike.' + p +
                    ',content_full.ilike.' + p +
                    ',content_short.ilike.' + p +
                    ',yasadigi_yer.ilike.' + p +
                    ',city.ilike.' + p
                )
        )
            .order('created_at', { ascending: false })
            .range(off, off + lim - 1);
        if (res.error) throw res.error;
        return res.data || [];
    }


    function hikayeAraSonucParse(sonuc) {
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

    async function hikayeAra(q, status, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var metin = String(q || '').trim();
        var st = status === 'podyum' ? 'podyum' : 'kulis';
        var lim = limit || 50;

        var res = await rpcIlk(['itiraf_ara', 'hikaye_ara'], {
            p_q: metin,
            p_status: st,
            p_limit: lim
        });

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

        var rows = hikayeAraSonucParse(data.sonuc);
        var i;
        for (i = 0; i < rows.length; i++) {
            if (rows[i].cevap_sayisi == null) rows[i].cevap_sayisi = 0;
        }

        try {
            rows = await hikayeSatirlariProfilZenginlestir(rows);
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
        var rows = podyumKartlariSirala(await hikayeSatirlariProfilZenginlestir(res.data || []));
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

    async function masterRpcCagir(fn, body, opts) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var o = opts || {};
        var timeoutMs = o.timeoutMs != null ? o.timeoutMs : 20000;
        ++masterRpcBilet;

        var rpcPromise = sb.rpc(fn, { p_body: body || {} });
        var res;
        if (timeoutMs > 0) {
            var sn = Math.max(1, Math.round(timeoutMs / 1000));
            var timeoutPromise = new Promise(function (_, reject) {
                setTimeout(function () {
                    reject(new Error('Sunucu yanıt vermedi (' + sn + ' sn). Sayfayı yenileyip tekrar dene.'));
                }, timeoutMs);
            });
            res = await Promise.race([rpcPromise, timeoutPromise]);
        } else {
            res = await rpcPromise;
        }

        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { /* ham string */ }
        }
        return data;
    }

    async function masterRpc(fn, body, opts) {
        await authHazir();
        return masterRpcCagir(fn, body, opts);
    }

    async function masterDurum() {
        var sb = getClient();
        if (!sb) return { master: false };
        try {
            await authHazir();
        } catch (eAuth) {
            return { master: false };
        }
        var res = await sb.rpc('master_durum');
        if (res.error) return { master: false };
        return res.data || { master: false };
    }

    async function masterHikayeYayinTarihiYerel(b) {
        await init();
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var id = b.itiraf_id != null ? b.itiraf_id : b.hikaye_id;
        if (!id) throw new Error('Hikaye id gerekli');
        var iso = planliTarihIso(b.created_at);
        if (!iso) {
            throw new Error('Yayın tarihi geçersiz. Tarih/saat alanını temizleyip tekrar seçin.');
        }
        var res = await supabaseRace(
            sb.from('itiraflar').update({ created_at: iso }).eq('id', id)
                .select('id,status,is_gizli,silindi_at,up_votes,down_votes,content_full,content_short,baslik,username,age,gender,yasadigi_yer,yurtdisi_sehir,created_at')
                .single(),
            12000,
            'Yayın tarihi kaydı zaman aşımına uğradı (12 sn). Tekrar dene.'
        );
        if (res.error) throw res.error;
        return { ok: true, hikaye: res.data };
    }

    async function masterHikayeIslem(body) {
        await init();
        var b = Object.assign({}, body || {});
        if (b.itiraf_id == null && b.hikaye_id != null) {
            b.itiraf_id = b.hikaye_id;
        }
        delete b.hikaye_id;
        if (b.content_full != null) {
            b.content_full = metinPerdele(String(b.content_full).replace(/^\s+|\s+$/g, ''));
        }
        var islem = String(b.islem || '').toLowerCase();
        if (islem === 'yayin_tarihi' && b.created_at != null) {
            var planIso = planliTarihIso(b.created_at);
            if (!planIso) {
                throw new Error('Yayın tarihi geçersiz. Tarih/saat alanını temizleyip tekrar seçin.');
            }
            b.created_at = planIso;
        }
        try {
            var sonuc = await masterRpc('master_hikaye_islem', b, { timeoutMs: 15000 });
            if (sonuc && sonuc.ok === false && islem === 'yayin_tarihi') {
                var h = String(sonuc.hata || '').toLowerCase();
                if (h.indexOf('bilinmeyen') >= 0) {
                    return masterHikayeYayinTarihiYerel(b);
                }
            }
            return sonuc;
        } catch (e) {
            if (islem === 'yayin_tarihi') {
                return masterHikayeYayinTarihiYerel(b);
            }
            throw e;
        }
    }

    async function supabaseRace(promise, timeoutMs, mesaj) {
        var ms = timeoutMs != null ? timeoutMs : 12000;
        var timeoutPromise = new Promise(function (_, reject) {
            setTimeout(function () {
                reject(new Error(mesaj || 'Sunucu yanıt vermedi. Tekrar dene.'));
            }, ms);
        });
        return Promise.race([promise, timeoutPromise]);
    }

    async function masterHikayeEkle(body) {
        await init();
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        await authHazir();

        var durum = await masterDurum();
        if (!durum || !durum.master) {
            throw new Error('Bu işlem yalnızca site yöneticisi içindir.');
        }

        var b = Object.assign({}, body || {});

        var rumuz = String(b.username || '').replace(/^\s+|\s+$/g, '');
        if (rumuz.length < 2) throw new Error('Rumuz en az 2 karakter olmalı.');

        var yas = parseInt(b.age, 10);
        if (!yas || yas < 18 || yas > 120) throw new Error('Yaş 18–120 arasında olmalı.');

        var cinsiyet = String(b.gender || '').toLowerCase();
        if (cinsiyet !== 'male' && cinsiyet !== 'female') throw new Error('Geçersiz cinsiyet.');

        var tam = metinPerdele(String(b.content_full || '').replace(/^\s+|\s+$/g, ''));
        if (!tam) throw new Error('Hikaye metni boş olamaz.');

        var baslikMetin = b.baslik != null ? String(b.baslik).replace(/^\s+|\s+$/g, '') : '';
        if (baslikMetin.length > 120) throw new Error('Başlık en fazla 120 karakter olabilir.');

        var slugHint = b.slug_hint != null ? String(b.slug_hint).replace(/^\s+|\s+$/g, '') : '';
        if (slugHint.length > 80) throw new Error('URL adı en fazla 80 karakter olabilir.');

        var yer = b.yasadigi_yer != null ? String(b.yasadigi_yer).replace(/^\s+|\s+$/g, '') : '';
        var yurtdisi = b.yurtdisi_sehir != null ? String(b.yurtdisi_sehir).replace(/^\s+|\s+$/g, '') : '';
        if (yer !== 'yurtdisi') yurtdisi = '';

        var kisa = tam.length <= 140 ? tam : tam.slice(0, 137) + '...';

        var kayit = {
            user_id: null,
            username: rumuz,
            age: yas,
            gender: cinsiyet,
            yasadigi_yer: yer || null,
            yurtdisi_sehir: yurtdisi || null,
            content_full: tam,
            content_short: kisa,
            status: 'kulis',
            is_gizli: false
        };
        if (baslikMetin) kayit.baslik = baslikMetin;
        if (slugHint) kayit.slug_hint = slugHint;

        var planIso = null;
        if (b.created_at != null && String(b.created_at).replace(/^\s+|\s+$/g, '') !== '') {
            planIso = planliTarihIso(b.created_at);
            if (!planIso) {
                throw new Error('Yayın tarihi geçersiz. Tarih/saat alanını temizleyip tekrar seçin.');
            }
            kayit.created_at = planIso;
        }

        var rpcBody = {
            username: rumuz,
            age: yas,
            gender: cinsiyet,
            yasadigi_yer: yer || null,
            yurtdisi_sehir: yurtdisi || null,
            content_full: tam
        };
        if (baslikMetin) rpcBody.baslik = baslikMetin;
        if (slugHint) rpcBody.slug_hint = slugHint;
        if (planIso) rpcBody.created_at = planIso;

        /* Planlı: yalnızca RPC — PostgREST insert+created_at bazı kurulumlarda yanıt vermiyor. */
        if (planIso) {
            var rpcPlan = await masterRpc('master_hikaye_ekle', rpcBody, { timeoutMs: 20000 });
            if (rpcPlan && rpcPlan.ok === true) return rpcPlan;
            if (rpcPlan && rpcPlan.ok === false) {
                throw new Error(rpcPlan.hata || 'Kayıt başarısız');
            }
            if (rpcPlan && rpcPlan.hikaye) return { ok: true, hikaye: rpcPlan.hikaye };
            throw new Error(
                'Planlı hikaye kaydı başarısız. Supabase SQL Editor\'da supabase/itiraf-hikaye-yaz-kurulum.sql dosyasını çalıştırın.'
            );
        }

        try {
            var rpcSonuc = await masterRpc('master_hikaye_ekle', rpcBody, { timeoutMs: 15000 });
            if (rpcSonuc && rpcSonuc.ok === true) return rpcSonuc;
            if (rpcSonuc && rpcSonuc.ok === false) {
                throw new Error(rpcSonuc.hata || 'Kayıt başarısız');
            }
            if (rpcSonuc && rpcSonuc.hikaye) return { ok: true, hikaye: rpcSonuc.hikaye };
        } catch (rpcErr) {
            var kod = rpcErr && rpcErr.code;
            if (kod && kod !== 'PGRST202' && kod !== '42501' && String(rpcErr.message || '').indexOf('yanıt vermedi') < 0) {
                throw rpcErr;
            }
        }

        var res = await supabaseRace(
            sb.from('itiraflar').insert(kayit).select('*').single(),
            12000,
            'Kayıt zaman aşımına uğradı (12 sn). Tekrar dene.'
        );
        if (res.error) throw res.error;

        return { ok: true, hikaye: res.data };
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

    var KAMIKAZE_ARA_SELECT =
        'id,status,username,baslik,slug,slug_hint,age,gender,yasadigi_yer,yurtdisi_sehir,is_gizli,silindi_at,' +
        'up_votes,down_votes,tekil_goruntulenme,sayfa_goruntulenme,podyum_donem,podyum_sira,created_at,content_full,content_short';

    function kamikazeSatirdaBaslikAlaniYok(row) {
        return !!(row && !Object.prototype.hasOwnProperty.call(row, 'baslik'));
    }

    function kamikazeSatirOnizleme(r) {
        var k = Object.assign({}, r);
        k.onizleme = String(k.content_full || k.content_short || '').slice(0, 120);
        return k;
    }

    async function masterKamikazePanelYerel(limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var lim = limit || 150;
        var res = await sb
            .from('itiraflar')
            .select(KAMIKAZE_ARA_SELECT)
            .order('created_at', { ascending: false })
            .limit(lim);
        if (res.error) throw res.error;
        return {
            ok: true,
            son_hikayeler: (res.data || []).map(kamikazeSatirOnizleme)
        };
    }

    function kamikazeGunAraligi(tarihKey) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tarihKey || ''));
        if (!m) return null;
        var y = parseInt(m[1], 10);
        var mo = parseInt(m[2], 10);
        var d = parseInt(m[3], 10);
        var sonraki = new Date(y, mo - 1, d + 1);
        return {
            bas: m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00+03:00',
            bit: sonraki.getFullYear() + '-' + ikiHanePlan(sonraki.getMonth() + 1) + '-' +
                ikiHanePlan(sonraki.getDate()) + 'T00:00:00+03:00'
        };
    }

    function kamikazeAyAraligi(yil, ay) {
        var y = parseInt(yil, 10);
        var mo = parseInt(ay, 10);
        if (!y || !mo || mo < 1 || mo > 12) return null;
        var bitY = mo === 12 ? y + 1 : y;
        var bitM = mo === 12 ? 1 : mo + 1;
        return {
            bas: yil + '-' + ay + '-01T00:00:00+03:00',
            bit: bitY + '-' + ikiHanePlan(bitM) + '-01T00:00:00+03:00'
        };
    }

    function kamikazeYilAraligi(yil) {
        var y = parseInt(yil, 10);
        if (!y) return null;
        return {
            bas: yil + '-01-01T00:00:00+03:00',
            bit: (y + 1) + '-01-01T00:00:00+03:00'
        };
    }

    function kamikazeTarihAraligi(opts) {
        var o = opts || {};
        if (o.tarih) return kamikazeGunAraligi(o.tarih);
        if (o.yil && o.ay && o.gun) {
            return kamikazeGunAraligi(o.yil + '-' + o.ay + '-' + o.gun);
        }
        if (o.yil && o.ay) return kamikazeAyAraligi(o.yil, o.ay);
        if (o.yil) return kamikazeYilAraligi(o.yil);
        return null;
    }

    function kamikazeGunAnahtar(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            var p = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Istanbul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(d);
            return p;
        } catch (e) {
            return '';
        }
    }

    async function masterKamikazeTarihlerYerel() {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb
            .from('itiraflar')
            .select('created_at')
            .not('created_at', 'is', null)
            .order('created_at', { ascending: false })
            .limit(8000);
        if (res.error) throw res.error;
        var seen = {};
        var gunler = [];
        (res.data || []).forEach(function (row) {
            var key = kamikazeGunAnahtar(row.created_at);
            if (!key || seen[key]) return;
            seen[key] = true;
            gunler.push(key);
        });
        gunler.sort(function (a, b) { return a < b ? 1 : a > b ? -1 : 0; });
        return { ok: true, tarihler: gunler };
    }

    async function masterKamikazeTarihler() {
        await init();
        var sb = getClient();
        if (!sb) return { ok: false, hata: 'Supabase yapılandırılmadı.' };
        try {
            await authHazir();
            var res = await sb.rpc('master_kamikaze_tarihler');
            if (!res.error && res.data && res.data.ok) {
                var liste = res.data.tarihler || [];
                return {
                    ok: true,
                    tarihler: liste.map(function (g) {
                        if (typeof g === 'string') return g.slice(0, 10);
                        return kamikazeGunAnahtar(g);
                    }).filter(Boolean)
                };
            }
        } catch (eRpc) { /* yerel yedek */ }
        return masterKamikazeTarihlerYerel();
    }

    /** Durum / tarih / sıra — panel yalnızca son N kayıt döndürdüğü için filtrede tam liste REST ile. */
    async function masterKamikazeListe(filtre, limit, opts) {
        await init();
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var o = opts || {};
        var kod = filtre || 'hepsi';
        var tarihVar = !!(o.tarih || o.yil);
        var lim = limit || (tarihVar ? 500 : (kod === 'index' ? 250 : kod === 'podyum' ? 200 : 150));
        var simdi = new Date().toISOString();
        var q = sb.from('itiraflar').select(KAMIKAZE_ARA_SELECT);
        var aralik = kamikazeTarihAraligi(o);

        if (aralik) {
            q = q.gte('created_at', aralik.bas).lt('created_at', aralik.bit);
        }

        if (kod === 'silinen') {
            q = q.or('silindi_at.not.is.null,status.eq.silindi');
        } else if (kod !== 'hepsi') {
            q = q.is('silindi_at', null).neq('status', 'silindi');
            if (kod === 'podyum') {
                q = q.eq('status', 'podyum');
            } else if (kod === 'gizli') {
                q = q.eq('is_gizli', true);
            } else if (kod === 'planli') {
                q = q.eq('status', 'kulis').gt('created_at', simdi);
            } else if (kod === 'index') {
                q = q
                    .neq('status', 'podyum')
                    .or('is_gizli.is.null,is_gizli.eq.false')
                    .lte('created_at', simdi);
            }
        }

        var asc = o.sira === 'asc';
        var res = await q.order('created_at', { ascending: asc }).limit(lim);
        if (res.error) throw res.error;
        return {
            ok: true,
            filtre: kod,
            tarih: o.tarih || null,
            sira: asc ? 'asc' : 'desc',
            hikayeler: (res.data || []).map(kamikazeSatirOnizleme)
        };
    }

    async function masterKamikazePanel() {
        await init();
        var sb = getClient();
        if (!sb) return { ok: false, hata: 'Supabase yapılandırılmadı.' };
        try {
            await authHazir();
        } catch (eAuth) {
            return { ok: false, hata: 'Oturum hazır değil. /bulut sayfasından tekrar giriş yap.' };
        }
        var res = await sb.rpc('master_kamikaze_panel');
        if (res.error) throw res.error;
        var data = res.data || { ok: false };
        var liste = data && data.son_hikayeler;
        if (data.ok && Array.isArray(liste) && liste.some(kamikazeSatirdaBaslikAlaniYok)) {
            try {
                var fb = await masterKamikazePanelYerel(150);
                if (fb.ok) data.son_hikayeler = fb.son_hikayeler;
            } catch (eFb) { /* RPC listesi kalsın */ }
        }
        return data;
    }

    async function masterKamikazeAra(q, limit) {
        await init();
        var lim = limit || 40;
        try {
            var sonuc = await masterRpc('master_kamikaze_ara', {
                q: q != null ? q : '',
                limit: lim
            }, { timeoutMs: 12000 });
            if (sonuc && sonuc.ok === false) {
                return masterKamikazeAraYerel(q, lim);
            }
            if (sonuc && sonuc.ok && Array.isArray(sonuc.hikayeler) &&
                    sonuc.hikayeler.some(kamikazeSatirdaBaslikAlaniYok)) {
                return masterKamikazeAraYerel(q, lim);
            }
            return sonuc;
        } catch (e) {
            return masterKamikazeAraYerel(q, lim);
        }
    }

    /** RPC yok/hata — doğrudan REST (RLS select all; ~100 hikaye için yeterli). */
    async function masterKamikazeAraYerel(q, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var raw = String(q != null ? q : '').trim();
        var lim = limit || 40;
        if (!raw) {
            return { ok: true, q: '', hikayeler: [], sayilar: { hikayeler: 0 } };
        }
        if (raw.length < 2 && !/^[0-9]+$/.test(raw)) {
            return { ok: false, hata: 'en az 2 karakter' };
        }
        var rows;
        if (/^[0-9]+$/.test(raw)) {
            var idRes = await sb.from('itiraflar').select(KAMIKAZE_ARA_SELECT).eq('id', parseInt(raw, 10)).limit(1);
            if (idRes.error) throw idRes.error;
            rows = idRes.data || [];
        } else {
            var p = '%' + raw.replace(/[%_\\]/g, '') + '%';
            var res = await sb
                .from('itiraflar')
                .select(KAMIKAZE_ARA_SELECT)
                .or(
                    'username.ilike.' + p +
                    ',baslik.ilike.' + p +
                    ',content_full.ilike.' + p +
                    ',content_short.ilike.' + p
                )
                .order('created_at', { ascending: false })
                .limit(lim);
            if (res.error) throw res.error;
            rows = res.data || [];
        }
        rows = rows.map(function (r) {
            var k = Object.assign({}, r);
            k.onizleme = String(k.content_full || k.content_short || '').slice(0, 200);
            return k;
        });
        return { ok: true, q: raw, hikayeler: rows, sayilar: { hikayeler: rows.length } };
    }

    async function masterKamikazeHikayeDetay(hikayeId) {
        await init();
        var id = parseInt(hikayeId, 10);
        if (!id) {
            return { ok: false, hata: 'hikaye_id gerekli' };
        }
        var sonuc = await masterRpc('master_kamikaze_hikaye_detay', { hikaye_id: id });
        if (sonuc && sonuc.ok && sonuc.hikaye && kamikazeSatirdaBaslikAlaniYok(sonuc.hikaye)) {
            var sb = getClient();
            if (sb) {
                var det = await sb.from('itiraflar').select(KAMIKAZE_ARA_SELECT).eq('id', id).maybeSingle();
                if (!det.error && det.data) {
                    sonuc.hikaye = Object.assign({}, sonuc.hikaye, det.data);
                }
            }
        }
        return sonuc;
    }

    async function masterOyIslem(body) {
        var b = Object.assign({}, body || {});
        if (b.hikaye_id == null && b.itiraf_id != null) {
            b.hikaye_id = b.itiraf_id;
        }
        delete b.itiraf_id;
        return masterRpc('master_oy_islem', b);
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

    async function hikayeGuncelle(hikayeId, metin) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Hikaye düzenlemek için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var id = parseInt(hikayeId, 10);
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
        return (await hikayeSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function profilHikayelerim() {
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

    async function hikayeGonder(metin, gizli, baslik) {
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

        var baslikMetin = String(baslik || '').replace(/^\s+|\s+$/g, '');
        if (baslikMetin.length > 120) throw new Error('Başlık en fazla 120 karakter olabilir.');

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
        if (baslikMetin) kayit.baslik = baslikMetin;

        var res = await sb.from('itiraflar').insert(kayit).select().single();

        if (res.error) throw res.error;
        return (await hikayeSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function sikayetGonder(hikayeId, sebep, aciklama) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Şikayet göndermek için giriş yapmalısın.');

        var id = parseInt(hikayeId, 10);
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

    async function hikayeGetir(id) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var nid = parseInt(id, 10);
        if (!nid) throw new Error('Geçersiz hikaye.');
        var res = await sb.from('itiraflar').select('*').eq('id', nid).maybeSingle();
        if (res.error) throw res.error;
        if (!res.data) return null;
        return (await hikayeSatirlariProfilZenginlestir([res.data]))[0];
    }

    async function kokCevapSayilari(hikayeIds) {
        var map = {};
        var i;
        if (!hikayeIds || !hikayeIds.length) return map;
        var sb = getClient();
        if (!sb) return map;
        var ids = [];
        for (i = 0; i < hikayeIds.length; i++) {
            var nid = parseInt(hikayeIds[i], 10);
            if (nid) ids.push(nid);
        }
        if (!ids.length) return map;

        try {
            var rpc = await rpcIlk(['itiraf_cevap_sayilari', 'hikaye_cevap_sayilari'], { p_ids: ids });
            if (rpc.data && rpc.data.length) {
                for (i = 0; i < rpc.data.length; i++) {
                    var row = rpc.data[i];
                    map[String(row.itiraf_id != null ? row.itiraf_id : row.hikaye_id)] = row.adet != null ? row.adet : 0;
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

    async function hikayeYorumToplam(hikayeId) {
        var sb = getClient();
        if (!sb) return 0;
        var nid = parseInt(hikayeId, 10);
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

    async function kokCevaplariListele(hikayeId, offset, limit) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var nid = parseInt(hikayeId, 10);
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

    async function kokCevapToplam(hikayeId) {
        var sb = getClient();
        if (!sb) return 0;
        var nid = parseInt(hikayeId, 10);
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

    async function cevapGonder(hikayeId, metin, parentCevapId) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Yanıt yazmak için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var nid = parseInt(hikayeId, 10);
        var icerik = metinPerdele(String(metin || '').replace(/^\s+|\s+$/g, ''));
        if (!icerik) throw new Error('Metin boş olamaz.');
        if (icerik.length > 2000) throw new Error('En fazla 2000 karakter yazabilirsin.');

        var hikayeRes = await sb.from('itiraflar').select('id, user_id').eq('id', nid).maybeSingle();
        if (hikayeRes.error) throw hikayeRes.error;
        if (!hikayeRes.data) throw new Error('Hikaye bulunamadı.');

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
            hikayeRes.data.user_id &&
            u.id === hikayeRes.data.user_id
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

    function oyVerSonucParse(data, oy) {
        var satir = data;
        if (typeof satir === 'string') {
            try {
                satir = JSON.parse(satir);
            } catch (e) {
                satir = null;
            }
        }
        if (!satir) {
            throw new Error('Oy yanıtı okunamadı');
        }
        return Object.assign({}, satir, {
            oy: satir.oy != null ? satir.oy : oy,
            zaten_oyladin: !!satir.zaten_oyladin
        });
    }

    async function oyVerRpcDene(id, oy) {
        var sb = getClient();
        var key = getViewerKey();
        var denemeler = [
            {
                ad: 'itiraf_oy_ver',
                p: { p_itiraf_id: id, p_oy: oy, p_viewer_key: key }
            },
            {
                ad: 'oy_ver',
                p: { p_hikaye_id: id, p_oy: oy, p_viewer_key: key }
            },
            {
                ad: 'oy_ver',
                p: { p_itiraf_id: id, p_oy: oy, p_viewer_key: key }
            }
        ];
        var i;
        var res;
        var sonHata = null;
        for (i = 0; i < denemeler.length; i++) {
            res = await sb.rpc(denemeler[i].ad, denemeler[i].p);
            if (!res.error) {
                return oyVerSonucParse(res.data, oy);
            }
            sonHata = res.error;
            if (res.error.code !== 'PGRST202') {
                throw res.error;
            }
        }
        throw sonHata || new Error('Oy RPC bulunamadı (itiraf-oy-ver-rpc.sql çalıştırın)');
    }

    async function oyVer(hikayeId, oy) {
        if (!getClient()) throw new Error('Supabase yapılandırılmadı.');

        var id = parseInt(hikayeId, 10);
        if (!id) throw new Error('Geçersiz hikaye.');
        oy = oy === 1 ? 1 : -1;

        return oyVerRpcDene(id, oy);
    }

    var OY_DURUM_PREFIX = 'g5_voted_';

    function oyTipiNormalize(oy) {
        if (oy === 1 || oy === 'up') return 'up';
        if (oy === -1 || oy === 'down') return 'down';
        return null;
    }

    function oyDurumuOku(id) {
        var sid = String(id);
        try {
            var v = global.localStorage.getItem(OY_DURUM_PREFIX + sid);
            if (v === 'up' || v === 'down') return v;
            var eski = global.localStorage.getItem('g5_index_voted_' + sid);
            if (eski === 'up' || eski === 'down') {
                oyDurumuKaydet(sid, eski);
                return eski;
            }
        } catch (e) { /* sessiz */ }
        return null;
    }

    function oyDurumuKaydet(id, oy) {
        var tip = oyTipiNormalize(oy);
        if (!tip) return;
        try {
            global.localStorage.setItem(OY_DURUM_PREFIX + String(id), tip);
        } catch (e) { /* sessiz */ }
    }

    async function oyDurumuSunucudan(id) {
        var sb = getClient();
        if (!sb) return null;
        var nid = parseInt(id, 10);
        if (!nid) return null;

        var res = await sb.rpc('itiraf_oy_durum', {
            p_itiraf_id: nid,
            p_viewer_key: getViewerKey()
        });
        if (res.error) return oyDurumuOku(nid);

        var ham = res.data;
        if (typeof ham === 'string') {
            try {
                ham = JSON.parse(ham);
            } catch (eParse) {
                ham = null;
            }
        }
        var oy = ham && ham.oy != null ? parseInt(ham.oy, 10) : null;
        if (oy === 1 || oy === -1) {
            oyDurumuKaydet(nid, oy);
            return oy === 1 ? 'up' : 'down';
        }
        return null;
    }

    async function oyDurumlariSenkron(ids) {
        var out = {};
        var bekleyen = [];
        var i;
        var hamIds = ids || [];
        for (i = 0; i < hamIds.length; i++) {
            var nid = parseInt(hamIds[i], 10);
            if (!nid) continue;
            var yerel = oyDurumuOku(nid);
            if (yerel) {
                out[nid] = yerel;
            } else {
                bekleyen.push(nid);
            }
        }
        await Promise.all(bekleyen.map(async function (nid) {
            var tip = await oyDurumuSunucudan(nid);
            if (tip) out[nid] = tip;
        }));
        return out;
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

    async function analyticsEventKaydet(body) {
        var sb = getClient();
        if (!sb) return null;
        try {
            var res = await sb.rpc('analytics_event_kaydet', { p_body: body || {} });
            if (res.error) return null;
            return res.data;
        } catch (e) {
            return null;
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

    async function masterTrafikIstatistik(gun, haric) {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_trafik_istatistik', {
            p_gun: gun || 30,
            p_haric: haric || 'master'
        });
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function masterMetrikIstatistik(gun, haric) {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_metrik_istatistik', {
            p_gun: gun || 30,
            p_haric: haric || 'master'
        });
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function masterMudavimIstatistik(gun, haric) {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_mudavim_istatistik', {
            p_gun: gun || 30,
            p_haric: haric || 'master'
        });
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function masterGunlukIstatistik(gun, haric) {
        var sb = getClient();
        if (!sb) return { ok: false };
        var res = await sb.rpc('master_gunluk_istatistik', {
            p_gun: gun || 30,
            p_haric: haric || 'master'
        });
        if (res.error) throw res.error;
        return res.data || { ok: false };
    }

    async function masterAramaTerimEkle(terim) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb.rpc('master_arama_terim_ekle', { p_terim: terim });
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Terim eklenemedi.');
        }
        return data;
    }

    async function masterAramaTerimGuncelle(eski, yeni) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb.rpc('master_arama_terim_guncelle', { p_eski: eski, p_yeni: yeni });
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Terim güncellenemedi.');
        }
        return data;
    }

    async function masterAramaTerimSil(terim) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var res = await sb.rpc('master_arama_terim_sil', { p_terim: terim });
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Terim silinemedi.');
        }
        return data;
    }

    async function masterAramaTerimTopluSil(terimler) {
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');
        var liste = Array.isArray(terimler) ? terimler : [];
        var res = await sb.rpc('master_arama_terim_toplu_sil', { p_terimler: liste });
        if (res.error) throw res.error;
        var data = res.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { data = {}; }
        }
        if (!data || !data.ok) {
            throw new Error((data && data.hata) || 'Terimler silinemedi.');
        }
        return data;
    }

    /** @deprecated master_trafik_istatistik + master_metrik_istatistik kullanın */
    async function masterZiyaretIstatistik(gun, haric) {
        return masterTrafikIstatistik(gun, haric);
    }

    function goruntulenmeRpcKapaliMi() {
        try { return sessionStorage.getItem('g5_goruntulenme_rpc') === '0'; }
        catch (e) { return false; }
    }

    function goruntulenmeRpcKapat() {
        try { sessionStorage.setItem('g5_goruntulenme_rpc', '0'); }
        catch (e) { /* */ }
    }

    /** Kart görüntülenmesi — canlı şema: public.itiraflar + itiraf_goruntulenme_kaydet */
    async function goruntulenmeKaydet(itirafId) {
        if (goruntulenmeRpcKapaliMi()) return null;
        var sb = getClient();
        if (!sb) return null;
        var id = parseInt(itirafId, 10);
        if (!id) return null;
        try {
            var res = await sb.rpc('itiraf_goruntulenme_kaydet', {
                p_itiraf_id: id,
                p_viewer_key: getViewerKey()
            });
            if (res.error) {
                var kod = res.error.code || '';
                var msg = String(res.error.message || '');
                if (kod === 'PGRST202' || msg.indexOf('404') >= 0 || msg.indexOf('403') >= 0) {
                    goruntulenmeRpcKapat();
                }
                return null;
            }
            return res.data;
        } catch (e) {
            return null;
        }
    }

    function goruntulenmeMapOlustur(liste) {
        var map = {};
        (liste || []).forEach(function (r) {
            if (!r || r.id == null) return;
            map[r.id] = {
                tekil_goruntulenme: r.tekil_goruntulenme,
                sayfa_goruntulenme: r.sayfa_goruntulenme
            };
        });
        return map;
    }

    /** Master Kamikaze — hikaye görüntülenme (itiraflar + analytics yedek). */
    async function masterHikayeGoruntulenmeToplu(ids) {
        await init();
        var sb = getClient();
        if (!sb) return {};
        var clean = [];
        (ids || []).forEach(function (id) {
            var n = parseInt(id, 10);
            if (n && clean.indexOf(n) < 0) clean.push(n);
        });
        if (!clean.length) return {};

        try {
            var res = await sb.rpc('master_hikaye_goruntulenme_toplu', { p_ids: clean });
            if (!res.error && res.data) {
                return goruntulenmeMapOlustur(res.data);
            }
        } catch (eRpc) { /* RPC yoksa doğrudan oku */ }

        return hikayeGoruntulenmeToplu(clean);
    }

    /** itiraflar.sayfa/tekil_goruntulenme — doğrudan okuma. */
    async function hikayeGoruntulenmeToplu(ids) {
        var sb = getClient();
        if (!sb) return {};
        var clean = [];
        (ids || []).forEach(function (id) {
            var n = parseInt(id, 10);
            if (n && clean.indexOf(n) < 0) clean.push(n);
        });
        if (!clean.length) return {};

        var res = await sb
            .from('itiraflar')
            .select('id,tekil_goruntulenme,sayfa_goruntulenme')
            .in('id', clean);
        if (res.error) throw res.error;
        return goruntulenmeMapOlustur(res.data);
    }

    async function footerGonderRpc(rpcAdi, payload) {
        var sb = getClient();
        if (!sb) return { ok: false, hata: 'Veritabanı yapılandırılmadı.' };
        var body = Object.assign({}, payload || {}, {
            user_agent: (global.navigator && global.navigator.userAgent) || ''
        });
        var res = await sb.rpc(rpcAdi, { p_body: body });
        if (res.error) {
            return { ok: false, hata: hataMesaji(res.error) };
        }
        var data = res.data;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) { /* */ }
        }
        return data || { ok: false, hata: 'Yanıt alınamadı.' };
    }

    async function masterSubmissionsListele(opts) {
        return masterRpc('master_submissions_listele', opts || {});
    }

    async function masterSubmissionIslem(id, action) {
        return masterRpc('master_submission_islem', { id: id, action: action });
    }

    async function masterSubmissionGuncelle(body) {
        return masterRpc('master_submission_guncelle', body || {});
    }

    async function masterSubmissionPlanla(body) {
        return masterRpc('master_submission_planla', body || {});
    }

    async function masterMessagesListele(opts) {
        return masterRpc('master_messages_listele', opts || {});
    }

    async function masterMessageIslem(id, action) {
        return masterRpc('master_message_islem', { id: id, action: action });
    }

    var masterBildirimRtKanal = null;

    async function masterBildirimleriListele(limit) {
        var sb = getClient();
        if (!sb) return [];
        var lim = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
        var res = await sb.rpc('master_bildirimleri_listele', { p_limit: lim });
        if (res.error) throw res.error;
        return res.data || [];
    }

    async function masterBildirimOkunmamisSayisi() {
        var sb = getClient();
        if (!sb) return 0;
        var res = await sb.rpc('master_bildirim_okunmamis_sayisi');
        if (res.error) throw res.error;
        return parseInt(res.data, 10) || 0;
    }

    async function masterBildirimOkundu(bildirimId) {
        var sb = getClient();
        if (!sb) return;
        var id = parseInt(bildirimId, 10);
        if (!id) return;
        var res = await sb.rpc('master_bildirim_okundu', { p_id: id });
        if (res.error) throw res.error;
    }

    async function masterBildirimTumunuOkundu() {
        var sb = getClient();
        if (!sb) return;
        var res = await sb.rpc('master_bildirim_tumunu_okundu');
        if (res.error) throw res.error;
    }

    function masterBildirimAboneligiBaslat(onYeni) {
        var sb = getClient();
        if (!sb) return null;
        if (masterBildirimRtKanal) {
            try {
                sb.removeChannel(masterBildirimRtKanal);
            } catch (e) { /* */ }
        }
        var ch = sb.channel('g5_master_bildirim_' + Date.now());
        ch.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'master_bildirimler' },
            function () {
                if (typeof onYeni === 'function') onYeni();
            }
        );
        ch.subscribe();
        masterBildirimRtKanal = ch;
        return ch;
    }

    function masterBildirimAboneligiKapat() {
        if (!masterBildirimRtKanal) return;
        try {
            var sb = getClient();
            if (sb) sb.removeChannel(masterBildirimRtKanal);
        } catch (e) { /* */ }
        masterBildirimRtKanal = null;
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
            bt: r.baslik || null,
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
            baslik: p.bt || null,
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
    async function podyumSayilariTazeGetir(hikayeIds) {
        var sb = getClient();
        if (!sb || !hikayeIds || !hikayeIds.length) return {};
        var ids = [];
        var i;
        for (i = 0; i < hikayeIds.length; i++) {
            var n = parseInt(hikayeIds[i], 10);
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

    function podyumHibritZamanlanmisCevapTaze(listeEl, hikayeId) {
        var key = String(hikayeId);
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
            (function (hikayeNum) {
                if (!hikayeNum) return;
                var idFiltre = String(hikayeNum);
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
                        podyumHibritZamanlanmisCevapTaze(listeEl, hikayeNum);
                    }
                );
                ch.on(
                    'postgres_changes',
                    { event: 'DELETE', schema: 'public', table: 'itiraf_cevaplar', filter: 'itiraf_id=eq.' + idFiltre },
                    function () {
                        podyumHibritZamanlanmisCevapTaze(listeEl, hikayeNum);
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
            if (global.Gunde5DB.oyDurumlariSenkron && global.Gunde5UI.kartOyDurumuRenklendir) {
                global.Gunde5DB.oyDurumlariSenkron(rows.map(function (r) { return r.id; })).then(function (durum) {
                    rows.forEach(function (r) {
                        var tip = durum[r.id];
                        if (!tip) return;
                        var card = el.querySelector('.card[data-id="' + r.id + '"]');
                        if (card) global.Gunde5UI.kartOyDurumuRenklendir(card, tip);
                    });
                }).catch(function () { /* sessiz */ });
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
        authHazir: authHazir,
        masterPanelHazir: masterPanelHazir,
        oturumHazirBekle: oturumHazirBekle,
        oturumGecerliMi: oturumGecerliMi,
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
        footerGonderRpc: footerGonderRpc,
        masterSubmissionsListele: masterSubmissionsListele,
        masterSubmissionIslem: masterSubmissionIslem,
        masterSubmissionGuncelle: masterSubmissionGuncelle,
        masterSubmissionPlanla: masterSubmissionPlanla,
        masterMessagesListele: masterMessagesListele,
        masterMessageIslem: masterMessageIslem,
        masterBildirimleriListele: masterBildirimleriListele,
        masterBildirimOkunmamisSayisi: masterBildirimOkunmamisSayisi,
        masterBildirimOkundu: masterBildirimOkundu,
        masterBildirimTumunuOkundu: masterBildirimTumunuOkundu,
        masterBildirimAboneligiBaslat: masterBildirimAboneligiBaslat,
        masterBildirimAboneligiKapat: masterBildirimAboneligiKapat,
        kayitOl: kayitOl,
        girisYap: girisYap,
        cikisYap: cikisYap,
        hikayeGonder: hikayeGonder,
        oyVer: oyVer,
        oyDurumuOku: oyDurumuOku,
        oyDurumuKaydet: oyDurumuKaydet,
        oyDurumuSunucudan: oyDurumuSunucudan,
        oyDurumlariSenkron: oyDurumlariSenkron,
        goruntulenmeKaydet: goruntulenmeKaydet,
        hikayeGoruntulenmeToplu: hikayeGoruntulenmeToplu,
        masterHikayeGoruntulenmeToplu: masterHikayeGoruntulenmeToplu,
        ziyaretKaydet: ziyaretKaydet,
        analyticsEventKaydet: analyticsEventKaydet,
        masterTrafikIstatistik: masterTrafikIstatistik,
        masterGunlukIstatistik: masterGunlukIstatistik,
        masterAramaTerimEkle: masterAramaTerimEkle,
        masterAramaTerimGuncelle: masterAramaTerimGuncelle,
        masterAramaTerimSil: masterAramaTerimSil,
        masterAramaTerimTopluSil: masterAramaTerimTopluSil,
        masterMetrikIstatistik: masterMetrikIstatistik,
        masterBugun5SiraKaydet: masterBugun5SiraKaydet,
        masterBugun5SiraSifirla: masterBugun5SiraSifirla,
        masterMudavimIstatistik: masterMudavimIstatistik,
        masterZiyaretIstatistik: masterZiyaretIstatistik,
        getViewerKey: getViewerKey,
        sikayetGonder: sikayetGonder,
        hikayeGetir: hikayeGetir,
        itirafGetir: hikayeGetir,
        itirafGonder: hikayeGonder,
        profilItiraflarim: profilHikayelerim,
        itirafAra: hikayeAra,
        indexItirafListeleSayfa: indexHikayeListeleSayfa,
        indexBugunun5Getir: indexBugunun5Getir,
        indexDunun5Getir: indexDunun5Getir,
        aktifBaskiGunGetir: aktifBaskiGunGetir,
        oncekiBaskiGunGetir: oncekiBaskiGunGetir,
        indexItirafAra: indexItirafAra,
        indexItirafAraOneri: indexItirafAraOneri,
        indexAramaGecmisiOneri: indexAramaGecmisiOneri,
        indexItirafHavuzGetir: indexItirafHavuzGetir,
        INDEX_ITIRAF_SELECT: INDEX_ITIRAF_SELECT,
        kokCevapSayilari: kokCevapSayilari,
        hikayeYorumToplam: hikayeYorumToplam,
        kokCevaplariListele: kokCevaplariListele,
        kokCevapToplam: kokCevapToplam,
        yorumlariListele: yorumlariListele,
        yorumToplam: yorumToplam,
        cevapGonder: cevapGonder,
        CEVAP_SAYFA: CEVAP_SAYFA,
        YORUM_SAYFA: YORUM_SAYFA,
        INDEX_SAYFA_BOYUT: INDEX_SAYFA_BOYUT,
        indexHikayeListeleSayfa: indexHikayeListeleSayfa,
        hikayeAra: hikayeAra,
        podyumBaslikGetir: podyumBaslikGetir,
        podyumDonemleriListele: podyumDonemleriListele,
        podyumDonemKartlari: podyumDonemKartlari,
        podyumListele: podyumListele,
        hikayeSatirlariProfilZenginlestir: hikayeSatirlariProfilZenginlestir,
        profilGuncelle: profilGuncelle,
        avatarYukle: avatarYukle,
        avatarKaldir: avatarKaldir,
        hikayeGuncelle: hikayeGuncelle,
        masterDurum: masterDurum,
        masterHikayeIslem: masterHikayeIslem,
        masterHikayeEkle: masterHikayeEkle,
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
        masterKamikazeListe: masterKamikazeListe,
        masterKamikazeTarihler: masterKamikazeTarihler,
        kamikazeGunAnahtar: kamikazeGunAnahtar,
        masterKamikazeAra: masterKamikazeAra,
        masterKamikazeHikayeDetay: masterKamikazeHikayeDetay,
        masterOyIslem: masterOyIslem,
        profilHikayelerim: profilHikayelerim,
        yuklePodyumListe: yuklePodyumListe,
        podyumHibritCanlandir: podyumHibritCanlandir,
        podyumRealtimeKapat: podyumRealtimeKapat,
        podyumCacheOku: podyumCacheOku,
        podyumCacheYaz: podyumCacheYaz,
        podyumCacheDonemUtc: podyumCacheDonemUtc,
        PODYUM_BANNER_UST_ETIKET: PODYUM_BANNER_UST_ETIKET,
        podyumDonemTarihSatir: podyumDonemTarihSatir,
        podyumDonemAltSatir: podyumDonemAltSatir,
        planliTarihIso: planliTarihIso,
        planliHikayeListele: planliHikayeListele,
        indexYayindaHikayeSay: indexYayindaHikayeSay,
        hataMesaji: hataMesaji
    };

    global.getGunde5User = getGunde5User;

    if (isConfigured() && global.supabase) {
        init().catch(function () { /* ilk oturum yüklemesi */ });
    }
})(window);
