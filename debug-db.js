const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function testDb() {
  console.log('Testing database connection...');
  try {
    const db = await open({
      filename: './data/devflow.sqlite',
      driver: sqlite3.Database
    });

    console.log('✅ Database opened successfully');
    await db.close();
    console.log('✅ Database closed successfully');
  } catch (error) {
    console.error('❌ Database error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
}

testDb();