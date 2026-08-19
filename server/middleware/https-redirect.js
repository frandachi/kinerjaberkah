const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    const host = req.headers.host || '';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      const url = req.url;
      return res.redirect(301, `https://${host}${url}`);
    }
  }
  next();
};

module.exports = httpsRedirect;
