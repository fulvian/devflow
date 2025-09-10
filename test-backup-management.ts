import { promises as fs } from 'fs';
import { join } from 'path';
import BackupManagerService from './packages/core/src/ml/BackupManagerService';

async function runBackupTests() {
  console.log('Starting BackupManager tests...');
  
  try {
    // Test 1: Create backup
    console.log('\n1. Testing backup creation...');
    const testContent = 'This is test content for backup';
    const backupId = await BackupManagerService.createBackup('TestService', 'test-file.txt', testContent);
    console.log(`✓ Created backup with ID: ${backupId}`);
    
    // Test 2: List backups
    console.log('\n2. Testing backup listing...');
    const backups = await BackupManagerService.listBackups('TestService');
    console.log(`✓ Found ${backups.length} backups for TestService`);
    
    // Test 3: Restore backup
    console.log('\n3. Testing backup restoration...');
    const restoredContent = await BackupManagerService.restoreBackup(backupId);
    if (restoredContent === testContent) {
      console.log('✓ Backup restoration successful');
    } else {
      console.error('✗ Backup restoration failed');
      return;
    }
    
    // Test 4: Create multiple backups to test cleanup
    console.log('\n4. Testing automatic cleanup...');
    for (let i = 0; i < 12; i++) {
      await BackupManagerService.createBackup('TestService', 'test-file.txt', `Test content ${i}`);
    }
    
    const afterCleanupBackups = await BackupManagerService.listBackups('TestService');
    if (afterCleanupBackups.length <= 10) {
      console.log('✓ Automatic cleanup working correctly');
    } else {
      console.error('✗ Automatic cleanup failed');
      return;
    }
    
    // Test 5: Remove backup
    console.log('\n5. Testing backup removal...');
    if (afterCleanupBackups.length > 0) {
      const removeResult = await BackupManagerService.removeBackup(afterCleanupBackups[0].id);
      if (removeResult) {
        console.log('✓ Backup removal successful');
      } else {
        console.error('✗ Backup removal failed');
        return;
      }
    }
    
    // Test 6: Verify .gitignore effectiveness
    console.log('\n6. Verifying .gitignore configuration...');
    const gitignoreContent = await fs.readFile('.gitignore', 'utf8');
    if (gitignoreContent.includes('*.bak') && gitignoreContent.includes('backups/')) {
      console.log('✓ .gitignore correctly configured');
    } else {
      console.error('✗ .gitignore configuration issue');
      return;
    }
    
    console.log('\n✅ All backup management tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    }
}

// Run tests
runBackupTests();
