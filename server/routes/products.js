const express = require('express');
const {
  getProducts,
  addProduct,
  deleteProduct,
  updateProductPrice,
} = require('../controllers/productController');
const { attachCurrency, listCurrencies } = require('../middleware/currencyMiddleware');

const router = express.Router();

// Exchange-rate grid (same data the conversion core is built on).
router.get('/currencies', (_req, res) => {
  res.json({ success: true, currencies: listCurrencies() });
});

// --- CMS System Central write-channels ---
router.post('/add', addProduct);
router.delete('/delete/:id', deleteProduct);
router.patch('/:id/price', updateProductPrice);

// Live product catalog with server-side currency conversion.
router.get('/', attachCurrency, getProducts);

module.exports = router;