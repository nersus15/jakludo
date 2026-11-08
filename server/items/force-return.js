// Force Return: pulangkan 1 bidak lawan di lintasan langsung ke markas.
// Cara mendapatkan:
//   1. Beli di toko -> tersimpan di akun dan bisa dipakai kapan saja di giliran sendiri
//   2. Menginjak bidak lawan 3 kali -> otomatis dapat 1 gratis (berlaku untuk pertandingan itu saja)
const STOMPS_PER_CHARGE = 3;

module.exports = {
  id: 'forceReturn',
  name: 'Force Return',
  icon: '⚡',
  price: 100,
  kind: 'active',
  target: 'opponentPawn',
  sound: 'thunder',
  badge: 'Eliminasi Instan',
  badgeColor: '#f59e0b',
  highlight: `Bisa langsung dipakai · Gratis 1 tiap ${STOMPS_PER_CHARGE}x injak lawan`,
  description: `Pulangkan 1 bidak lawan di lintasan langsung ke markas. Item yang dibeli di toko bisa dipakai kapan saja di giliranmu sebelum melempar dadu. Kamu juga otomatis mendapat 1 Force Return gratis setiap ${STOMPS_PER_CHARGE} kali menginjak bidak lawan (hanya berlaku di pertandingan itu).`,

  progress(state) {
    return { value: state.stomps || 0, max: STOMPS_PER_CHARGE, label: 'injakan' };
  },

  hooks: {
    capture(ctx) {
      const { player, state, game } = ctx;
      state.stomps = (state.stomps || 0) + 1;
      if (state.stomps < STOMPS_PER_CHARGE) return false;

      state.stomps -= STOMPS_PER_CHARGE;
      ctx.grant(1);
      game.addHistory(`⚡ ${player.name} sudah ${STOMPS_PER_CHARGE}x menginjak lawan dan mendapat 1 Force Return gratis!`);
      game.announce({
        title: 'FORCE RETURN DIDAPAT!',
        text: `${player.name} mendapat 1 Force Return gratis setelah ${STOMPS_PER_CHARGE}x menginjak bidak lawan!`
      });
      return false; // Tidak mengubah hasil capture
    }
  },

  use(ctx) {
    const { player, target, game } = ctx;
    game.sendPawnHome(target.player, target.pawnIdx);
    game.recordCapture(target.player, { isForceReturn: true });
    game.addHistory(`⚡ FORCE RETURN! ${player.name} memulangkan bidak ${target.pawnIdx + 1} milik ${target.player.name} ke markas!`);
    game.setMessage(`⚡ Force Return! ${player.name} mengeliminasi bidak ${target.player.name}! Silakan lempar dadu.`);
    game.announce({
      title: 'FORCE RETURN DIEKSEKUSI!',
      text: `${player.name} melancarkan eliminasi langsung terhadap bidak ${target.player.name}!`
    });
  }
};
