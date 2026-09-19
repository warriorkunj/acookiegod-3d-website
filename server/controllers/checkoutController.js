const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { priceLabel, getCurrency } = require('../middleware/currencyMiddleware');

const FREE_SHIPPING_THRESHOLD_INR = 4999;
const FLAT_SHIPPING_INR = 199;

/**
 * POST /api/checkout/create-session
 *
 * Receives the client cart (slug + qty only — never client prices), verifies
 * every item and price server-side against the collections layer, reserves
 * inventory, persists an Order, and returns a mock gateway session id where a
 * real Stripe/Razorpay call is documented to plug in.
 */
const createSession = asyncHandler(async (req, res) => {
  const { items, email, currency } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('At least one cart item is required.');
    err.statusCode = 400;
    throw err;
  }

  const normalized = items.map((it) => ({
    slug: String((it.slug || '').trim()).toLowerCase(),
    qty: Number(it.qty),
  }));

  if (normalized.some((it) => !it.slug || !Number.isInteger(it.qty) || it.qty < 1)) {
    const err = new Error('Each item must include a valid slug and an integer qty >= 1.');
    err.statusCode = 400;
    throw err;
  }

  const slugs = [...new Set(normalized.map((it) => it.slug))];
  const products = await Product.find({ slug: { $in: slugs }, isActive: true });
  const productMap = new Map(products.map((p) => [p.slug, p]));

  const missing = slugs.filter((s) => !productMap.has(s));
  if (missing.length) {
    const err = new Error(`Unknown or inactive products: ${missing.join(', ')}`);
    err.statusCode = 404;
    throw err;
  }

  // Server-side price + stock verification with an atomic inventory reserve.
  const lineItems = [];
  for (const it of normalized) {
    const p = productMap.get(it.slug);
    if (p.stock < it.qty) {
      const err = new Error(`Insufficient stock for "${p.name}" (available: ${p.stock}).`);
      err.statusCode = 400;
      throw err;
    }
    const decremented = await Product.findOneAndUpdate(
      { _id: p._id, stock: { $gte: it.qty } },
      { $inc: { stock: -it.qty, soldCount: it.qty } },
      { new: true }
    );
    if (!decremented) {
      const err = new Error(`Stock changed for "${p.name}" — please refresh and retry.`);
      err.statusCode = 409;
      throw err;
    }
    lineItems.push({ product: p._id, slug: p.slug, name: p.name, qty: it.qty, priceInr: p.priceInr });
  }

  const subtotalInr = lineItems.reduce((sum, li) => sum + li.priceInr * li.qty, 0);
  const shippingInr = subtotalInr >= FREE_SHIPPING_THRESHOLD_INR || subtotalInr === 0 ? 0 : FLAT_SHIPPING_INR;
  const totalInr = subtotalInr + shippingInr;

  const sessionId = `cs_mock_${crypto.randomUUID()}`;
  const orderNumber = `ACG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const order = await Order.create({
    orderNumber,
    sessionId,
    items: lineItems,
    customerEmail: email ? String(email).toLowerCase().trim() : '',
    subtotalInr,
    shippingInr,
    totalInr,
    currencyCode: String(currency || 'INR').toUpperCase(),
    userId: req.user ? req.user._id : undefined,
    paymentStatus: 'pending',
  });

  const chosenCurrency = getCurrency(currency) || getCurrency('INR');

  // ------------------------------------------------------------------
  //  EXTERNAL GATEWAY HOOK — plug Stripe / Razorpay / local validation here.
  //
  //  1. Send the VERIFIED `subtotalInr` / `totalInr` and `lineItems` to the
  //     gateway (prices rebuilt server-side, client-supplied prices ignored,
  //     which defeats client-side parameter manipulation attacks).
  //  2. Capture the returned gateway reference (e.g. Stripe `session.id`)
  //     into `order.gatewayRef` and persist with `await order.save()`.
  //  3. On the provider webhook, flip `order.paymentStatus` to 'paid' and
  //     send `order.orderNumber` back to the success screen.
  // ------------------------------------------------------------------
  order.gatewayRef = `stub_${sessionId}`;
  await order.save();

  res.status(201).json({
    success: true,
    sessionId,
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    currency: { code: chosenCurrency.code, symbol: chosenCurrency.symbol },
    pricing: {
      subtotal: priceLabel(subtotalInr, chosenCurrency.code),
      shipping: shippingInr === 0 ? 'FREE' : priceLabel(shippingInr, chosenCurrency.code),
      total: priceLabel(totalInr, chosenCurrency.code),
      subtotalInr,
      shippingInr,
      totalInr,
    },
    items: lineItems.map((li) => ({
      name: li.name,
      slug: li.slug,
      qty: li.qty,
      unitPrice: priceLabel(li.priceInr, chosenCurrency.code),
      lineTotal: priceLabel(li.priceInr * li.qty, chosenCurrency.code),
    })),
  });
});

module.exports = { createSession };