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
            client = global.supabase.createClient(
                global.GUNDE5_SUPABASE_URL,
                global.GUNDE5_SUPABASE_ANON_KEY
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
            medeniDurum: row.medeni_durum || null
        };
    }

    var PROFIL_SELECT = 'id, username, email, gender, dogum_yili, avatar_url, yasadigi_yer, yurtdisi_sehir, meslek, medeni_durum';
    var UYE_KART_SELECT = 'id, username, gender, dogum_yili, avatar_url, yasadigi_yer, yurtdisi_sehir, meslek, medeni_durum';

    function cacheUser(u) {
        cachedUser = u;
        try {
            if (u) localStorage.setItem('gunde5_user', JSON.stringify(u));
            else localStorage.removeItem('gunde5_user');
        } catch (e) { /* sessiz */ }
    }

    async function loadProfile(userId) {
        var sb = getClient();
        if (!sb) return null;
        var res = await sb.from('uye').select(PROFIL_SELECT).eq('id', userId).maybeSingle();
        if (res.error) throw res.error;
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

    function hataMesaji(err) {
        if (!err) return 'Bir hata oluştu.';
        if (err.code === '42501') return 'Profil kaydı için oturum gerekli. Sayfayı yenileyip tekrar dene.';
        if (err.code === '23505') return 'Bu kullanıcı adı veya e-posta zaten kullanılıyor.';
        var msg = err.message || '';
        if (msg.indexOf('avatar_url') >= 0 && (msg.indexOf('column') >= 0 || err.code === 'PGRST204')) {
            return 'Veritabanında avatar_url sütunu yok. Supabase SQL Editor\'da supabase/itiraf-avatar.sql dosyasını çalıştırın.';
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

    async function init() {
        if (!isConfigured()) {
            ready = false;
            return false;
        }
        var sb = getClient();
        if (!sb) return false;

        var sessionRes = await sb.auth.getSession();
        if (sessionRes.data.session) {
            await loadProfile(sessionRes.data.session.user.id);
        } else {
            cacheUser(null);
        }

        sb.auth.onAuthStateChange(async function (event, session) {
            if (session && session.user) {
                await loadProfile(session.user.id);
            } else {
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

        var res = await sb.from('uye').select(UYE_KART_SELECT).in('id', uniq);
        if (res.error) throw res.error;
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
        var yil = parseInt(profil.dogum_yili, 10);
        if (!isNaN(yil)) {
            row.age = new Date().getFullYear() - yil;
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

    async function podyumListele() {
        var sb = getClient();
        if (!sb) return [];
        var res = await sb
            .from('itiraflar')
            .select('*')
            .eq('status', 'podyum')
            .order('podyum_sira', { ascending: true, nullsFirst: false })
            .order('up_votes', { ascending: false })
            .limit(5);
        if (res.error) {
            res = await sb
                .from('itiraflar')
                .select('*')
                .eq('status', 'podyum')
                .order('up_votes', { ascending: false })
                .limit(5);
            if (res.error) throw res.error;
        }
        return itirafSatirlariProfilZenginlestir(res.data || []);
    }

    async function profilGuncelle(alanlar) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Profil güncellemek için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var payload = {};
        if (alanlar.yasadigiYer !== undefined) {
            payload.yasadigi_yer = alanlar.yasadigiYer || null;
        }
        if (alanlar.yurtdisiSehir !== undefined) {
            var ys = String(alanlar.yurtdisiSehir || '').replace(/^\s+|\s+$/g, '');
            payload.yurtdisi_sehir = ys || null;
        }
        if (alanlar.meslek !== undefined) {
            payload.meslek = alanlar.meslek || null;
        }
        if (alanlar.medeniDurum !== undefined) {
            payload.medeni_durum = alanlar.medeniDurum || null;
        }
        if (alanlar.avatarUrl !== undefined) {
            payload.avatar_url = alanlar.avatarUrl || null;
        }

        if (payload.yasadigi_yer && payload.yasadigi_yer !== 'yurtdisi') {
            payload.yurtdisi_sehir = null;
        }
        var res = await sb.from('uye').update(payload).eq('id', u.id).select(PROFIL_SELECT).single();
        if (res.error) throw res.error;
        var guncel = profileToUser(res.data);
        cacheUser(guncel);
        return guncel;
    }

    async function avatarYukle(file) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('Fotoğraf yüklemek için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

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

        var path = u.id + '/avatar.' + ext;
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

    async function itirafGuncelle(itirafId, metin) {
        var u = getGunde5User();
        if (!u || !u.id) throw new Error('İtiraf düzenlemek için giriş yapmalısın.');
        var sb = getClient();
        if (!sb) throw new Error('Supabase yapılandırılmadı.');

        var id = parseInt(itirafId, 10);
        if (!id) throw new Error('Geçersiz itiraf.');

        var tam = String(metin || '').replace(/^\s+|\s+$/g, '');
        if (!tam) throw new Error('Metin boş olamaz.');

        var mevcut = await sb.from('itiraflar').select('id, is_gizli').eq('id', id).eq('user_id', u.id).maybeSingle();
        if (mevcut.error) throw mevcut.error;
        if (!mevcut.data) throw new Error('Bu itirafı düzenleyemezsin.');

        var kisa = tam.length <= 140 ? tam : tam.slice(0, 137) + '...';
        var payload = {
            content_short: kisa,
            content_full: tam
        };

        var res = await sb.from('itiraflar').update(payload).eq('id', id).eq('user_id', u.id).select().single();
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
            throw new Error('İtiraf yazmak için giriş yapmalısın.');
        }
        var u = await loadProfile(sessionRes.data.session.user.id);
        if (!u || !u.id) throw new Error('İtiraf yazmak için giriş yapmalısın.');

        var tam = String(metin).replace(/^\s+|\s+$/g, '');
        if (!tam) throw new Error('Metin boş olamaz.');
        var username = gizli ? 'Gizli Üye' : u.username;
        var kisa = tam.length <= 140 ? tam : tam.slice(0, 137) + '...';

        var kayit = {
            user_id: u.id,
            username: username,
            age: u.age,
            gender: u.gender,
            city: null,
            content_short: kisa,
            content_full: tam,
            status: 'kulis',
            is_gizli: !!gizli
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
                throw new Error('Bu itiraf için zaten şikayet gönderdin.');
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
        if (!nid) throw new Error('Geçersiz itiraf.');
        var res = await sb.from('itiraflar').select('*').eq('id', nid).maybeSingle();
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
        var res = await sb
            .from('itiraf_cevaplar')
            .select('itiraf_id')
            .in('itiraf_id', itirafIds);
        if (res.error) throw res.error;
        var rows = res.data || [];
        for (i = 0; i < rows.length; i++) {
            var iid = String(rows[i].itiraf_id);
            map[iid] = (map[iid] || 0) + 1;
        }
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
        return res.data || [];
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
        return res.data || [];
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
        var icerik = String(metin || '').replace(/^\s+|\s+$/g, '');
        if (!icerik) throw new Error('Metin boş olamaz.');
        if (icerik.length > 2000) throw new Error('En fazla 2000 karakter yazabilirsin.');

        var itirafRes = await sb.from('itiraflar').select('id').eq('id', nid).maybeSingle();
        if (itirafRes.error) throw itirafRes.error;
        if (!itirafRes.data) throw new Error('İtiraf bulunamadı veya süresi dolmuş.');

        var parentId = null;
        if (parentCevapId) {
            var pid = parseInt(parentCevapId, 10);
            var parRes = await sb.from('itiraf_cevaplar').select('id, itiraf_id, parent_id').eq('id', pid).maybeSingle();
            if (parRes.error) throw parRes.error;
            if (!parRes.data) throw new Error('Cevap bulunamadı.');
            if (parRes.data.parent_id) throw new Error('Yalnızca ana cevaplara yanıt yazılabilir.');
            if (parRes.data.itiraf_id !== nid) throw new Error('Geçersiz yanıt.');
            parentId = pid;
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
        return res.data;
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
            var ayniSay = await sb.from('itiraflar').select('up_votes, down_votes').eq('id', id).single();
            if (ayniSay.error) throw ayniSay.error;
            return Object.assign({}, ayniSay.data, { oy: oy });
        }

        var oyRes = await sb.from('itiraf_oylar').upsert(
            { itiraf_id: id, user_id: u.id, oy: oy },
            { onConflict: 'itiraf_id,user_id' }
        );
        if (oyRes.error) throw oyRes.error;

        var sayRes = await sb.from('itiraflar').select('up_votes, down_votes').eq('id', id).single();
        if (sayRes.error) throw sayRes.error;
        return Object.assign({}, sayRes.data, { oy: oy });
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
            if (!rows.length) {
                el.innerHTML = Gunde5UI.bosListe('Kulis şu an boş. İlk itirafı sen yaz!');
                return;
            }
            var i;
            for (i = 0; i < rows.length; i++) {
                el.appendChild(Gunde5UI.renderKulisCard(rows[i]));
            }
            if (global.Gunde5KartCevap) global.Gunde5KartCevap.initSayfa();
        } catch (err) {
            el.innerHTML = Gunde5UI.bosListe(hataMesaji(err));
            Gunde5UI.showToast(hataMesaji(err), 'hata');
        }
    }

    async function yuklePodyumListe(konteynerId) {
        var el = document.getElementById(konteynerId);
        if (!el) return;
        if (!isConfigured()) {
            el.innerHTML = Gunde5UI.bosListe('Supabase bağlantısı kurulmadı. js/gunde5-config.js dosyasını doldurun.');
            return;
        }
        el.innerHTML = '<p class="liste-bos">Yükleniyor…</p>';
        try {
            var baslikEl = document.getElementById('podyumDonemBaslik');
            var sampiyonlarEl = document.getElementById('podyumSampiyonlar');
            var baslik = null;
            try {
                baslik = await podyumBaslikGetir();
            } catch (baslikErr) { /* site_ayar henüz yoksa */ }
            if (!baslik) {
                baslik = '19/05/2026 \u015eampiyonlar\u0131 \u2014 Top 5';
            }
            if (baslikEl) {
                baslikEl.textContent = baslik;
            }
            var rows = await podyumListele();
            var ids = rows.map(function (r) { return r.id; });
            var sayilar = await kokCevapSayilari(ids);
            satirlaraCevapSayisiEkle(rows, sayilar);
            el.innerHTML = '';
            if (!rows.length) {
                if (sampiyonlarEl) {
                    sampiyonlarEl.hidden = true;
                }
                el.innerHTML = Gunde5UI.bosListe('Henüz podyum itirafı yok. Kulis\'te oyları patlat!');
                return;
            }
            if (sampiyonlarEl) {
                sampiyonlarEl.hidden = false;
            }
            var i;
            for (i = 0; i < rows.length; i++) {
                el.appendChild(Gunde5UI.renderPodyumCard(rows[i], i));
            }
            if (global.Gunde5KartCevap) global.Gunde5KartCevap.initSayfa();
        } catch (err) {
            el.innerHTML = Gunde5UI.bosListe(hataMesaji(err));
            Gunde5UI.showToast(hataMesaji(err), 'hata');
        }
    }

    global.Gunde5DB = {
        init: init,
        isConfigured: isConfigured,
        isReady: function () { return ready; },
        getGunde5User: getGunde5User,
        kayitOl: kayitOl,
        girisYap: girisYap,
        cikisYap: cikisYap,
        itirafGonder: itirafGonder,
        oyVer: oyVer,
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
        kulisListeleSayfa: kulisListeleSayfa,
        kulisSayfaHazirla: kulisSayfaHazirla,
        podyumBaslikGetir: podyumBaslikGetir,
        podyumListele: podyumListele,
        itirafSatirlariProfilZenginlestir: itirafSatirlariProfilZenginlestir,
        profilGuncelle: profilGuncelle,
        avatarYukle: avatarYukle,
        avatarKaldir: avatarKaldir,
        itirafGuncelle: itirafGuncelle,
        profilItiraflarim: profilItiraflarim,
        yukleKulisListe: yukleKulisListe,
        yuklePodyumListe: yuklePodyumListe,
        hataMesaji: hataMesaji
    };

    global.getGunde5User = getGunde5User;
})(window);
