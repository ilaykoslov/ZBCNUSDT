# ZBCN Özel Sinyal Üretim Algoritması Tasarımı

## Mevcut Durum Analizi
- **Piyasa Rejimi (Market Regime):** ZBCN için saatlik ATR %2.5 - %3.5 aralığında. Mevcut algoritma ATR > %4.5 ise volatilite rejimi, düşükse range rejimi uyguluyor.
- **Microstructure (Orderbook):** Spread %0.2 - %0.4 arasında değişiyor. Emir defteri dengesizliği (Bid/Ask Ratio) hesaplanarak sinyal skoruna ceza/ödül (penalty/bonus) olarak ekleniyor.
- **Geri Besleme (Feedback Loop):** 4 saatlik geleceğe bakılarak Take Profit (%2) veya Stop Loss (%1) üzerinden sinyal başarı oranı hesaplanıyor. Başarı %40'ın altındaysa yeni sinyaller %20 cezalandırılıyor.

## İyileştirme ve Güçlendirme Planı

### 1. Dinamik Eşik Değerleri (Dynamic Thresholds)
Statik %2 TP ve %1 SL yerine, o anki piyasa volatilitesine (ATR) bağlı dinamik hedefler belirlemeliyiz. ZBCN gibi altcoinlerde volatilite çok hızlı değişebilir.
- **TP (Kâr Al):** `Entry Price + (1.5 * ATR)`
- **SL (Zarar Kes):** `Entry Price - (1.0 * ATR)`

### 2. Sinyal Cooldown Mekanizması (Aşırı İşlem Önleme)
ZBCN piyasası yatay (chop) rejimine girdiğinde art arda çok sayıda yanlış sinyal üretebilir.
- **Kural:** Eğer son 3 sinyal arka arkaya "Başarısız" (False Positive/Negative) olarak etiketlenmişse, sistem "Soğuma (Cooldown)" moduna girer.
- Cooldown süresince (örneğin 6 saat) yeni sinyal üretilmez veya sadece `NEUTRAL` döndürülür.

### 3. Orderbook Dengesizliği (Imbalance) İvmesi
Sadece anlık Bid/Ask oranına bakmak yerine, bu oranın değişim ivmesine (Türevine) bakmak, gerçek alıcı/satıcı baskısını daha iyi gösterir.
- Eğer Bid hacmi son 5 dakikada %50 arttıysa, bu anlık bir balina alımına işaret edebilir. Bu duruma özel bonus eklenmelidir.

### 4. Makine Öğrenmesi Benzeri Ağırlık Güncellemesi
Şu anki sistem sadece nihai skoru cezalandırıyor. Hangi kategorinin (Trend, Momentum, Hacim) daha çok hata yaptığını bulup o kategorinin ağırlığını düşürmeliyiz.
- **Örnek:** Başarısız olan son 10 sinyalin çoğunda Momentum skoru çok yüksek ama Hacim skoru düşükse, Momentum'un ağırlığı (categoryWeights) azaltılıp Hacim'in ağırlığı artırılmalıdır.

## Uygulama Adımları
1. `zbcnEngine.js` dosyasına dinamik TP/SL ve Cooldown mantığı eklenecek.
2. Kategori bazlı hata ölçümü (Category-Level Error Tracking) için `zbcn_eval.json` şeması genişletilecek.
3. `server.js`'deki Evaluation Loop, bu yeni dinamik TP/SL ve kategori ağırlıklandırma mantığıyla güncellenecek.
