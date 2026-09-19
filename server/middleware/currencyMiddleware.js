/**
 * Single source of truth for supported currencies and INR → target conversion.
 *
 * Front-end no longer embeds exchange rates: it asks GET /api/products?currency=USD
 * (or /api/currencies for the raw grid) and renders `priceLabel` verbatim.
 * The drawer's client-side fallback still runs only when the API is unreachable.
 */
const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', rate: 1.0, label: 'Indian Rupee' },
  USD: { code: 'USD', symbol: '$', rate: 0.012, label: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', rate: 0.011, label: 'Euro' },
};

const listCurrencies = () => Object.values(CURRENCIES);

const getCurrency = (code) => CURRENCIES[String(code || 'INR').toUpperCase()] || null;

const convertInr = (priceInr, code) => {
  const c = getCurrency(code);
  return Math.round(Number(priceInr || 0) * (c ? c.rate : 1));
};

const priceLabel = (priceInr, code) => {
  const c = getCurrency(code);
  const value = convertInr(priceInr, c ? c.code : 'INR');
  const locale = c && c.code === 'INR' ? 'en-IN' : 'en-US';
  return `${c ? c.symbol : '₹'}${value.toLocaleString(locale)}`;
};

const attachCurrency = (req, _res, next) => {
  const code = String(req.query.currency || req.body.currency || 'INR').toUpperCase();
  req.currency = getCurrency(code) || getCurrency('INR');
  next();
};

module.exports = { CURRENCIES, listCurrencies, getCurrency, convertInr, priceLabel, attachCurrency };