const express = require('express');
const router = express.Router();

const {
  getAnnouncements,
  addAnnouncement,
} = require('../controllers/announcementController');

// GET /api/announcements — live creator feed stream
router.get('/', getAnnouncements);

// POST /api/announcements/add — CMS announcement deployer
router.post('/add', addAnnouncement);

module.exports = router;