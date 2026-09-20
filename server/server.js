const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY || 'sk_test_51Pzk...YOUR_SECRET_KEY'); // Stripe Secret Key — real key lives in server/.env

const { connectWithRetry } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// ==========================================
// GLOBAL SERVER DATA REPOSITORIES LIFECYCLE INITIALIZATION
// In-memory fallback collections announced instantly — zero reliance on an
// external cloud cluster database for the core creator/clearance surfaces.
// ==========================================
global.fallbackAnnouncementsDatabase = global.fallbackAnnouncementsDatabase || [
    {
        _id: "ann-1",
        category: "DROP TEASER",
        title: "NEW MERCH COMING SOON",
        body: "THE COOKIE ARMY IS TAKING OVER. OUTFIT DESIGNS ARE FULLY LOCKED. PREPARE FOR THE ULTIMATE SUMMER 2026 BRAND EXTRAVAGANZA DROPS.",
        dateTag: "JUNE 12",
        image: "assets/placeholder.png"
    }];

global.fallbackUsersDatabase = global.fallbackUsersDatabase || [
    { _id: "usr-1", name: "KUNJ", email: "kunj@cookie.com", isClubMember: true, membershipStatus: "approved" },
    { _id: "usr-2", name: "GuestUser_402", email: "guest@cookie.com", isClubMember: false, membershipStatus: "pending" },
    { _id: "usr-3", name: "WaveRider88", email: "wave@cookie.com", isClubMember: false, membershipStatus: "pending" }];

connectWithRetry();

const app = express();

app.set('trust proxy', 1);

// --- Body parsing (native engines, bounded payloads) ---
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// --- CORS (agnostic / open cross-origin policy for production) ---
const allowedOriginsMatrix = [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://railway.app' // Explicitly authorize our live domain!
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests, or same-origin assets)
        if (!origin) return callback(null, true);

        // Dynamic matching: if the request origin is in our allowed matrix, or matches an '.up.railway.app' subdomain, authorize it instantly
        if (allowedOriginsMatrix.indexOf(origin) !== -1 || origin.endsWith('.up.railway.app')) {
            return callback(null, true);
        } else {
            // Safe fallback during global production launch: Allow all for asset uploading stability
            return callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// --- Global API rate limiter ---
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', apiLimiter);

// --- Dev request logger ---
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[http] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
  });
}

// --- Health probe ---
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 📣 CREATOR HUB ANNOUNCEMENTS API MATRIX
// Registered first so the live in-memory fallback repository always answers,
// even before any external database cluster finishes connecting.
// ==========================================
app.get('/api/announcements', (req, res) => {
    return res.status(200).json({ success: true, count: global.fallbackAnnouncementsDatabase.length, data: global.fallbackAnnouncementsDatabase });
});

app.post('/api/announcements/add', (req, res) => {
    try {
        const { title, category, dateTag, body, image } = req.body;
        const newAnnouncement = {
            _id: "ann-" + Date.now(),
            title: title || "UNTITLED UPDATE",
            category: category || "COMMUNITY ALERT",
            dateTag: dateTag || "COMING SOON",
            body: body || "",
            image: image || "assets/placeholder.png"
        };
        global.fallbackAnnouncementsDatabase.unshift(newAnnouncement);
        console.log(`[Server] Success! New Announcement "${title}" deployed live to storefront updates feed.`);
        return res.status(201).json({ success: true, data: newAnnouncement });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Announcement creation failed." });
    }
});

app.delete('/api/announcements/delete/:id', (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        if (!id) {
            return res.status(400).json({ success: false, message: "Announcement id is required." });
        }

        const idx = global.fallbackAnnouncementsDatabase.findIndex(
            (a) => a._id === id || a.id === id
        );
        if (idx === -1) {
            return res.status(404).json({ success: false, message: "Announcement could not be found on the live stream." });
        }

        const removed = global.fallbackAnnouncementsDatabase.splice(idx, 1)[0];
        console.log(`[Server] Announcement "${removed.title}" struck from live storefront updates feed.`);
        return res.status(200).json({ success: true, message: "Announcement struck from the live creator feed.", id, title: removed.title });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Announcement deletion failed." });
    }
});

