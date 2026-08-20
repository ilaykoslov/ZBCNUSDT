# Dokümantasyon Merkezi

Bu klasör, ZBCNUSDT Sinyal Terminali’nin kurulumu, mimarisi ve teknik analiz katmanı için proje içi referans dokümanlarını içerir.

| Belge | İçerik |
|---|---|
| [Ana README](../README.md) | Projenin amacı, hızlı başlangıç, komutlar ve API özeti |
| [Kurulum ve yapılandırma](SETUP.md) | Ortam değişkenleri, Docker, webhook ve operasyon notları |
| [Mimari](ARCHITECTURE.md) | Veri akışı, sunucu katmanları, WebSocket ve API davranışları |
| [İndikatörler](INDICATORS.md) | Kullanılan teknik göstergeler ve sinyal hesaplama yaklaşımı |
| [Değişiklik günlüğü](CHANGELOG.md) | Sürümler ve önemli geliştirmeler |
| [Katkı rehberi](../CONTRIBUTING.md) | Branch, test, commit ve pull request kuralları |

## Geliştirme akışı

Yerel geliştirme için önce bağımlılıkları kurun, ardından sunucuyu başlatın ve değişiklikleri test edin:

```bash
npm install
npm run dev
npm test
npm run test:full
npm run test:integration
```

Entegrasyon testleri çalışan bir sunucu bekler. Testlerin tamamını tek komutla çalıştırmak için `npm run test:all` kullanılabilir.

## Teknik kaynaklar

- [KuCoin API Documentation](https://www.kucoin.com/docs)
- [CoinGecko API Documentation](https://docs.coingecko.com/)
- [Express.js Documentation](https://expressjs.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

> Dokümantasyon ile kod davranışı arasında fark oluşursa önce testleri ve `config.js` dosyasını kontrol edin; davranış değişikliğini ilgili dokümana da yansıtın.
