const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const { convertInr, priceLabel } = require('../middleware/currencyMiddleware');

// High-fidelity local payload returned instantly when the database layer is
// unreachable, so clients never wait on (or crash into) connection latency.
const FALLBACK_PRODUCTS = [
  // ---------- HOME / MERCH (Featured Drops) ----------
  { title: 'Cookie Bling Bucket Hat', priceInr: 2930, badge: '🔥 BESTSELLER', slug: 'bucket-hat', category: 'Merch', image: 'assets/cookie_bucket_hat.png' },
  { title: "Cookie Waterbottle '26", priceInr: 2734, badge: '❤️ MOST LOVED', slug: 'waterbottle', category: 'Merch', image: 'assets/cookie_waterbottle.png' },
  { title: 'Cookie Stamp Tee', priceInr: 3419, badge: '⭐ PREMIUM', slug: 'stamp-tee', category: 'Merch', image: 'assets/cookie_stamp_tee.png' },
  { title: 'Cookie Phone Case', priceInr: 1854, badge: '🔴 TRENDING', slug: 'phone-case', category: 'Merch', image: 'assets/cookie_phone_case.png' },
  // ---------- YOUTH SHOP ----------
  { title: 'Neon Chaos Hoodie', priceInr: 3499, badge: '🔥 HOT DROP', slug: 'neon-hoodie', category: 'Youth', image: 'https://picsum.photos/seed/youth1/400/530.jpg' },
  { title: 'Cookie Skate Deck', priceInr: 4999, badge: '⚡ LIMITED', slug: 'skate-deck', category: 'Youth', image: 'https://picsum.photos/seed/youth2/400/530.jpg' },
  { title: 'Wave Graphic Tee', priceInr: 1899, badge: '✨ NEW', slug: 'wave-tee', category: 'Youth', image: 'https://picsum.photos/seed/youth3/400/530.jpg' },
  { title: 'Street Cargo Pants', priceInr: 2799, badge: 'STANDARD', slug: 'street-cargos', category: 'Youth', image: 'https://picsum.photos/seed/youth4/400/530.jpg' },
  { title: 'Cookie Snapback', priceInr: 1499, badge: '✨ FRESH', slug: 'snapback', category: 'Youth', image: 'https://picsum.photos/seed/youth5/400/530.jpg' },
  { title: 'Tie Dye Chaos Tee', priceInr: 2199, badge: 'STANDARD', slug: 'tie-dye-tee', category: 'Youth', image: 'https://picsum.photos/seed/youth6/400/530.jpg' },
  // ---------- ADULTS COLLECTIONS ----------
  { title: 'The Monolith Jacket', priceInr: 8499, badge: 'SIGNATURE', slug: 'monolith-jacket', category: 'Adults', image: 'https://picsum.photos/seed/adults1/800/500.jpg' },
  { title: 'Void Lounge Set', priceInr: 6299, badge: 'HEAVYWEIGHT', slug: 'void-lounge', category: 'Adults', image: 'https://picsum.photos/seed/adults2/500/500.jpg' },
  { title: 'Shadow Cut Tee', priceInr: 2299, badge: 'STANDARD', slug: 'shadow-tee', category: 'Adults', image: 'https://picsum.photos/seed/adults3/350/467.jpg' },
  { title: 'Slate Cargo Shorts', priceInr: 3799, badge: 'STANDARD', slug: 'slate-cargo-shorts', category: 'Adults', image: 'https://picsum.photos/seed/adults4/350/467.jpg' },
  { title: 'Ghost Polo', priceInr: 2999, badge: 'STANDARD', slug: 'ghost-polo', category: 'Adults', image: 'https://picsum.photos/seed/adults5/350/467.jpg' },
  { title: 'Obsidian Hoodie', priceInr: 5199, badge: '🔥 BESTSELLER', slug: 'obsidian-hoodie', category: 'Adults', image: 'https://picsum.photos/seed/adults6/350/467.jpg' },
];

// ---------------------------------------------------------------------------
// Live in-memory upsert layer. Every CMS mutation lands here INSTANTLY so the
// System Central dashboard stays fully interactive even while the cloud replica
// set is offline. When MongoDB reconnects, writes are also mirrored to the DB.
// ---------------------------------------------------------------------------
const memoryStore = {
  products: [], // items deployed through the CMS while DB is unreachable
  deleted: new Set(), // slugs struck from the seed fallback pool this session
  priceOverrides: {}, // slug -> rewritten INR baseline
};

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';