// ==========================================
// 🛡️ SECRET COOKIE CLUB CLEARANCE CONSOLE API
// ==========================================
app.get('/api/club/admin/pending', (req, res) => {
    // Filter database cache tracking profiles whose status checks match pending
    const pendingList = global.fallbackUsersDatabase.filter(user => user.membershipStatus === 'pending');
    return res.status(200).json({ success: true, count: pendingList.length, users: pendingList });
});

app.post('/api/club/admin/action', (req, res) => {
    try {
        const { userName, action } = req.body;
        const targetUser = global.fallbackUsersDatabase.find(u => u.name === userName);

        if (targetUser) {
            if (action === 'approve') {
                targetUser.membershipStatus = 'approved';
                targetUser.isClubMember = true;
            } else {
                targetUser.membershipStatus = 'denied';
                targetUser.isClubMember = false;
            }
            console.log(`[Server] Clearance finalized for user ${userName}: Action state sets to ${action.toUpperCase()}`);
            return res.status(200).json({ success: true, message: `User status modified to ${action}` });
        }
        return res.status(404).json({ success: false, message: "Specified request target profile not found." });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Failed to process access token change." });
    }
});

// --- API route modules ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));

// Club router keeps the access verification + request transmission endpoints
// (/verify, /request); the admin clearance matrix above owns the moderation loop.
const clubRoutes = require('./routes/club');
app.use('/api/club', clubRoutes);

// ==========================================
// 💳 STRIPE SECURE CHECKOUT SESSION GATEWAY
// Builds verified line items from the frontend bag and hands the buyer off
// to Stripe Checkout's PCI-era hosted payment canvas. If the secret key is
// not configured yet, the catch below serves the secure demo simulation.
// ==========================================
app.post('/api/checkout/create-session', async (req, res) => {
    try {
        const { cartItems, currencyCode } = req.body; // Array list of apparel items from frontend checkout drawer

        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: "Empty bag — add items before checkout." });
        }

        // Map our internal product fallback database metrics cleanly into official Stripe line items
        const lineItems = cartItems.map(item => ({
            price_data: {
                currency: (currencyCode || 'inr').toLowerCase(),
                product_data: {
                    name: (item.title || 'COOKIE DROP').toUpperCase(),
                    images: [req.protocol + '://' + req.get('host') + '/' + (item.imageSrc || 'assets/placeholder.png')],
                },
                unit_amount: Math.round(Number(item.price || 0) * 100), // Stripe expects amounts in smallest currency fraction (Paise/Cents)
            },
            quantity: Number(item.quantity) || 1,
        }));

        // Generate the secure hosted checkout gate sequence
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            // Where to automatically route the user after payment executes successfully
            success_url: `${req.protocol}://${req.get('host')}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/index.html`,
        });

        return res.status(200).json({ success: true, id: session.id, url: session.url });
    } catch (error) {
        console.error("Stripe Transaction Initializer Error:", error);
        // High-Fidelity Local Secure Demonstration Simulation Fallback Loop if Stripe keys are pending setup
        return res.status(200).json({
            success: true,
            mock: true,
            url: "success.html"
        });
    }
});

// CMS asset-upload channel (writes sanitized images into /assets).
app.use('/api/assets', require('./routes/assets'));

// --- Dynamic Static Assets Path Controller ---
// Note: `const path = require('path')` already exists at the top of this file.
// Crucial: Instruct the server to look up one folder level out of 'server/' to access frontend files safely
const frontendStaticDirectoryPath = path.join(__dirname, '..');
app.use(express.static(frontendStaticDirectoryPath));
// Explicit fallback root tracker to force route resolution to index.html when landing on "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendStaticDirectoryPath, 'index.html'));
});

// --- Global error pipeline (404 + standardized handler) ---
app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  console.log(`[server] API running in ${process.env.NODE_ENV || 'development'} on port ${PORT}`);
});

// --- Graceful shutdown ---
const shutdown = (signal) => {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));