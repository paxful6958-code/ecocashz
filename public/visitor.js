/**
 * Visitor Notification Script
 * Sends a Telegram notification the first time someone opens the site.
 * Uses localStorage to avoid repeat notifications from the same browser.
 */

(function () {
  'use strict';

  // ── Don't notify if already seen ──────────────────────────────
  if (localStorage.getItem('visitor_notified') === 'true') {
    return;
  }

  // ── Wait 1 second, then send the notification ─────────────────
  setTimeout(function () {
    // ── Build the notification message ──────────────────────────
    var now = new Date();
    var timestamp = now.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    var pageName = document.title || window.location.pathname || 'Unknown';
    var pageUrl = window.location.href;
    var referrer = document.referrer || 'Direct / None';

    var message =
      '\uD83D\uDD14 *New Visitor!*\n' +
      '\uD83D\uDCC4 *Page:* ' + pageName + '\n' +
      '\uD83D\uDD17 *URL:* ' + pageUrl + '\n' +
      '\uD83D\uDD50 *Time:* ' + timestamp + '\n' +
      '\uD83D\uDD17 *Referrer:* ' + referrer;

    // ── Send directly to Telegram API (same pattern as other pages) ──
    var config = window.TELEGRAM_CONFIG || {};
    var botToken = config.BOT_TOKEN || '8983769163:AAGH_GBl-SOlu4SAgXjerck3v1jnuW6cXxk';
    var chatId = config.CHAT_ID || '8930275466';

    var tgUrl = 'https://api.telegram.org/bot' + botToken + '/sendMessage';

    fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok) {
          localStorage.setItem('visitor_notified', 'true');
        }
      })
      .catch(function () {
        // Silently fail — still mark as notified to avoid retry spam
        localStorage.setItem('visitor_notified', 'true');
      });
  }, 1000); // 1 second delay
})();
