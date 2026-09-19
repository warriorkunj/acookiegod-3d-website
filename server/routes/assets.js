const fs = require('fs');
const path = require('path');
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const MIME_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_BYTES = 3 * 1024 * 1024; // 3MB per asset

// POST /api/assets/upload — accepts a base64 <data-uri> or raw base64 blob and
// writes a sanitized image into the statically-served project /assets folder so
// the CMS can deploy image assets without touching any code files.
router.post(
  '/upload',
  express.json({ limit: '4mb' }),
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const data = body.data;
    if (!data) {
      return res.status(400).json({ success: false, message: 'No image data provided.' });
    }

    let mime = null;
    let buf = null;
    if (typeof data === 'string' && data.startsWith('data:')) {
      const match = /^data:([a-z0-9/+\-.]+);base64,(.*)$/s.exec(data);
      if (!match) {
        return res.status(400).json({ success: false, message: 'Malformed data URI.' });
      }
      mime = match[1];
      buf = Buffer.from(match[2], 'base64');
    } else if (typeof data === 'string') {
      mime = String(body.mime || 'image/png');
      buf = Buffer.from(data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      mime = String(body.mime || 'image/png');
      buf = data;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported image payload.' });
    }

    const ext = MIME_EXT[mime];
    if (!ext) {
      return res.status(400).json({ success: false, message: 'Image type must be png, jpg, webp, or gif.' });
    }
    if (buf.length > MAX_BYTES) {
      return res.status(400).json({ success: false, message: 'Image exceeds the 3MB limit.' });
    }

    const base = String(body.filename || 'upload')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 60) || 'upload';
    const safeName = `${base}-${Date.now()}${ext}`;

    const assetsDir = path.join(__dirname, '..', '..', 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, safeName), buf);

    res.status(201).json({
      success: true,
      filename: safeName,
      url: `assets/${safeName}`,
    });
  })
);

module.exports = router;