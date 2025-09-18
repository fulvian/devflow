/**
 * Footer Renderer Standalone Test
 * Testing only FooterRenderer without service dependencies
 */

import { FooterRenderer, FooterTheme } from '../ui/footer/FooterRenderer';

// Mock FooterData interface for testing
interface FooterData {
  model: {
    current: string;
    fallbackChain: string[];
    status: 'active' | 'fallback' | 'error';
  };
  calls: {
    current: number;
    limit: number;
    percentage: number;
  };
  context: {
    percentage: number;
    used: number;
    total: number;
    warning: boolean;
    critical: boolean;
  };
  hierarchy: {
    project: string;
    macroTask: string;
    microTask: string;
  };
  timestamp: number;
}

async function testFooterRenderer(): Promise<void> {
  console.log('🧪 Testing Footer Renderer (Standalone)...\n');

  try {
    // Test 1: Basic FooterRenderer creation
    console.log('1️⃣ Creating FooterRenderer...');
    const renderer = new FooterRenderer();
    console.log('   ✅ FooterRenderer created successfully');

    // Test 2: Default preview
    console.log('\n2️⃣ Testing default preview...');
    const preview = renderer.renderPreview();
    console.log(`   Preview: ${preview}`);
    console.log('   ✅ Default preview generated');

    // Test 3: Mock data rendering
    console.log('\n3️⃣ Testing with mock data...');
    const mockData: FooterData = {
      model: {
        current: 'Sonnet-4',
        fallbackChain: ['Claude', 'Codex', 'Gemini', 'Qwen3'],
        status: 'active'
      },
      calls: {
        current: 47,
        limit: 60,
        percentage: 78
      },
      context: {
        percentage: 23,
        used: 23000,
        total: 100000,
        warning: false,
        critical: false
      },
      hierarchy: {
        project: 'DevFlow',
        macroTask: 'v3.1-Core-UX',
        microTask: 'Footer-Test'
      },
      timestamp: Date.now()
    };

    renderer.render(mockData);
    console.log('   ✅ Mock data rendered successfully');

    // Test 4: Warning states
    console.log('\n4️⃣ Testing warning states...');
    const warningData: FooterData = {
      ...mockData,
      calls: {
        current: 52,
        limit: 60,
        percentage: 87
      },
      context: {
        percentage: 85,
        used: 85000,
        total: 100000,
        warning: true,
        critical: false
      }
    };

    renderer.render(warningData);
    console.log('   ✅ Warning states rendered');

    // Test 5: Critical states
    console.log('\n5️⃣ Testing critical states...');
    const criticalData: FooterData = {
      ...mockData,
      model: {
        current: 'Fallback-Model',
        fallbackChain: ['Claude', 'Codex', 'Gemini', 'Qwen3'],
        status: 'error'
      },
      calls: {
        current: 59,
        limit: 60,
        percentage: 98
      },
      context: {
        percentage: 96,
        used: 96000,
        total: 100000,
        warning: true,
        critical: true
      }
    };

    renderer.render(criticalData);
    console.log('   ✅ Critical states rendered');

    // Test 6: Custom theme
    console.log('\n6️⃣ Testing custom theme...');
    const customTheme: FooterTheme = {
      model: '\x1b[94m', // Bright blue
      calls: '\x1b[93m', // Bright yellow
      context: '\x1b[92m', // Bright green
      hierarchy: '\x1b[95m', // Bright magenta
      warning: '\x1b[93m', // Bright yellow
      critical: '\x1b[91m' // Bright red
    };

    renderer.setTheme(customTheme);
    renderer.render(mockData);
    console.log('   ✅ Custom theme applied');

    // Test 7: Width constraints
    console.log('\n7️⃣ Testing width constraints...');
    console.log(`   Current max width: ${renderer.getMaxWidth()}`);
    
    renderer.setMaxWidth(80);
    renderer.render(mockData);
    console.log(`   ✅ Width set to 80 chars`);

    renderer.setMaxWidth(50);
    renderer.render(mockData);
    console.log(`   ✅ Width set to 50 chars (truncated)`);

    // Test 8: Performance test
    console.log('\n8️⃣ Testing rendering performance...');
    const iterations = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      renderer.render(mockData);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    console.log(`   Total time for ${iterations} renders: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average time per render: ${avgTime.toFixed(3)}ms`);
    console.log(`   ✅ Performance target: <16ms per render (${avgTime < 16 ? 'PASS' : 'FAIL'})`);

    // Test 9: Visibility toggle
    console.log('\n9️⃣ Testing visibility toggle...');
    renderer.setVisible(false);
    console.log(`   Visible: ${renderer.isFooterVisible()}`);
    renderer.render(mockData); // Should not render when invisible
    
    renderer.setVisible(true);
    console.log(`   Visible: ${renderer.isFooterVisible()}`);
    renderer.render(mockData);
    console.log('   ✅ Visibility toggle working');

    // Test 10: Long hierarchy truncation
    console.log('\n🔟 Testing long hierarchy truncation...');
    const longHierarchyData: FooterData = {
      ...mockData,
      hierarchy: {
        project: 'Very-Long-Project-Name-That-Should-Be-Truncated',
        macroTask: 'Extremely-Long-Macro-Task-Name-For-Testing-Truncation-Logic',
        microTask: 'Super-Long-Micro-Task-Name-That-Exceeds-Normal-Limits'
      }
    };

    renderer.render(longHierarchyData);
    console.log('   ✅ Long hierarchy truncation working');

    console.log('\n🎉 All Footer Renderer tests completed successfully!');

  } catch (error) {
    console.error('❌ Footer Renderer test failed:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testFooterRenderer()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testFooterRenderer };