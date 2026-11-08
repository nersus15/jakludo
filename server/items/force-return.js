// Force Return: pulangkan 1 bidak lawan di lintasan langsung ke markas.
// Bisa dipakai setelah menginjak bidak lawan 3 kali.
const STOMPS_REQUIRED = 3;

module.exports = {
  id: 'forceReturn',
  name: 'Force Return',
  icon: '⚡',
  price: 100,
  kind: 'active',
  target: 'opponentPawn',
  sound: 'thunder',
  badge: 'Skill Eliminasi Aktif',
  badgeColor: '#f59e0b',
  highlight: `Aktif saat sudah ${STOMPS_REQUIRED}x menginjak bidak lawan`,
  description: `Kemampuan eliminasi langsung instan. Aktif ketika kamu sudah berhasil menginjak bidak lawan sebanyak ${STOMPS_REQUIRED} kali.`,

  progress(state) {
    return { value: Math.min(state.stomps || 0, STOMPS_REQUIRED), max: STOMPS_REQUIRED, label: 'injakan' };
  },

  canUse(ctx) {
    const stomps = ctx.state.stomps || 0;
    return stomps >= STOMPS_REQUIRED
      ? null
      : `Force Return memerlukan minimal ${STOMPS_REQUIRED} kali menginjak bidak lawan. Progresmu: ${stomps}/${STOMPS_REQUIRED}.`;
  },

  hooks: {
    capture(ctx) {
      ctx.state.stomps = (ctx.state.stomps || 0) + 1;
      return false;
    }
  },

  use(ctx) {
    const { player, target, state, game } = ctx;
    state.stomps -= STOMPS_REQUIRED;
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
