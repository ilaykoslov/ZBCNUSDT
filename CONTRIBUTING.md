# Katkı Rehberi

ZBCNUSDT Sinyal Terminali’ne katkı göndermeden önce bu rehberdeki geliştirme ve doğrulama adımlarını izleyin.

## Geliştirme ortamı

```bash
git clone https://github.com/ilaykoslov/ZBCNUSDT.git
cd ZBCNUSDT
npm install
npm run dev
```

Geliştirme sırasında yapılandırma değişiklikleri için `.env.example` dosyasını temel alın. API anahtarlarını, webhook URL’lerini veya gerçek işlem bilgilerini kaynak koda ya da commit’lere eklemeyin.

## Branch ve commit kuralları

Yeni çalışmalar için açıklayıcı bir branch adı kullanın:

```bash
git switch -c feat/kisa-aciklama
git switch -c fix/kisa-aciklama
git switch -c docs/kisa-aciklama
```

Commit mesajları Conventional Commits biçiminde olmalıdır:

| Önek | Kullanım |
|---|---|
| `feat:` | Yeni özellik |
| `fix:` | Hata düzeltmesi |
| `refactor:` | Davranışı değiştirmeyen kod düzenlemesi |
| `docs:` | Dokümantasyon değişikliği |
| `test:` | Test ekleme veya düzeltme |
| `chore:` | Araç, bağımlılık veya depo bakımı |

## Test gereksinimleri

Kod değişikliğinden sonra en azından aşağıdaki kontroller çalıştırılmalıdır:

```bash
node --check server.js
npm test
npm run test:full
npm run test:integration
```

Yeni bir API endpoint’i eklenirse entegrasyon testine; yeni bir sinyal alanı eklenirse sinyal şemasına ve ilgili testlere doğrulama ekleyin. Paper-trading testleri kalıcı çalışma zamanı verilerini değiştirebileceği için test ortamı durum dosyalarını gözden geçirin.

## Pull request beklentileri

Pull request açıklaması değişikliğin amacını, kullanıcıya etkisini ve test sonuçlarını açıkça belirtmelidir. UI değişikliklerinde ekran görüntüsü veya kısa doğrulama notu ekleyin. API yanıtı, yapılandırma veya kurulum davranışı değişiyorsa ilgili README ve `docs/` dosyalarını aynı pull request içinde güncelleyin.

Pull request göndermeden önce şu kontroller tamamlanmalıdır:

- Değişiklik yalnızca gerekli dosyaları içeriyor.
- Hassas bilgi veya yerel çalışma zamanı verisi eklenmemiş.
- Sözdizimi, birim ve entegrasyon testleri çalışıyor.
- Dokümantasyon kod davranışıyla uyumlu.
- Commit mesajları açıklayıcı ve tutarlı.

## Güvenlik bildirimi

Güvenlik açığı bulursanız ayrıntıları herkese açık issue olarak paylaşmadan önce depo yöneticisine özel kanaldan bildirin. API anahtarlarını veya kullanıcı verilerini rapora eklemeyin.
