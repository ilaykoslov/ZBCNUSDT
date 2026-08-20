# USDJPY Sinyal İzleyici

Bu modül, USDJPY mum verisi üzerinde RSI, MACD, Bollinger Bantları, EMA ve Stochastic göstergelerini hesaplayarak **yalnızca sinyal ve paper-trading çıktısı** üretir. Gerçek hesapta otomatik emir gönderimi özellikle uygulanmamıştır; Expert Option için resmi ve yetkilendirilmiş bir API doğrulanmadan giriş bilgisi veya WebSocket otomasyonu eklenmemelidir.

> **Finansal uyarı:** Ben lisanslı bir finansal danışman değilim; bu yazılım yatırım tavsiyesi veya kazanç garantisi değildir. İkili opsiyonlar ve kaldıraçlı işlemler tüm sermayenin kaybına yol açabilir. Önce geçmiş veri ve demo hesapta test edin.

## Kurulum

```bash
cd expert_option_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
cd .. && python3 -m expert_option_bot.main --demo
```

CSV ile çalıştırma:

```bash
cd .. && python3 -m expert_option_bot.main --csv expert_option_bot/data/sample_usdjpy.csv --once
```

CSV biçimi: `timestamp,open,high,low,close,volume`. Canlı veri bağlayıcısı için `api/data_source.py` içinde resmi sağlayıcının dokümante edilmiş istemcisini uygulayın; varsayılan çalışma modu paper-only'dir.

## Sinyal mantığı

Her gösterge `YUKARI`, `AŞAĞI` veya `NÖTR` üretir. En az iki göstergenin aynı yönde olması ve uyum oranının `%60` veya üzerinde bulunması durumunda sinyal gösterilir. Vade, ATR'nin medyanına göre 1, 2 veya 5 dakika olarak seçilir. Stop-loss ve hedef seviyeleri yalnızca eğitim amaçlı referans seviyelerdir.

## Güvenlik

Kimlik bilgilerini `.env` içinde tutun ve depoya göndermeyin. Bu proje gerçek emir fonksiyonu içermez. Resmî API, hizmet şartları ve yerel mevzuat doğrulanmadan otomatik işlem eklemeyin.
