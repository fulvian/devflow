#!/usr/bin/env node

// Delegate to intelligent-save-hook
const path = require('path');

// Import and execute the intelligent save hook
require(path.resolve(__dirname, 'intelligent-save-hook.js'));