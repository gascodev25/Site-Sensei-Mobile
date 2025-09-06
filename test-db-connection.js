
import { db } from './server/db.js';
import { users } from './shared/schema.js';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    // Try a simple query
    const result = await db.select().from(users).limit(1);
    console.log('✅ Database connection successful!');
    console.log('Sample user count:', result.length);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    process.exit(0);
  }
}

testConnection();
