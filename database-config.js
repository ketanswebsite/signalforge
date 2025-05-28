const path = require('path');

// Use persistent storage on Render, local path otherwise
const DB_PATH = process.env.RENDER 
  ? '/var/data/trades.db' 
  : path.join(__dirname, 'trades.db');

module.exports = { DB_PATH };