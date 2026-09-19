const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

const errorHandler = (err, _req, res, _next) => {
  let message = err.message || 'Server Error';
  let statusCode = err.statusCode || res.statusCode;

  if (statusCode < 400) statusCode = err.statusCode || 500;

  // Invalid Mongo ObjectId => treat as not found
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found (invalid identifier).';
  }
  // Mongoose schema validation failures
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(' | ');
  }
  // Unique index violations (email, slug, ...)
  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate value — this already exists.';
  }
  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON payload.';
  }
  if (err.message === 'Not allowed by CORS') statusCode = 403;

  // Standardized response grid; internal stack traces never leak in production
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };