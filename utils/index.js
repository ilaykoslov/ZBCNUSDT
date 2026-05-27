// =====================================================
// Yardımcı Modüller - Merkezi İçe Aktarma
// =====================================================

const sendTelegramMessage = require('./webhook').sendTelegramMessage;
const sendDiscordMessage = require('./webhook').sendDiscordMessage;
const sendEmail = require('./webhook').sendEmail;
const sendAlert = require('./webhook').sendAlert;

module.exports = {
    sendTelegramMessage,
    sendDiscordMessage,
    sendEmail,
    sendAlert
};