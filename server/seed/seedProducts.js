require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { connectDB } = require('../config/db');

const products = [
  // Featured (index.html) — category "Merch"
  { name: 'ACookieGod Classic Tee', slug: 'acookiegod-classic-tee', category: 'Merch', priceInr: 3419, stock: 50, flags: ['BESTSELLER'], description: 'The O.G. oversized tee, born from the 3D bake.' },
  { name: 'ACookieGod Wildride Waterbottle', slug: 'acookiegod-wildride-waterbottle', category: 'Merch', priceInr: 2734, stock: 40, flags: ['TRENDING'], description: 'Hydro flask for the wild-ride grind.' },
  { name: 'ACookieGod Bucket Hat', slug: 'acookiegod-bucket-hat', category: 'Merch', priceInr: 2930, stock: 30, flags: [], description: 'Street-ready headwear with the cookie crest.' },
  { name: 'ACookieGod Phone Case', slug: 'acookiegod-phone-case', category: 'Merch', priceInr: 1854, stock: 60, flags: ['TRENDING'], description: 'Drop-proof shell, golden-crumb print.' },

  // Youth collection (youth.html)
  { name: 'Comet Dreamer Tee', slug: 'youth-comet-dreamer-tee', category: 'Youth', priceInr: 3499, stock: 45, flags: [], description: 'Youth-cut oversized graphic tee.' },
  { name: 'Scram Crowd Crewneck', slug: 'youth-scram-crewneck', category: 'Youth', priceInr: 4999, stock: 25, flags: ['BESTSELLER'], description: 'Heavy-knit crewneck, crowd favorite.' },
  { name: 'Mini Crown Beanie', slug: 'youth-mini-crown-beanie', category: 'Youth', priceInr: 1899, stock: 70, flags: [], description: 'Cuffed beanie with mini crown patch.' },
  { name: 'Gridlock Hoodie', slug: 'youth-gridlock-hoodie', category: 'Youth', priceInr: 2799, stock: 35, flags: [], description: 'Urban-grid print hoodie.' },
  { name: 'Volt Snapback', slug: 'youth-volt-snapback', category: 'Youth', priceInr: 1499, stock: 55, flags: ['TRENDING'], description: 'Flat-brim snapback with volt branding.' },
  { name: 'Rumble Tank', slug: 'youth-rumble-tank', category: 'Youth', priceInr: 2199, stock: 40, flags: [], description: 'Sleeveless tank for warm sessions.' },

  // Adults collection (adults.html)
  { name: 'Monolith Oversized Tee', slug: 'monolith-oversized-tee', category: 'Adults', priceInr: 8499, stock: 20, flags: ['BESTSELLER'], description: 'Boxy premium drop from the Monolith line.' },
  { name: 'The Void Hoodie', slug: 'void-hoodie', category: 'Adults', priceInr: 6299, stock: 18, flags: [], description: 'Weighted fleece, void-black finish.' },
  { name: 'Shadow Runner Joggers', slug: 'shadow-runner-joggers', category: 'Adults', priceInr: 2299, stock: 32, flags: ['TRENDING'], description: 'Tapered joggers, tonal shadow weave.' },
  { name: 'Slate Oversized Hoodie', slug: 'slate-oversized-hoodie', category: 'Adults', priceInr: 3799, stock: 22, flags: [], description: 'Oversized slate hoodie, subtle crest.' },
  { name: 'Ghost Logo Tee', slug: 'ghost-logo-tee', category: 'Adults', priceInr: 2999, stock: 48, flags: [], description: 'Bleached ghost print on black cotton.' },
  { name: 'Obsidian Crest Tee', slug: 'obsidian-crest-tee', category: 'Adults', priceInr: 5199, stock: 28, flags: [], description: 'Crest-embroidered heavyweight tee.' },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('[seed] MONGO_URI missing — configure server/.env.');
    return false;
  }

  const connected = await connectDB();
  if (!connected) {
    console.warn('[seed] Database not reachable — no products written, process stayed alive.');
    return false;
  }

  for (const p of products) {
    await Product.updateOne({ slug: p.slug }, { $set: p }, { upsert: true });
  }
  console.log(`[seed] ${products.length} products upserted (idempotent).`);
  await mongoose.disconnect();
  console.log('[seed] done.');
  return true;
};

run().then((ok) => {
  if (mongoose.connection.readyState !== 0) mongoose.disconnect();
  if (!ok) process.exit(0);
});