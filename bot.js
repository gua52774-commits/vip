const { Telegraf, Markup } = require('telegraf');

// =======================
// 🔐 Konfigurasi Bot
// =======================
const BOT_TOKEN = '8006865528:AAE0vGWwNX1TpNKkRqShTKCygbq1RkPLm64';
const DANA_QR_LINK = 'https://files.catbox.moe/mxovdq.jpg';
const DANA_NUMBER = '087883536039';
const ADMIN_ID = 7598563861;
const ADMIN_USERNAME = 'jnipo'; // ubah username admin

const REMINDER_TIMEOUT = 12 * 60 * 60 * 1000; // 12 jam
const PAYMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 jam
const AKTIF_DURASI = 30 * 24 * 60 * 60 * 1000; // 30 hari

const bot = new Telegraf(BOT_TOKEN);

// =======================
// Data pengguna
// =======================
const users = {};

// =======================
// Fungsi aman kirim pesan
// =======================
async function safeSendMessage(chatId, text, extra = {}) {
  try {
    await bot.telegram.sendMessage(chatId, text, extra);
  } catch (e) {
    if (e?.response?.error_code === 403) {
      console.log(`User ${chatId} memblokir bot.`);
      delete users[chatId];
    } else {
      console.error(`Gagal kirim pesan ke ${chatId}:`, e);
    }
  }
}

async function safeSendPhoto(chatId, photo, extra = {}) {
  try {
    await bot.telegram.sendPhoto(chatId, photo, extra);
  } catch (e) {
    if (e?.response?.error_code === 403) {
      console.log(`User ${chatId} memblokir bot.`);
      delete users[chatId];
    } else {
      console.error(`Gagal kirim foto ke ${chatId}:`, e);
    }
  }
}

// =======================
// Daftar Paket
// =======================
const paketList = {
  lokal: { name: "Lokal", harga: 2000, channel: 'https://t.me/+P1hlp7dNmdgyOTVl' },
  cina: { name: "Cina", harga: 2000, channel: 'https://t.me/+eXWEgvPsFpY2MGI1' },
  asia: { name: "Asia", harga: 2000, channel: 'https://t.me/+RdCldl43tqk5YzY1' },
  amerika: { name: "Amerika", harga: 2000, channel: 'https://t.me/+kT7I9m0V85JkZWY1' },
  yaoi: { name: "Yaoi", harga: 2000, channel: 'https://t.me/+B_BQ68aeAd42MTI1' },
  lengkap: {
    name: "Paket Lengkap Semua Channel",
    harga: 6000,
    channel: [
      'https://t.me/+RdCldl43tqk5YzY1',
      'https://t.me/+P1hlp7dNmdgyOTVl',
      'https://t.me/+eXWEgvPsFpY2MGI1',
      'https://t.me/+kT7I9m0V85JkZWY1',
      'https://t.me/+B_BQ68aeAd42MTI1'
    ]
  }
};

// =======================
// Menu Utama
// =======================
async function showMainMenu(ctx) {
  const chatId = ctx.chat.id;
  await safeSendMessage(chatId,
    `👋 Selamat datang di bot VIP @${ADMIN_USERNAME}!\n\nPilih paket yang kamu inginkan:\n\n` +
    `📦 Lokal - Rp2.000\n📦 Cina - Rp2.000\n📦 Asia - Rp2.000\n📦 Amerika - Rp2.000\n📦 Yaoi - Rp2.000\n📦 Semua Channel - Rp6.000`,
    {
      reply_markup: {
        keyboard: [
          ['📦 Lokal', '📦 Cina'],
          ['📦 Asia', '📦 Amerika'],
          ['📦 Yaoi', '📦 Semua Channel'],
          ['❌ Batalkan Pesanan']
        ],
        resize_keyboard: true
      }
    });
}

// =======================
// /start
// =======================
bot.start(showMainMenu);

// =======================
// Pilih Paket
// =======================
bot.hears([
  '📦 Lokal', '📦 Cina', '📦 Asia',
  '📦 Amerika', '📦 Yaoi', '📦 Semua Channel'
], async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;
  const paketId = text.includes('Semua') ? 'lengkap' : text.split(' ')[1].toLowerCase();

  if (users[userId]?.status === 'pending') {
    return ctx.reply(
      `⚠️ Kamu masih memiliki transaksi *${paketList[users[userId].paket].name}* yang belum selesai.\nSilakan lanjutkan bayar atau ketik /batal`,
      { parse_mode: 'Markdown' }
    );
  }

  const now = Date.now();
  users[userId] = {
    paket: paketId,
    status: 'pending',
    timestamp: now,
    expiredAt: null,
    timeoutIds: []
  };

  const pkg = paketList[paketId];
  const caption = `📦 *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\n` +
    `Silakan scan QR di atas lalu kirim bukti pembayaran (foto/screenshot) ke sini.\n\n` +
    `*Jangan kirim bukti palsu, kamu bisa di-banned!*\n` +
    `Butuh bantuan? Hubungi admin @${ADMIN_USERNAME}`;

  await ctx.replyWithPhoto(DANA_QR_LINK, { caption, parse_mode: 'Markdown' });

  const reminderId = setTimeout(() => {
    if (users[userId]?.status === 'pending') {
      safeSendMessage(userId, `⏰ Pengingat! Kamu masih memiliki pembayaran paket *${pkg.name}*.`, { parse_mode: 'Markdown' });
    }
  }, REMINDER_TIMEOUT);

  const timeoutId = setTimeout(() => {
    if (users[userId]?.status === 'pending') {
      delete users[userId];
      safeSendMessage(userId, `⏰ Waktu pembayaran habis. Silakan ulangi pembelian.`);
    }
  }, PAYMENT_TIMEOUT);

  users[userId].timeoutIds.push(reminderId, timeoutId);
});

