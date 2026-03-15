function notFoundHandler(req, res) {
  return res.status(404).json({ message: 'Endpoint neexistuje' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  let message = err.message || 'Interná chyba servera';

  // Better response for CSRF errors (e.g. from iPhones/private mode)
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ 
      message: 'Platnosť relácie vypršala alebo bol zistený problém so zabezpečením (CSRF). Skúste stránku obnoviť (F5) alebo povoliť cookies.' 
    });
  }

  if (status >= 500) {
    console.error('[CRITICAL SERVER ERROR]', err);
    // In dev mode, provide at least the error type
    if (process.env.NODE_ENV !== 'production') {
      message = `${message} (Details: ${err.name} - ${err.message})`;
    }
  }
  return res.status(status).json({ message });
}

module.exports = {
  notFoundHandler,
  errorHandler
};