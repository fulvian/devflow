// Test file per trigger Unified Orchestrator (>50 righe)
// Questo dovrebbe automaticamente triggerare l'hook unified-orchestrator-bridge.py

const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.send('Hello DevFlow Test!');
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'This is a test API endpoint',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.post('/api/data', (req, res) => {
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Data is required' });
  }

  // Process data
  const processed = {
    received: data,
    processed: true,
    timestamp: new Date().toISOString()
  };

  res.json(processed);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});

// Additional test functions
function testFunction1() {
  console.log('Test function 1 executed');
  return 'result1';
}

function testFunction2() {
  console.log('Test function 2 executed');
  return 'result2';
}

// This file has more than 50 lines to trigger orchestrator routing
console.log('File created successfully - should trigger orchestrator!');

// Test cross-verification system
module.exports = { testFunction1, testFunction2 };