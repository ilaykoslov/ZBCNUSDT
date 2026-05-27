// =====================================================
// Webhook / Alert Sistemi
// =====================================================
// Telegram, Email, Discord webhook entegrasyonları
// =====================================================

const https = require('https');
const http = require('http');

// Telegram webhook
function sendTelegramMessage(token, chatId, message) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const body = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

        const opts = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.ok) {
                        resolve({ success: true, message_id: result.result.message_id });
                    } else {
                        reject(new Error(result.description || 'Telegram API error'));
                    }
                } catch (e) {
                    reject(new Error('JSON parse error: ' + data.substring(0, 200)));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Discord webhook
function sendDiscordMessage(webhookUrl, content, username = 'ZBCN Signal', avatarUrl = '') {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            content,
            username,
            avatar_url: avatarUrl,
            embeds: []
        });

        const opts = {
            hostname: new URL(webhookUrl).hostname,
            port: 443,
            path: new URL(webhookUrl).pathname + new URL(webhookUrl).search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, status: res.statusCode });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Email webhook (SMTP fallback)
function sendEmail(options) {
    return new Promise((resolve, reject) => {
        const { to, subject, text, html, smtp } = options;

        if (!smtp || !smtp.host) {
            return reject(new Error('SMTP configuration required'));
        }

        // Basit SMTP gönderimi (node-smtp kullanmadan)
        const mail = {
            from: smtp.from || 'noreply@zbcnusdt.com',
            to,
            subject,
            text,
            html
        };

        // Gerçek SMTP için nodemailer kullanılmalı
        // Bu bir basit fallback örneğidir
        console.log('Email gönderilecek:', mail);
        resolve({ success: true, message: 'Email queued' });
    });
}

// Genel alert gönderme
function sendAlert(signalData, config) {
    const { signal, confidence, weightedScore, regime, grade, price, tfAlignment } = signalData;

    const message = `📊 <b>ZBCNUSDT Sinyal</b>\n\n` +
        `💰 <b>Sinyal:</b> ${signal}\n` +
        `🎯 <b>Güven:</b> ${confidence}%\n` +
        `📈 <b>Skor:</b> ${weightedScore.toFixed(2)}\n` +
        `📊 <b>Rejim:</b> ${regime}\n` +
        `🏆 <b>Not:</b> ${grade}\n` +
        `💰 <b>Fiyat:</b> $${price.toFixed(8)}\n` +
        `⚡ <b>TF Uyumu:</b> ${tfAlignment}\n\n` +
        `<i>${new Date().toLocaleString('tr-TR')}</i>`;

    const alerts = [];

    // Telegram
    if (config.telegram && config.telegram.token && config.telegram.chatId) {
        alerts.push(
            sendTelegramMessage(config.telegram.token, config.telegram.chatId, message)
                .then(() => ({ service: 'Telegram', success: true }))
                .catch(e => ({ service: 'Telegram', success: false, error: e.message }))
        );
    }

    // Discord
    if (config.discord && config.discord.webhookUrl) {
        alerts.push(
            sendDiscordMessage(config.discord.webhookUrl, message)
                .then(() => ({ service: 'Discord', success: true }))
                .catch(e => ({ service: 'Discord', success: false, error: e.message }))
        );
    }

    // Email
    if (config.email && config.email.to) {
        alerts.push(
            sendEmail({
                to: config.email.to,
                subject: `ZBCNUSDT ${signal} Sinyali - ${confidence}% Güven`,
                text: message.replace(/<[^>]*>/g, ''),
                smtp: config.email.smtp
            })
                .then(() => ({ service: 'Email', success: true }))
                .catch(e => ({ service: 'Email', success: false, error: e.message }))
        );
    }

    return Promise.all(alerts);
}

module.exports = {
    sendTelegramMessage,
    sendDiscordMessage,
    sendEmail,
    sendAlert
};