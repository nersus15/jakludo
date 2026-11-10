// Penyimpanan objek MinIO / S3 untuk file media grup (foto & voice note).
// Bucket bersifat privat; klien membaca file lewat presigned URL berumur pendek.
const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const PRESIGN_TTL_SEC = Number(process.env.S3_PRESIGN_TTL_SEC || 600); // 10 menit

let s3Client = null;
let presignClient = null;
let activeConfig = null;
let bucketEnsured = false;
// Mock hook untuk pengujian tanpa daemon MinIO eksternal
let mockAdapter = null;

function normalizeEndpoint(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return clean.replace(/\/+$/, '');
  return `http://${clean.replace(/\/+$/, '')}`;
}

function getS3Config(env = process.env) {
  const endpoint = normalizeEndpoint(env.S3_ENDPOINT || env.MINIO_ENDPOINT);
  const publicEndpoint = normalizeEndpoint(env.S3_PUBLIC_ENDPOINT || env.MINIO_PUBLIC_ENDPOINT) || endpoint;
  const accessKeyId = String(env.S3_ACCESS_KEY || env.MINIO_ACCESS_KEY || env.MINIO_ROOT_USER || '').trim();
  const secretAccessKey = String(env.S3_SECRET_KEY || env.MINIO_SECRET_KEY || env.MINIO_ROOT_PASSWORD || '').trim();
  const bucket = String(env.S3_BUCKET || env.MINIO_BUCKET || 'jakludo').trim();
  const region = String(env.S3_REGION || 'us-east-1').trim();
  const forcePathStyle = String(env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() !== 'false';

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, publicEndpoint, accessKeyId, secretAccessKey, bucket, region, forcePathStyle };
}

function getClients() {
  if (mockAdapter) return null;
  const cfg = getS3Config();
  if (!cfg) return null;

  const sig = `${cfg.endpoint}|${cfg.publicEndpoint}|${cfg.accessKeyId}|${cfg.bucket}`;
  if (!s3Client || activeConfig?.sig !== sig) {
    activeConfig = { ...cfg, sig };
    bucketEnsured = false;
    s3Client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey
      }
    });
    presignClient = cfg.publicEndpoint === cfg.endpoint
      ? s3Client
      : new S3Client({
          endpoint: cfg.publicEndpoint,
          region: cfg.region,
          forcePathStyle: cfg.forcePathStyle,
          credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey
          }
        });
  }
  return { s3Client, presignClient, cfg: activeConfig };
}

function isMediaEnabled() {
  return Boolean(mockAdapter || getS3Config());
}

async function ensureBucket(client, bucket) {
  if (bucketEnsured) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    bucketEnsured = true;
  } catch (err) {
    const code = err?.$metadata?.httpStatusCode;
    if (code === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      bucketEnsured = true;
      return;
    }
    // Jika user S3 tidak diberi izin HeadBucket tapi boleh PutObject, tetap lanjutkan
    bucketEnsured = true;
  }
}

function makeMediaKey(groupId, kind, ext) {
  const cleanExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const datePrefix = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(10).toString('hex');
  return `groups/${groupId}/${kind}/${datePrefix}/${Date.now()}_${rand}.${cleanExt}`;
}

async function uploadMedia({ groupId, kind, ext, buffer, mime }) {
  const key = makeMediaKey(groupId, kind, ext);
  if (mockAdapter) {
    await mockAdapter.upload({ key, buffer, mime });
    return { key, size: buffer.length };
  }

  const bundle = getClients();
  if (!bundle) throw new Error('Object storage MinIO belum dikonfigurasi.');
  const { s3Client: client, cfg } = bundle;

  await ensureBucket(client, cfg.bucket);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'private, max-age=86400'
    })
  );
  return { key, size: buffer.length };
}

async function signMediaUrl(key) {
  if (!key) return null;
  if (mockAdapter) return mockAdapter.signUrl(key);

  const bundle = getClients();
  if (!bundle) return null;
  const { presignClient: signer, cfg } = bundle;

  const cmd = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: key
  });
  return getSignedUrl(signer, cmd, { expiresIn: PRESIGN_TTL_SEC });
}

async function getMediaBuffer(key) {
  if (!key) return null;
  if (mockAdapter) {
    return mockAdapter.get ? mockAdapter.get(key) : null;
  }

  const bundle = getClients();
  if (!bundle) return null;
  const res = await bundle.s3Client.send(
    new GetObjectCommand({
      Bucket: bundle.cfg.bucket,
      Key: key
    })
  );
  if (!res?.Body) return null;
  if (typeof res.Body.transformToByteArray === 'function') {
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function deleteMedia(key) {
  if (!key) return;
  if (mockAdapter) return mockAdapter.delete?.(key);

  const bundle = getClients();
  if (!bundle) return;
  await bundle.s3Client.send(
    new DeleteObjectCommand({
      Bucket: bundle.cfg.bucket,
      Key: key
    })
  ).catch(() => {});
}

function setMockAdapter(adapter) {
  mockAdapter = adapter;
}

module.exports = {
  getS3Config,
  isMediaEnabled,
  uploadMedia,
  signMediaUrl,
  getMediaBuffer,
  deleteMedia,
  setMockAdapter
};

