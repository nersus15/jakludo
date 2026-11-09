// Rate limiter sederhana berbasis jendela waktu tetap (in-memory, satu proses)
function createLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, h] of hits) if (h.reset < now) hits.delete(key);
  }, windowMs).unref();

  return key => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(key, h);
    }
    h.count++;
    return h.count <= max;
  };
}

module.exports = { createLimiter };