// =======================
// Bukti pembayaran
// =======================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  if (!users[userId] || users[userId].status !== 'pending') {
    return await safeSendMessage(userId, '❌ Kamu tidak memiliki transaksi aktif. Ketik /start untuk memulai.');
  }

  const pkg = paketList[users[userId].paket];
  users[userId].status = 'done';
  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  users[userId].timeoutIds = [];

  const user = ctx.from;
  const photo = ctx.message.photo.at(-1).file_id;

  const caption = `📥 *User mengirim bukti transfer!*\n\n` +
  `👤 [${user.first_name}](tg://user?id=${user.id})\n` +
  `🆔 *ID:* \`${user.id}\`\n` +
  `📦 *Paket:* ${pkg.name}`;

  await bot.telegram.sendPhoto(ADMIN_ID, photo, { caption, parse_mode: 'Markdown' });

  await sendInstructionToUser(userId, pkg);
});

// =======================
// Kirim instruksi + masa aktif
// =======================
async function sendInstructionToUser(userId, pkg) {
  try {
    const now = new Date();
    const tanggalMulai = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });
    const expDate = new Date(now.getTime() + AKTIF_DURASI);
    const tanggalExp = expDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

    const formatPesan = `beli nama vip : ${pkg.name}\ntanggal bayar : ${tanggalMulai}\nkedaluwarsa : ${tanggalExp}`;
    const encodedText = encodeURIComponent(formatPesan);

    const adminLink = ADMIN_USERNAME
      ? `https://t.me/${ADMIN_USERNAME}?text=${encodedText}`
      : `tg://user?id=${ADMIN_ID}&text=${encodedText}`;

    const textInstruksi =
      `✅ Bukti pembayaran sudah diterima!\n\n` +
      `📅 *Tanggal Aktif:* ${tanggalMulai}\n` +
      `⏰ *Berlaku hingga:* ${tanggalExp}\n\n` +
      `Untuk mendapatkan akses VIP, kirim pesan ke admin dengan format berikut:\n\n` +
      `📋 *Format Pesan:*\n\`\`\`\n${formatPesan}\n\`\`\`\n` +
      `Klik tombol di bawah untuk menghubungi admin.`;

    // Kirim pesan dengan reply keyboard + inline tombol chat admin
    await safeSendMessage(userId, textInstruksi, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Chat Admin Sekarang', url: adminLink }]
        ]
      }
    });

    // Tambahkan reply keyboard terpisah setelahnya
    await safeSendMessage(userId, 'Gunakan tombol di bawah untuk navigasi:', {
      reply_markup: {
        keyboard: [
          ['🔙 Kembali ke Menu'],
        ],
        resize_keyboard: true
      }
    });
  } catch (e) {
    console.error('Error kirim instruksi ke user:', e);
  }
}

// =======================
// Command tambahan
// =======================
bot.command('help', async (ctx) => {
  await safeSendMessage(ctx.chat.id,
    `ℹ️ *Panduan Penggunaan Bot:*\n\n` +
    `1. Gunakan /start untuk memilih paket.\n` +
    `2. Bayar menggunakan QR DANA.\n` +
    `3. Kirim bukti pembayaran.\n` +
    `4. Tunggu verifikasi admin.\n` +
    `5. Dapatkan akses ke channel VIP!\n\n` +
    `📌 *Perintah:*\n` +
    `/batal – Batalkan transaksi\n` +
    `/help – Bantuan\n\n` +
    `Hubungi admin: @${ADMIN_USERNAME}`,
    { parse_mode: 'Markdown' });
});

bot.command('batal', async (ctx) => {
  const userId = ctx.from.id;
  if (!users[userId] || users[userId].status !== 'pending') {
    return await safeSendMessage(userId, '❌ Kamu tidak memiliki transaksi aktif.');
  }
  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  delete users[userId];
  await safeSendMessage(userId, '✅ Transaksi berhasil dibatalkan.');
});

// =======================
// Keyboard Handler
// =======================
bot.hears('❌ Batalkan Pesanan', async (ctx) => {
  const userId = ctx.from.id;
  if (!users[userId] || users[userId].status !== 'pending') {
    return ctx.reply('❌ Kamu tidak memiliki transaksi aktif.');
  }
  users[userId].timeoutIds.forEach(id => clearTimeout(id));
  delete users[userId];
  await ctx.reply('✅ Pesanan kamu sudah dibatalkan.');
});

bot.hears('🔙 Kembali ke Menu', async (ctx) => showMainMenu(ctx));

// =======================
// Jalankan Bot
// =======================
bot.launch().then(() => {
  console.log('🤖 Bot sudah berjalan...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
