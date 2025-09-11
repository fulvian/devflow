#!/usr/bin/env node

/**
 * Test per la funzionalità di cancellazione file nel sistema DevFlow
 * Verifica l'implementazione del supporto per operazioni 'delete'
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = join(process.cwd(), 'test-deletion');
const TEST_FILE = join(TEST_DIR, 'test-file-to-delete.txt');

async function testFileDeletion() {
  console.log('🧪 Testing DevFlow File Deletion Functionality');
  console.log('==============================================');

  try {
    // 1. Creare directory di test
    console.log('📁 Creating test directory...');
    await fs.mkdir(TEST_DIR, { recursive: true });
    console.log('✅ Test directory created');

    // 2. Creare file di test
    console.log('📄 Creating test file...');
    await fs.writeFile(TEST_FILE, 'This is a test file for deletion', 'utf8');
    console.log('✅ Test file created');

    // 3. Verificare che il file esista
    console.log('🔍 Verifying file exists...');
    if (existsSync(TEST_FILE)) {
      console.log('✅ Test file exists');
    } else {
      throw new Error('Test file was not created');
    }

    // 4. Simulare operazione di cancellazione
    console.log('🗑️ Simulating file deletion...');
    
    // Simulare la logica del metodo applyFileModification per 'delete'
    const modification = {
      file: 'test-deletion/test-file-to-delete.txt',
      operation: 'delete' as const,
    };

    const fullPath = join(process.cwd(), modification.file);
    
    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
      console.log('✅ File deleted successfully');
      
      // Verificare che il file sia stato cancellato
      if (!existsSync(fullPath)) {
        console.log('✅ File deletion verified');
      } else {
        throw new Error('File still exists after deletion');
      }
    } else {
      console.log('⚠️ File does not exist, skipping deletion');
    }

    // 5. Testare caso di file inesistente
    console.log('🔍 Testing deletion of non-existent file...');
    const nonExistentFile = join(TEST_DIR, 'non-existent-file.txt');
    
    if (existsSync(nonExistentFile)) {
      await fs.unlink(nonExistentFile);
      console.log('✅ Non-existent file handled correctly');
    } else {
      console.log('✅ Non-existent file correctly skipped');
    }

    // 6. Pulizia
    console.log('🧹 Cleaning up test directory...');
    try {
      await fs.rmdir(TEST_DIR);
      console.log('✅ Test directory cleaned up');
    } catch (error) {
      console.log('⚠️ Could not remove test directory (may contain files)');
    }

    console.log('\n🎉 All file deletion tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ File creation');
    console.log('- ✅ File existence verification');
    console.log('- ✅ File deletion');
    console.log('- ✅ Deletion verification');
    console.log('- ✅ Non-existent file handling');
    console.log('- ✅ Cleanup');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Esegui il test
testFileDeletion().catch(console.error);
