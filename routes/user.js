const express = require('express');
const router = express.Router();

// Simple user routes
router.get('/', (req, res) => {
  res.json({ message: 'Users endpoint' });
});

module.exports = router;