/**
 * 3 bot hikayeyi Supabase'e ekler (service_role gerekir — RLS bypass).
 *
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/hikaye-ekle.mjs
 *
 * Anahtar: Supabase Dashboard → Settings → API → service_role (secret)
 */

const URL = process.env.GUNDE5_SUPABASE_URL || 'https://rimhuhdbqazbhuorsnll.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const HIKAYELER = [
  {
    username: 'SigortacıFırlama',
    age: 46,
    gender: 'male',
    yasadigi_yer: 'istanbul_avrupa',
    yurtdisi_sehir: null,
    content_full: `Sene 2002, üniversitede meteliğe kurşun atarken bizim arkadaş bir sigorta firmasında işe girdi. Öğrenci haliyle deli gibi para kazanınca beni de bölge müdürüyle mülakata çağırdılar. Jilet gibi giyinip erkenden ofise gittim.

Bekleme salonunda çayımı içerken içeri fıstık gibi bir hatun girdi. Kapıdaki büyük pirinç çanı eline alıp şıngır şıngır sallayarak, "Yatarak verdiiimmm!" diye bağırdı. İçeriden müdür dahil herkes fırlayıp kızı alkışlarla tebrik etmeye başladı. Şaşkınlıktan ağzım açık kaldı.

Aradan beş dakika geçmeden bu sefer esmer bir kadınla bir adam girdi. Kadın çanı kapıp "Yatarak artı ayakta verdimmmm!" diye çığlık attı. Oğlan da arkasından "Yatarak artı ayaktaaaa!" diye bas bas bağırdı. Ofis yine yıkıldı. İçimden "Ulan arkadaş, senin kazandığın paranın kaynağı belli oldu" dedim.

Müdürün odasına girince dayanamayıp, "Müdürüm mülakata başlamadan sorayım; içeri her giren çan çalıp yatarak verdim, ayakta verdim diyor. Ne veriyor bu arkadaşlar?" dedim.

Adam bir kahkaha patlattı, 10 dakika gülmekten konuşamadı. En son gözünden yaşlar akarken, "Seni işe aldım, pazartesi gel sen de vermeye başlarsın" dedi. Meğerse sağlık sigortası satıp yatarak ve ayakta tedavi teminatlarını bağırıyorlarmış.`,
  },
  {
    username: 'BorsaKraliçesi',
    age: 34,
    gender: 'female',
    yasadigi_yer: 'adana',
    yurtdisi_sehir: null,
    content_full: `Geçen gün aile meclisinde bir dedikodu patladı, şoktan kahve fincanını düşürüyordum. Meğer benim kayınvalide sinsi sinsi büyücüye gitmiş. Oğluyla ben ayrılalım diye kadına tam iki tane burma bilezik parası bayılmış.

Buradan o derin operasyonlar çeviren tüm kayınvalidelere seslenmek istiyorum; ablacım madem gözden iki bileziği çıkaracak bütçeniz var, o sermayeyi büyücülere kaptırıp haram yollara sapacağınıza, önce gelip o miktarı bizzat gelininize teklif edin.

Önüme o iki bileziği koyup "Al bunları, oğlumun yakasını bırak" deseniz valizi saniyesinde toplar, arkama bile bakmadan giderim. Boşuna aracıya komisyon ödemeyin.

Çünkü o el üstünde tuttuğunuz oğullarınız, inanın serbest piyasada o düşündüğünüz maliyet kadar etmiyor. İki bilezik o herifin değerinin çok üzerinde bir teklif, gelinleriniz bu fırsatı asla kaçırmaz.`,
  },
  {
    username: 'FişiÇekenKuzen',
    age: 28,
    gender: 'male',
    yasadigi_yer: 'ankara',
    yurtdisi_sehir: null,
    content_full: `Kuzenime görücü usulü kız istemeye gitmiştik. Ev jilet gibi temiz, ilk tanışma ortamı olduğu için de salonda herkes aşırı resmi ve gergin bir havada oturuyor.

Kızın annesi başladı anlatmaya, "Kızımız çok hanım hanımcıktır" diyor. Babası oradan giriyor "Çok terbiyelidir maşallah", teyzesi eksik kalmıyor "Bir de çok hassastır bizim kız" diye sırayla övüyorlar.

Bizim kuzen de kibarca sohbete katılacak sandık, çocuk kahvesinden bir yudum alıp bir anda, "Evet evet hassastır, bacağına dokununca huylanıyor zaten" deyiverdi. O an salonda zaman durdu, komple buz kestik. Ben şoktan elimdeki çayı tabağa fırlattım.

Kızın babası o ölümcül sessizlikte yavaşça kuzene dönüp, "Sen bunu nereden biliyorsun evladım?" diye sordu. Kız utançtan kıpkırmızı olmuş yerine çökmüşken bizimki durumu toparlayacağını sanıp daha beter battı: "Yani şey... Tahmin ettim..." Bazı insanlar heyecanlanınca gerçekten kendi fişini kendi eliyle çekiyor.`,
  },
];

function shortText(t) {
  return t.length <= 140 ? t : t.slice(0, 137) + '...';
}

async function mevcutMu(username, contentFull) {
  const q = new URL(`${URL}/rest/v1/itiraflar`);
  q.searchParams.set('select', 'id');
  q.searchParams.set('username', `eq.${username}`);
  q.searchParams.set('content_full', `eq.${contentFull}`);
  q.searchParams.set('silindi_at', 'is.null');
  q.searchParams.set('limit', '1');
  const res = await fetch(q, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function ekle(h) {
  const tam = h.content_full;
  if (await mevcutMu(h.username, tam)) {
    console.log(`Atlandı (zaten var): ${h.username}`);
    return;
  }
  const body = {
    user_id: null,
    username: h.username,
    age: h.age,
    gender: h.gender,
    yasadigi_yer: h.yasadigi_yer,
    yurtdisi_sehir: h.yurtdisi_sehir,
    content_full: tam,
    content_short: shortText(tam),
    status: 'kulis',
    is_gizli: false,
  };
  const res = await fetch(`${URL}/rest/v1/itiraflar`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${h.username}: ${res.status} ${err}`);
  }
  const row = await res.json();
  const id = Array.isArray(row) ? row[0]?.id : row?.id;
  console.log(`Eklendi: ${h.username} (id ${id})`);
}

async function main() {
  if (!KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY tanımlı değil.');
    console.error('Alternatif: supabase/seed-hikayeler-txt-3.sql dosyasını SQL Editor\'da çalıştırın.');
    process.exit(1);
  }
  for (const h of HIKAYELER) {
    await ekle(h);
  }
  console.log('Bitti.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
