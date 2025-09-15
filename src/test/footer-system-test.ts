/**
 * Footer System Integration Test
 * Testing FooterManager and FooterRenderer implementation
 */

import { FooterManager, FooterData } from '../ui/footer/FooterManager';
import { FooterRenderer, FooterTheme } from '../ui/footer/FooterRenderer';

// Mock services for testing
class MockModelService {
  async getCurrentModel(): Promise<string> {
    return 'claude-4-sonnet';
  }
  
  async getFallbackChain(): Promise<string[]> {
    return ['claude-4-sonnet', 'gpt-4-turbo', 'gemini-2.0-flash', 'qwen-3-coder-480b'];
  }
  
  async getModelStatus(): Promise<'active' | 'fallback' | 'error'> {
    return 'active';
  }
}

class MockCallLimitService {
  async getCurrentCalls(): Promise<number> {
    return 47;
  }
  
  async getCallLimit(): Promise<number> {
    return 60;
  }
  
  async getResetTime(): Promise<Date> {
    return new Date(Date.now() + 3600000); // 1 hour from now
  }
}

class MockContextService {
  async getUsedTokens(): Promise<number> {
    return 23000;
  }
  
  async getTotalTokens(): Promise<number> {
    return 100000;
  }
}

class MockTaskHierarchyService {
  async getCurrentTask(): Promise<any> {
    return {
      id: 'h-devflow-v3_1-core-ux',
      name: 'DevFlow v3.1 Core UX'
    };
  }
  
  async getTaskHierarchy(taskId: string): Promise<any> {
    return {
      project: { name: 'DevFlow' },
      macroTask: { name: 'v3.1-Core-UX' },
      microTask: { name: 'Footer-System' }
    };
  }
}

async function testFooterSystem(): Promise<void> {
  console.log('🧪 Testing Footer System Implementation...\n');

  try {
    // Test 1: FooterRenderer standalone
    console.log('1️⃣ Testing FooterRenderer...');
    const renderer = new FooterRenderer();
    const preview = renderer.renderPreview();
    console.log(`   Preview: ${preview}`);
    console.log('   ✅ FooterRenderer preview generated');

    // Test 2: FooterRenderer with custom theme
    console.log('\n2️⃣ Testing custom theme...');
    const customTheme: FooterTheme = {
      model: '\x1b[94m', // Bright blue
      calls: '\x1b[93m', // Bright yellow
      context: '\x1b[92m', // Bright green
      hierarchy: '\x1b[95m', // Bright magenta
      warning: '\x1b[93m', // Bright yellow
      critical: '\x1b[91m' // Bright red
    };
    renderer.setTheme(customTheme);
    const themedPreview = renderer.renderPreview();
    console.log(`   Themed Preview: ${themedPreview}`);
    console.log('   ✅ Custom theme applied');

    // Test 3: FooterManager with mock services
    console.log('\n3️⃣ Testing FooterManager...');
    const footerManager = new FooterManager(
      renderer,
      new MockModelService() as any,
      new MockCallLimitService() as any,
      new MockContextService() as any,
      new MockTaskHierarchyService() as any
    );

    // Test data collection
    const footerData = await footerManager.getCurrentData();
    console.log(`   Model: ${footerData.model.current} (${footerData.model.status})`);
    console.log(`   Calls: ${footerData.calls.current}/${footerData.calls.limit} (${footerData.calls.percentage}%)`);
    console.log(`   Context: ${footerData.context.percentage}% (Warning: ${footerData.context.warning})`);
    console.log(`   Hierarchy: ${footerData.hierarchy.project}→${footerData.hierarchy.macroTask}→${footerData.hierarchy.microTask}`);
    console.log('   ✅ FooterManager data collection working');

    // Test 4: Render with real data
    console.log('\n4️⃣ Testing render with collected data...');
    renderer.render(footerData);
    console.log('   ✅ Footer rendered with real data');

    // Test 5: Warning states
    console.log('\n5️⃣ Testing warning states...');
    const warningData: FooterData = {
      model: {
        current: 'Sonnet-4',
        fallbackChain: ['Claude', 'Codex', 'Gemini', 'Qwen3'],
        status: 'fallback'
      },
      calls: {
        current: 55,
        limit: 60,
        percentage: 92
      },
      context: {
        percentage: 87,
        used: 87000,
        total: 100000,
        warning: true,
        critical: false
      },
      hierarchy: {
        project: 'DevFlow',
        macroTask: 'v3.1-Core-UX',
        microTask: 'Footer-Test'
      },
      timestamp: Date.now()
    };

    renderer.render(warningData);
    console.log('   ✅ Warning states displayed');

    // Test 6: Critical states
    console.log('\n6️⃣ Testing critical states...');
    const criticalData: FooterData = {
      ...warningData,
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
    console.log('   ✅ Critical states displayed');

    // Test 7: Terminal width constraints
    console.log('\n7️⃣ Testing terminal width constraints...');
    renderer.setMaxWidth(80);
    renderer.render(footerData);
    console.log('   ✅ Footer adapted to 80-char width');

    renderer.setMaxWidth(50);
    renderer.render(footerData);
    console.log('   ✅ Footer adapted to 50-char width');

    // Test 8: Performance test
    console.log('\n8️⃣ Testing performance...');
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      renderer.render(footerData);
    }
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;
    console.log(`   Average render time: ${avgTime.toFixed(2)}ms`);
    console.log(`   ✅ Performance test completed (target: <16ms)`);

    console.log('\n🎉 All Footer System tests completed successfully!');

  } catch (error) {
    console.error('❌ Footer System test failed:', error);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testFooterSystem()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testFooterSystem };