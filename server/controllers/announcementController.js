// server/controllers/announcementController.js
// Creator-feed announcement stream powering the about.html timeline hub.
// Mirrors the product controller pattern: an in-memory layer stays
// authoritative while the cloud database is unreachable.

const ANNOUNCEMENT_SEED = {
  _id: 'ann-seed-summer-2026',
  category: '📦 DROP TEASER',
  title: 'NEW MERCH COMING SOON',
  body: 'THE COOKIE ARMY IS TAKING OVER. OUTFIT DESIGNS ARE FULLY LOCKED. PREPARE FOR THE ULTIMATE SUMMER 2026 DROPS.',
  dateTag: 'JUNE 12',
  image: 'assets/cookie_stamp_tee.png',
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
};

const announcementMemory = {
  deployed: [], // custom posts pushed from the CMS (newest first)
};

const sanitize = (value, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

// Newest-first stream: CMS deployments lead, seed timeline trails.
function visibleStream() {
  return [...announcementMemory.deployed, ANNOUNCEMENT_SEED];
}

// GET /api/announcements
async function getAnnouncements(_req, res) {
  res.json({
    success: true,
    count: visibleStream().length,
    data: visibleStream(),
  });
}

// POST /api/announcements/add
async function addAnnouncement(req, res) {
  const title = sanitize(req.body && req.body.title);
  const category = sanitize(req.body && req.body.category, '🔮 COMMUNITY ALERT');
  const dateTag = sanitize(req.body && req.body.dateTag, 'TBA');
  const body = sanitize(req.body && req.body.body);
  const image =
    sanitize(req.body && req.body.image, 'assets/cookie_stamp_tee.png') ||
    'assets/cookie_stamp_tee.png';

  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'Announcement Title is required.',
    });
  }

  const record = {
    _id: 'ann-' + Date.now(),
    category,
    title,
    body,
    dateTag,
    image,
    createdAt: new Date(),
  };

  announcementMemory.deployed.unshift(record);

  return res.status(201).json({
    success: true,
    message: 'Announcement deployed to the live creator feed.',
    data: record,
  });
}

module.exports = { getAnnouncements, addAnnouncement };