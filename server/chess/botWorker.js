// Worker thread pencarian langkah Catur (bot & item HINT). Pencarian bisa makan ratusan milidetik;
// di thread utama itu akan membekukan semua room (Ludo, Kuis, Ular Tangga, Catur) sekaligus.
const { parentPort } = require('worker_threads');
const { chooseBotMove } = require('./bot');

parentPort.on('message', ({ id, fen, difficulty, timeBudgetMs }) => {
  try {
    parentPort.postMessage({ id, move: chooseBotMove(fen, difficulty, { timeBudgetMs }) });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
