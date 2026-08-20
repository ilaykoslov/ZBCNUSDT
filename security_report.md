# Güvenlik ve Sır (Secret) Taraması Raporu

**Depo:** `ilaykoslov/ZBCNUSDT`
**Tarih:** 20 Ağustos 2026

## Yönetici Özeti

Projenizin kaynak kodları, Git geçmişi, yapılandırma şablonları ve bağımlılıkları üzerinde kapsamlı bir güvenlik ve sızıntı taraması gerçekleştirildi. 

**Sonuç:** Sizi tehlikeye sokacak aktif bir API anahtarı, kişisel e-posta adresi, webhook URL'si, veritabanı parolası veya özel token **bulunmamaktadır.** Mevcut güvenlik önlemleriniz (ör. API anahtarlarının koda yazılmayıp `.env` dosyasından okunması) doğru biçimde uygulanmıştır. Ancak bağımlılıklarda tespit edilen zafiyetler onarıldı.

## Tarama Kapsamı ve Bulgular

### 1. Kaynak Kod ve Yapılandırma Dosyaları
- `.env.example`, `config.js` ve `server.js` gibi dosyalar incelendi.
- `KUCOIN_API_KEY`, `TELEGRAM_TOKEN`, `DISCORD_WEBHOOK_URL` gibi değişkenler yalnızca yer tutucu (placeholder) olarak kullanılıyor (örneğin: `your_kucoin_api_key_here`).
- **Durum:** Temiz. Koda gömülü aktif bir sır bulunamadı.

### 2. Git Geçmişi (Gitleaks Taraması)
- Tüm commit geçmişi (`git log --all`) endüstri standardı **Gitleaks** aracı ve manuel regex kalıplarıyla tarandı.
- E-posta adresleri (`@gmail.com`, `@hotmail.com`), AWS anahtarları, veritabanı parolaları veya SSH anahtarları arandı.
- Sadece GitHub Actions dosyasındaki `secrets.GITHUB_TOKEN` değişkenine rastlandı ki bu varsayılan, güvenli bir CI/CD değişkenidir.
- **Durum:** Temiz. Geçmiş commit'lerde sızdırılmış bir sır yok.

### 3. Çalışma Zamanı Verileri (Data Klasörü)
- `data/` klasöründeki `signals_ZBCNUSDT.json` ve `paperTrading_ZBCNUSDT.json` dosyaları incelendi.
- Yalnızca sanal (paper) işlemler, sinyal skorları ve matematiksel çıktılar içeriyor.
- **Durum:** Temiz. Hassas kişisel veya finansal veri içermiyor.

### 4. NPM Bağımlılıkları (Güvenlik Zafiyetleri)
- `npm audit` ile paket zafiyetleri tarandı.
- `body-parser` ve `brace-expansion` paketlerinde Denial of Service (DoS) ve bellek sızıntısına neden olabilecek iki güvenlik açığı (biri Yüksek seviye) tespit edildi.
- **Çözüm:** `npm audit fix` çalıştırılarak bağımlılıklar güvenli sürümlere güncellendi ve bu değişiklik GitHub `main` dalına (commit: `9046756`) gönderildi.

## Sonuç ve Tavsiyeler

Mevcut projeniz güvenlik açısından oldukça sağlıklı durumdadır. Uygulamanızın mevcut güvenlik sınırlarını korumak için aşağıdaki prensiplere uymaya devam ediniz:

1. Kendi yerel bilgisayarınızda veya sunucunuzda oluşturduğunuz `.env` dosyasını hiçbir zaman Git'e eklemeyin (şu an doğru şekilde `.gitignore` içinde).
2. Yeni bir API (ör. Binance, OpenAI) eklediğinizde, anahtarları doğrudan koda yazmak yerine mevcut `process.env` yapısını kullanmaya devam edin.
3. Bağımlılıklarınızı güncel tutmak için periyodik olarak `npm audit` komutunu çalıştırın.
