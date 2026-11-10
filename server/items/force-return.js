// Force Return: pulangkan 1 bidak lawan di lintasan langsung ke markas.
// Hanya bisa didapat dengan membeli di toko. Lawan yang punya perisai untuk event 'forceReturn'
// (mis. Universal Shield) boleh memilih menahannya.
module.exports = {
  id: 'forceReturn',
  name: 'Force Return',
  icon: '⚡',
  price: 100,
  kind: 'active',
  target: 'opponentPawn',
  attack: 'forceReturn',
  sound: 'thunder',
  badge: 'Eliminasi Instan',
  badgeColor: '#f59e0b',
  highlight: 'Dipakai di giliranmu sebelum melempar dadu',
  description: 'Pulangkan 1 bidak lawan di lintasan langsung ke markas. Dipakai di giliranmu sebelum melempar dadu. Lawan yang punya Universal Shield bisa memilih menahannya.',

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