const badgeFrom = (product) => {
  if (product.badge) return product.badge;
  const flags = Array.isArray(product.flags) ? product.flags : [];
  if (flags.includes('BESTSELLER')) return '🔥 BESTSELLER';
  if (flags.includes('TRENDING')) return '🔴 TRENDING';
  return 'STANDARD';
};

const normalizeCategory = (category) => {
  const map = {
    'featured drops': 'Merch',
    featured: 'Merch',
    merch: 'Merch',
    'youth shop': 'Youth',
    youth: 'Youth',
    'adults collections': 'Adults',
    adults: 'Adults',
  };
  return map[String(category || '').toLowerCase().trim()] || null;
};

const flagsFromBadge = (badge) => {
  const b = String(badge || '').toUpperCase();
  const flags = [];
  if (b.includes('BESTSELLER')) flags.push('BESTSELLER');
  if (b.includes('TRENDING')) flags.push('TRENDING');
  return flags;
};

const toSizes = (sizes) => {
  if (Array.isArray(sizes)) {
    return sizes.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(sizes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

// Gallery paths arrive as a native array from the CMS. Accept comma-delimited
// strings too so any single hardcoded image variable can never shadow the array.
const toImages = (images) => {
  if (!images) return [];
  const list = Array.isArray(images) ? images : String(images).split(',');
  return list.map((s) => String(s).trim()).filter(Boolean);
};

const buildFallbackPayload = (currency) => {
  const merged = [
    ...memoryStore.products,
    ...FALLBACK_PRODUCTS.filter((p) => !memoryStore.deleted.has(p.slug)),
  ];
  const data = merged.map((p) => {
    const priceInr = memoryStore.priceOverrides[p.slug] ?? p.priceInr;
    return {
      title: p.title,
      priceInr,
      badge: badgeFrom(p),
      slug: p.slug,
      category: p.category || 'Merch',
      sizes: p.sizes || [],
      image: (Array.isArray(p.images) ? p.images[0] : p.image) || null,
      images: Array.isArray(p.images) && p.images.length
        ? p.images
        : (p.image ? [p.image] : []),
      price: priceInr,
      priceLabel: priceLabel(priceInr, currency.code),
    };
  });
  return {
    success: true,
    fallback: true,
    count: data.length,
    currency: { code: currency.code, symbol: currency.symbol, rate: currency.rate },
    data,
  };
};

const toPublicShape = (p) => ({
  id: p._id ? p._id.toString() : 'mem-' + p.slug,
  name: p.title || p.name,
  slug: p.slug,
  category: p.category,
  priceInr: p.priceInr,
  price: convertInr(p.priceInr, 'INR'),
  priceLabel: priceLabel(p.priceInr, 'INR'),
  stock: p.stock,
  flags: p.flags,
  image: p.image || (Array.isArray(p.images) ? p.images[0] : undefined),
  images: Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []),
  sizes: p.sizes || [],
  badge: badgeFrom(p),
});

// GET /api/products?currency=USD&category=Adults
// Server computes every price out of the INR baseline — no client-side math.
const getProducts = asyncHandler(async (req, res) => {
  const currency = req.currency || { code: 'INR', symbol: '₹' };
  const { category } = req.query;
  const normCat = normalizeCategory(category);

  // Fast bypass: no live topology means skip buffering entirely and serve the
  // fallback instantly (kills the "buffering timed out" latency loop).
  if (mongoose.connection.readyState !== 1) {
    return res.status(200).json(buildFallbackPayload(currency));
  }

  const filter = { isActive: true };
  if (normCat) filter.category = normCat;

  try {
    const docs = await Product.find(filter).sort({ createdAt: 1 }).timeout(2000);

    const memList = memoryStore.products.filter(
      (p) => !normCat || p.category === normCat
    );
    const products = [
      ...memList.map(toPublicShape),
      ...docs.map((p) => toPublicShape(p)),
    ];

    res.json({
      success: true,
      count: products.length,
      currency: { code: currency.code, symbol: currency.symbol, rate: currency.rate },
      products,
    });
  } catch (error) {
    console.warn('⚠️ Database unavailable. Using high-fidelity product fallback layer data arrays.');
    return res.status(200).json(buildFallbackPayload(currency));
  }
});

// POST /api/products/add
// Deploys a new merchandise packet into the live catalog. Pays no attention to
// whether MongoDB is online — memory layer keeps the response instant either way.
const addProduct = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || body.name || '').trim();
  const priceInr = Math.round(Number(body.priceInr ?? body.basePriceInr ?? NaN));
  const category = normalizeCategory(body.category);

  if (!title) {
    return res.status(400).json({ success: false, message: 'Product title is required.' });
  }
  if (!Number.isFinite(priceInr) || priceInr < 1) {
    return res.status(400).json({ success: false, message: 'Base price must be a positive number.' });
  }
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category must resolve to Youth, Adults, or Merch.' });
  }

  let slug = slugify(title);
  const slugTaken = (candidate) =>
    memoryStore.products.some((p) => p.slug === candidate) ||
    FALLBACK_PRODUCTS.some((p) => p.slug === candidate) ||
    memoryStore.deleted.has(candidate);
  while (slugTaken(slug)) {
    slug = slugify(title) + '-' + String(Date.now()).slice(-4);
  }

  const record = {
    title,
    slug,
    category,
    priceInr,
    stock: Math.max(0, Math.round(Number(body.stock ?? 0)) || 0),
    flags: flagsFromBadge(body.badge),
    badge: String(body.badge || 'STANDARD'),
    description: String(body.description || '').trim(),
    images: toImages(body.images),
    sizes: toSizes(body.sizes || (body.sizings || '')),
  };

  if (mongoose.connection.readyState !== 1) {
    memoryStore.products.unshift(record);
    return res.status(201).json({
      success: true,
      fallback: true,
      message: 'Product deployed to live catalog (memory layer — cloud database offline).',
      product: toPublicShape(record),
    });
  }

  const doc = await Product.create({
    name: record.title,
    slug: record.slug,
    category: record.category,
    priceInr: record.priceInr,
    stock: record.stock,
    flags: record.flags,
    description: record.description,
    image: record.images[0] || '',
    images: record.images,
    sizes: record.sizes,
  });
  return res.status(201).json({
    success: true,
    message: 'Product deployed to live catalog.',
    product: toPublicShape(doc),
  });
});

