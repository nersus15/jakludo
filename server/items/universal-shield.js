// Universal Shield: menahan Force Return dan sedotan Black Hole.
// Item reaktif: saat bidak pemilik jadi target Force Return atau mendarat di Black Hole, pemain
// ditanya mau memakai perisai atau tidak. Bot dan pemain yang terputus otomatis memakainya.
module.exports = {
  id: 'universalShield',
  name: 'Universal Shield',
  icon: '🔰',
  price: 100,
  kind: 'reactive',
  protects: ['forceReturn', 'blackHole'],
  sound: 'chime',
  badge: 'Perisai Pilihan',
  badgeColor: '#7c3aed',
  highlight: 'Menahan Force Return & Black Hole, kamu yang memilih',
  description: 'Menahan Force Return dari lawan dan sedotan Black Hole. Saat bidakmu jadi target Force Return atau mendarat di Black Hole, muncul pilihan untuk memakai perisai ini atau menyimpannya.',

  // Dipanggil setelah pemain memilih memakai perisai dan stok sudah dikurangi
  protect(ctx) {
    const { player, event, pawnIdx, attacker, game } = ctx;
    const what = event === 'forceReturn' ? `Force Return dari ${attacker?.name || 'lawan'}` : 'sedotan Black Hole';
    game.addHistory(`🔰 UNIVERSAL SHIELD! Bidak ${pawnIdx + 1} milik ${player.name} selamat dari ${what}.`);
    game.setMessage(`🔰 Universal Shield ${player.name} menahan ${what}!`);
    game.announce({ title: 'UNIVERSAL SHIELD AKTIF!', text: `Bidak ${player.name} selamat dari ${what}.` });
  }
};
