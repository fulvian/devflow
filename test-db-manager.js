const { DatabaseManager } = require('./src/core/database/devflow-database');

async function testDb() {
  try {
    console.log('Creating DatabaseManager...');
    const db = new DatabaseManager();
    console.log('Calling initialize...');
    await db.initialize();
    console.log('✅ Success!');
    await db.close();
  } catch (error) {
    console.error('❌ Error details:');
    console.error('- Type:', typeof error);
    console.error('- Constructor:', error.constructor?.name);
    console.error('- Message:', error.message);
    console.error('- Stack:', error.stack);
    console.error('- Properties:', Object.getOwnPropertyNames(error));
    console.error('- Full error:', JSON.stringify(error, null, 2));
  }
}

testDb();