// DELETE /api/products/delete/:id
// Accepts a Mongo ObjectId or a slug. Strikes the item from both the memory
// layer and (when reachable) the MongoDB collection.
const deleteProduct = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(400).json({ success: false, message: 'Product identifier is required.' });
  }

  const inSeeds = FALLBACK_PRODUCTS.some((p) => p.slug === id);
  const wasCmsItem =
    id.startsWith('mem-') ||
    inSeeds ||
    memoryStore.products.some((p) => p.slug === id);
  memoryStore.products = memoryStore.products.filter(
    (p) => p.slug !== id && 'mem-' + p.slug !== id
  );
  memoryStore.deleted.add(id);
  delete memoryStore.priceOverrides[id];

  let dbRemoved = false;
  if (mongoose.connection.readyState === 1) {
    const isObj = mongoose.isValidObjectId(id);
    if (isObj) {
      dbRemoved = !!(await Product.findByIdAndDelete(id));
    } else {
      dbRemoved = !!(await Product.findOneAndDelete({ slug: id }));
    }
  }

  if (!wasCmsItem && !dbRemoved) {
    return res.status(404).json({ success: false, message: 'No matching product found in catalog.' });
  }
  return res.json({
    success: true,
    message: 'Product struck from live retail inventories.',
    removed: { id, memory: wasCmsItem, database: dbRemoved },
  });
});

// PATCH /api/products/:id/price
// Rewrites the baseline INR price from the System Central console.
const updateProductPrice = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim();
  const priceInr = Math.round(Number((req.body || {}).priceInr ?? NaN));
  if (!Number.isFinite(priceInr) || priceInr < 1) {
    return res.status(400).json({ success: false, message: 'priceInr must be a positive number.' });
  }

  const memIdx = memoryStore.products.findIndex((p) => p.slug === id || 'mem-' + p.slug === id);
  if (memIdx !== -1) memoryStore.products[memIdx].priceInr = priceInr;
  memoryStore.priceOverrides[id] = priceInr;

  let dbUpdated = false;
  if (mongoose.connection.readyState === 1) {
    const isObj = mongoose.isValidObjectId(id);
    const updated = isObj
      ? await Product.findByIdAndUpdate(id, { $set: { priceInr } }, { new: true })
      : await Product.findOneAndUpdate({ slug: id }, { $set: { priceInr } }, { new: true });
    dbUpdated = !!updated;
  }

  return res.json({
    success: true,
    message: 'Baseline price rewritten.',
    priceInr,
    memory: true,
    database: dbUpdated,
  });
});

module.exports = { getProducts, addProduct, deleteProduct, updateProductPrice };