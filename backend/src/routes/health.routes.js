const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;