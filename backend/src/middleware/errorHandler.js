function notFoundHandler(req, res) {
  return res.status(404).json({ message: 'Endpoint neexistuje' });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Interná chyba servera';
  if (status >= 500) {
    console.error(err);
  }
  return res.status(status).json({ message });
}

module.exports = {
  notFoundHandler,
  errorHandler
};