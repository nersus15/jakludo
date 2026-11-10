// REST API sosial: pertemanan, grup, undangan grup, chat & media grup (MinIO), dan leaderboard grup.
const express = require('express');
const multer = require('multer');
const db = require('../db');
const social = require('./store');
const { MAX_IMAGE_INPUT_BYTES } = require('../lib/media');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_INPUT_BYTES, // 8 MB batas atas input sebelum kompresi
    files: 1
  }
});

function bearerToken(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() || String(req.query?.token || '').trim();
}

function requireUser(req, res) {
  const user = db.getUserByToken(bearerToken(req) || String(req.body?.token || ''));
  if (!user) res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu.' });
  return user;
}

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function sendAudioStream(req, res, result) {
  const { buffer, mime } = result;
  const total = buffer.length;
  res.setHeader('Content-Type', mime || 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(total - 1, parseInt(match[2], 10)) : total - 1;
      if (start >= 0 && start <= end && start < total) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(end - start + 1));
        return res.end(buffer.subarray(start, end + 1));
      }
    }
  }

  res.setHeader('Content-Length', String(total));
  res.end(buffer);
}

function registerSocialRoutes(api) {
  // ==========================================
  // FOTO PROFIL (AVATAR) USER DI MINIO S3
  // ==========================================

  api.post(
    '/auth/avatar',
    (req, res, next) => {
      upload.single('file')(req, res, err => {
        if (err) {
          const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Ukuran foto profil terlalu besar (maksimal 8 MB).'
            : 'Gagal membaca file foto profil.';
          return res.status(400).json({ success: false, error: msg });
        }
        next();
      });
    },
    asyncRoute(async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'File foto profil wajib dilampirkan.' });
      }
      const result = await social.uploadUserAvatar(user.id, req.file.buffer);
      if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
      res.json({
        success: true,
        user: { ...result.user, isLudoKing: db.checkIsLudoKing(user.id) },
        avatarUrl: result.avatarUrl
      });
    })
  );

  api.get('/users/:userId/avatar', asyncRoute(async (req, res) => {
    const result = await social.getUserAvatarBuffer(req.params.userId, req.query.key);
    if (result.error) return res.status(result.status || 404).end();
    res.setHeader('Content-Type', result.mime || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', String(result.buffer.length));
    res.end(result.buffer);
  }));

  api.get('/users/:userId/profile', (req, res) => {
    const viewer = db.getUserByToken(bearerToken(req));
    const result = social.getUserPublicProfile(req.params.userId, viewer?.id || null);
    if (result.error) return res.status(result.status || 404).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  });

  // ==========================================
  // TEMAN & CHAT PRIVATE (DIRECT MESSAGES)
  // ==========================================

  api.get('/friends', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ success: true, ...social.listFriends(user.id) });
  });

  api.post('/friends/request', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.requestFriend(user.id, req.body?.username);
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  });

  api.post('/friends/:userId/accept', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.acceptFriend(user.id, req.params.userId);
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true });
  });

  api.delete('/friends/:userId', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.removeFriend(user.id, req.params.userId);
    if (result.error) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true });
  });

  api.get('/friends/:userId/messages', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.listDirectMessages(user.id, req.params.userId, {
      before: req.query.before,
      limit: req.query.limit
    });
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post('/friends/:userId/messages', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.sendDirectTextMessage(user.id, req.params.userId, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post(
    '/friends/:userId/media',
    (req, res, next) => {
      upload.single('file')(req, res, err => {
        if (err) {
          const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Ukuran file terlalu besar (maksimal 8 MB).'
            : 'Gagal membaca file upload.';
          return res.status(400).json({ success: false, error: msg });
        }
        next();
      });
    },
    asyncRoute(async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'File media wajib dilampirkan.' });
      }
      const result = await social.sendDirectMediaMessage(user.id, req.params.userId, {
        kind: req.body?.kind,
        buffer: req.file.buffer,
        durationMs: req.body?.durationMs,
        text: req.body?.text
      });
      if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
      res.json({ success: true, ...result });
    })
  );

  api.get('/friends/:userId/messages/:messageId/audio', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.getDirectMessageAudio(req.params.messageId, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    sendAudioStream(req, res, result);
  }));

  api.get('/dm/:messageId/audio', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.getDirectMessageAudio(req.params.messageId, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    sendAudioStream(req, res, result);
  }));

  // ==========================================
  // GRUP & UNDANGAN GRUP
  // ==========================================

  api.get('/groups', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const data = await social.listUserGroups(user.id);
    res.json({ success: true, ...data });
  }));

  api.post('/groups', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.createGroup(user.id, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.get('/groups/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.getGroupDetail(req.params.id, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  });

  api.patch('/groups/:id', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.renameGroup(req.params.id, user.id, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post(
    '/groups/:id/avatar',
    (req, res, next) => {
      upload.single('file')(req, res, err => {
        if (err) {
          const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Ukuran foto grup terlalu besar (maksimal 8 MB).'
            : 'Gagal membaca file foto grup.';
          return res.status(400).json({ success: false, error: msg });
        }
        next();
      });
    },
    asyncRoute(async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'File foto grup wajib dilampirkan.' });
      }
      const result = await social.uploadGroupAvatar(req.params.id, user.id, req.file.buffer);
      if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
      res.json({ success: true, ...result });
    })
  );

  api.get('/groups/:id/avatar', asyncRoute(async (req, res) => {
    const result = await social.getGroupAvatarBuffer(req.params.id, req.query.key);
    if (result.error) return res.status(result.status || 404).end();
    res.setHeader('Content-Type', result.mime || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', String(result.buffer.length));
    res.end(result.buffer);
  }));

  api.delete('/groups/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.deleteGroup(req.params.id, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true });
  });

  api.post('/groups/:id/invites', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.inviteToGroup(req.params.id, user.id, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  });

  api.get('/group-invites', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ success: true, ...social.listUserGroupInvites(user.id) });
  });

  api.post('/group-invites/:inviteId/accept', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.acceptGroupInvite(req.params.inviteId, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post('/group-invites/:inviteId/decline', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.declineGroupInvite(req.params.inviteId, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true });
  });

  api.patch('/groups/:id/members/:userId', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.setMemberRole(req.params.id, user.id, req.params.userId, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.delete('/groups/:id/members/:userId', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.removeGroupMember(req.params.id, user.id, req.params.userId);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true });
  }));

  // ==========================================
  // CHAT, MEDIA & LEADERBOARD GRUP
  // ==========================================

  api.get('/groups/:id/messages', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.listGroupMessages(req.params.id, user.id, {
      before: req.query.before,
      limit: req.query.limit
    });
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post('/groups/:id/messages', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.sendGroupTextMessage(req.params.id, user.id, req.body || {});
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  }));

  api.post(
    '/groups/:id/media',
    (req, res, next) => {
      upload.single('file')(req, res, err => {
        if (err) {
          const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'Ukuran file terlalu besar (maksimal 8 MB).'
            : 'Gagal membaca file upload.';
          return res.status(400).json({ success: false, error: msg });
        }
        next();
      });
    },
    asyncRoute(async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'File media wajib dilampirkan.' });
      }
      const result = await social.sendGroupMediaMessage(req.params.id, user.id, {
        kind: req.body?.kind,
        buffer: req.file.buffer,
        durationMs: req.body?.durationMs,
        text: req.body?.text
      });
      if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
      res.json({ success: true, ...result });
    })
  );

  // Endpoint streaming voice note (mendukung HTTP Range 206 & konversi otomatis ke MP3 untuk semua browser)
  api.get('/groups/:id/messages/:messageId/audio', asyncRoute(async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = await social.getGroupMessageAudio(req.params.id, req.params.messageId, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    sendAudioStream(req, res, result);
  }));

  api.get('/groups/:id/leaderboard', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const result = social.getGroupLeaderboard(req.params.id, user.id);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  });
}

module.exports = { registerSocialRoutes };

