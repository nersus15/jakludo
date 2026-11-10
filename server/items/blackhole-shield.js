// Blackhole Shield: item pasif yang otomatis mencegah bidak tersedot Black Hole
module.exports = {
  id: 'blackholeShield',
  name: 'Blackhole Shield',
  icon: '🛡️',
  price: 50,
  kind: 'passive',
  protects: ['blackHole'],
  sound: 'chime',
  badge: 'Perisai Pasif Otomatis',
  badgeColor: '#3b82f6',
  highlight: 'Otomatis aktif saat terkena Black Hole',
  description: 'Melindungi bidakmu dari sedotan Black Hole. Saat bidakmu mendarat di petak Black Hole, perisai otomatis aktif sehingga bidakmu tidak kembali ke markas.',

  hooks: {
    blackHole(ctx) {
      if (ctx.count <= 0 || !ctx.consume()) return false;
      const { player, pawnIdx, game } = ctx;
      game.addHistory(`🛡️ BLACKHOLE SHIELD AKTIF! Bidak ${pawnIdx + 1} milik ${player.name} terselamatkan dari Black Hole! (Sisa perisai: ${ctx.count - 1})`);
      game.setMessage(`🛡️ Blackhole Shield melindungi bidak ${player.name}! Bidak aman!`);
      game.announce({
        title: 'PERISAI BLACKHOLE AKTIF!',
        text: `Bidak milik ${player.name} terlindungi dan terselamatkan dari Black Hole!`
      });
      return true;
    }
  }
};
