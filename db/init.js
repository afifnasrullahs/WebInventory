const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function initDatabase() {
  console.log('🔄 Initializing database schema...');
  
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    
    console.log('✅ Database schema initialized successfully!');
    console.log('');
    console.log('Tables created:');
    console.log('  - items');
    console.log('  - sets');
    console.log('  - set_items');
    console.log('  - transactions');
    console.log('  - transaction_details');
    console.log('  - transaction_item_breakdown');
    console.log('  - joki_services');
    console.log('  - joki_orders');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
