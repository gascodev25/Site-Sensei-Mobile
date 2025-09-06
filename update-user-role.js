
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function updateUserRole() {
  try {
    // Update Gavin Green's role to super_user
    const result = await db
      .update(users)
      .set({ 
        roles: 'super_user',
        updatedAt: new Date()
      })
      .where(eq(users.id, '46493016'))
      .returning();

    if (result.length > 0) {
      console.log('✅ Successfully updated user role:', result[0]);
      console.log(`User ${result[0].email} now has roles: ${result[0].roles}`);
    } else {
      console.log('❌ No user found with that ID');
    }
  } catch (error) {
    console.error('❌ Error updating user role:', error);
  } finally {
    process.exit(0);
  }
}

updateUserRole();
