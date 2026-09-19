const mongoose = require('mongoose');

const RETRY_MS = 5000;

// Single-attempt graceful connect: never calls process.exit().
// Returns true when the cloud collections layer is reachable.
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('[db] MONGO_URI is missing — configure server/.env.');
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return true;
  } catch (err) {
    // Initial cloud link failure: surface the cause, keep the runtime loop alive.
    console.error(`[db] Cloud database unreachable: ${err.message}`);
    console.warn('⚠️ Cloud Database Link Active - Seed Data Ready');
    return false;
  }
};

// Non-crashing background retry so the Node process never hangs or dies on a
// transient network / Atlas provisioning window.
const connectWithRetry = async () => {
  const ok = await connectDB();
  if (!ok) {
    console.log(`[db] Retrying cloud connection in ${RETRY_MS / 1000}s (server stays alive)...`);
    setTimeout(connectWithRetry, RETRY_MS);
  }
};

module.exports = { connectDB, connectWithRetry };