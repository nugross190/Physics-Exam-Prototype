require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./pool');

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(sql);
console.log('[migrate] schema applied');
