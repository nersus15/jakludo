// Stok item milik pemain di dalam room: player.items[itemId] = { owned, earned, state }
//   owned  : item milik akun (dibeli di toko, tersimpan di database)
//   earned : item yang didapat selama pertandingan (hilang saat pertandingan baru dimulai)
//   state  : data bebas milik item (disimpan per pertandingan)
const db = require('../db');
const items = require('../items');

function slot(player, itemId) {
  if (!player.items) player.items = {};
  if (!player.items[itemId]) player.items[itemId] = { owned: 0, earned: 0, state: {} };
  return player.items[itemId];
}

function count(player, itemId) {
  const s = player.items?.[itemId];
  return s ? s.owned + s.earned : 0;
}

function state(player, itemId) {
  return slot(player, itemId).state;
}

// Item hasil pertandingan dipakai lebih dulu agar item yang dibeli tetap tersimpan di akun
function consume(player, itemId) {
  const s = slot(player, itemId);
  if (s.earned > 0) {
    s.earned--;
    return true;
  }
  if (s.owned > 0 && db.consumeUserItem({ userId: player.userId, itemId })) {
    s.owned--;
    return true;
  }
  return false;
}

function grant(player, itemId, amount = 1) {
  slot(player, itemId).earned += amount;
}

// Samakan stok milik akun dengan database ({ [itemId]: jumlah })
function loadOwned(player, ownedItems = {}) {
  for (const item of items.list()) slot(player, item.id).owned = ownedItems[item.id] || 0;
}

function resetForMatch(player) {
  for (const s of Object.values(player.items || {})) {
    s.earned = 0;
    s.state = {};
  }
}

// Ringkasan untuk klien: jumlah, asal stok, dan alasan item aktif belum bisa dipakai (blocked)
function publicItems(player, room) {
  const out = {};
  for (const item of items.list()) {
    const s = player.items?.[item.id] || { owned: 0, earned: 0, state: {} };
    out[item.id] = {
      count: s.owned + s.earned,
      owned: s.owned,
      earned: s.earned,
      blocked: room?.started && item.canUse ? item.canUse({ room, player, item }) : null
    };
  }
  return out;
}

// Snapshot room versi lama menyimpan inventory { [itemId]: jumlah } dan stompCount
function normalizeLegacy(player) {
  if (player.items) return;
  player.items = {};
  for (const [itemId, qty] of Object.entries(player.inventory || {})) slot(player, itemId).owned = qty || 0;
  delete player.inventory;
  delete player.stompCount;
}

module.exports = { count, state, consume, grant, loadOwned, resetForMatch, publicItems, normalizeLegacy };
