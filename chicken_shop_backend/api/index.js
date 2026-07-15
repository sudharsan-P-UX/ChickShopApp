const app = require('../src/server');

module.exports = app;

// Disable built-in Vercel body parser to allow Multer to parse file uploads
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
