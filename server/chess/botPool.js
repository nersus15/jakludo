// Kolam worker untuk pencarian langkah Catur (lihat botWorker.js). Dipakai bot dan item HINT
// supaya thread utama server tetap bebas melayani semua room.
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const { chooseBotMove } = require('./bot');

const POOL_SIZE = Math.max(1, Math.min(2, (os.cpus()?.length || 2) - 1));
const TIMEOUT_MS = 10000;

const workers = [];
const pending = new Map(); // id -> { resolve, reject, timer, worker }
let seq = 0;

function spawn() {
  const worker = new Worker(path.join(__dirname, 'botWorker.js'));
  worker.unref();
  worker.load = 0;
  worker.on('message', ({ id, move, error }) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    clearTimeout(job.timer);
    worker.load--;
    if (error) job.reject(new Error(error));
    else job.resolve(move);
  });
  const fail = err => {
    const idx = workers.indexOf(worker);
    if (idx !== -1) workers.splice(idx, 1);
    for (const [id, job] of pending) {
      if (job.worker !== worker) continue;
      pending.delete(id);
      clearTimeout(job.timer);
      job.reject(err || new Error('Worker catur berhenti.'));
    }
  };
  worker.on('error', fail);
  worker.on('exit', code => fail(code ? new Error(`Worker catur keluar (kode ${code}).`) : null));
  workers.push(worker);
  return worker;
}

// Worker dengan antrean paling sedikit; worker baru dibuat bila kolam belum penuh
function pickWorker() {
  const idle = workers.find(w => w.load === 0);
  if (idle) return idle;
  if (workers.length < POOL_SIZE) return spawn();
  return workers.reduce((a, b) => (b.load < a.load ? b : a));
}

// Cari langkah terbaik tanpa memblokir thread utama. Bila worker gagal, jatuh ke perhitungan biasa
// dengan waktu berpikir minimal supaya permainan tetap berjalan.
function chooseBotMoveAsync(fen, difficulty = 'medium', { timeBudgetMs } = {}) {
  return new Promise(resolve => {
    let worker;
    try {
      worker = pickWorker();
    } catch {
      return resolve(chooseBotMove(fen, difficulty, { timeBudgetMs: 50 }));
    }
    const id = ++seq;
    const fallback = () => resolve(chooseBotMove(fen, difficulty, { timeBudgetMs: 50 }));
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      worker.load--;
      fallback();
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject: fallback, timer, worker });
    worker.load++;
    worker.postMessage({ id, fen, difficulty, timeBudgetMs });
  });
}

function shutdownBotPool() {
  for (const w of workers.splice(0)) w.terminate();
}

module.exports = { chooseBotMoveAsync, shutdownBotPool };
