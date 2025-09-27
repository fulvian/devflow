/**
 * End-to-end tests for the UnifiedVerificationOrchestrator
 * 
 * This test suite validates the complete functionality of the verification system
 * including security vulnerability detection, code quality analysis, and reporting.
 */

import { UnifiedVerificationOrchestrator } from './UnifiedVerificationOrchestrator';
import { VerificationReport, Finding, Correction, VerificationLevel } from './types';

/**
 * Test class for end-to-end verification of the UnifiedVerificationOrchestrator
 */
export class EndToEndVerificationTest {
  private orchestrator: UnifiedVerificationOrchestrator;
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  constructor() {
    this.orchestrator = new UnifiedVerificationOrchestrator();
  }

  /**
   * Run all end-to-end tests
   */
  public async runAllTests(): Promise<void> {
    console.log('Starting end-to-end verification tests...\n');

    try {
      await this.testBasicVerification();
      await this.testStandardVerification();
      await this.testComprehensiveVerification();
      await this.testSecurityVulnerabilities();
      await this.testCodeQualityIssues();
      await this.testMetricsCollection();
      await this.testVerificationHistory();
      await this.testErrorHandling();
      
      this.reportTestResults();
    } catch (error) {
      console.error('Critical error during test execution:', error);
      throw error;
    }
  }

  /**
   * Test BASIC verification level
   */
  private async testBasicVerification(): Promise<void> {
    const testName = 'Basic Verification Level Test';
    try {
      const code = `
        function hello() {
          console.log("Hello World");
          return true;
        }
      `;
      
      const report = await this.orchestrator.executeVerification(code, VerificationLevel.BASIC);
      
      // Validate report structure
      if (!report.result) {
        throw new Error('Report result is missing');
      }
      
      if (!report.metrics) {
        throw new Error('Report metrics are missing');
      }
      
      if (!report.timestamp) {
        throw new Error('Report timestamp is missing');
      }
      
      // Validate findings structure if present
      if (report.result.findings) {
        for (const finding of report.result.findings) {
          if (!finding.id || !finding.type || !finding.severity || !finding.message) {
            throw new Error('Finding structure is invalid');
          }
        }
      }
      
      // Validate corrections structure if present
      if (report.result.corrections) {
        for (const correction of report.result.corrections) {
          if (!correction.id || !correction.description) {
            throw new Error('Correction structure is invalid');
          }
        }
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test STANDARD verification level
   */
  private async testStandardVerification(): Promise<void> {
    const testName = 'Standard Verification Level Test';
    try {
      const code = `
        function calculateSum(a, b) {
          if (a == b) {  // Should trigger quality issue (use ===)
            return a + b;
          }
          return 0;
        }
      `;
      
      const report = await this.orchestrator.executeVerification(code, VerificationLevel.STANDARD);
      
      if (!report.result || !report.metrics) {
        throw new Error('Report structure is invalid');
      }
      
      // Should have at least one finding for quality issues
      if (!report.result.findings || report.result.findings.length === 0) {
        throw new Error('Expected findings for quality issues');
      }
      
      const hasQualityFinding = report.result.findings.some(
        finding => finding.type === 'QUALITY'
      );
      
      if (!hasQualityFinding) {
        throw new Error('Expected code quality finding not found');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test COMPREHENSIVE verification level
   */
  private async testComprehensiveVerification(): Promise<void> {
    const testName = 'Comprehensive Verification Level Test';
    try {
      const code = `
        const fs = require('fs');
        const userInput = process.argv[2];
        
        function readFile() {
          // Security vulnerability: path traversal
          return fs.readFileSync('/etc/' + userInput, 'utf8');
        }
      `;
      
      const report = await this.orchestrator.executeVerification(code, VerificationLevel.COMPREHENSIVE);
      
      if (!report.result || !report.metrics) {
        throw new Error('Report structure is invalid');
      }
      
      // Should have findings for both security and quality
      if (!report.result.findings || report.result.findings.length < 2) {
        throw new Error('Expected multiple findings for comprehensive analysis');
      }
      
      const hasSecurityFinding = report.result.findings.some(
        finding => finding.type === 'SECURITY'
      );
      
      const hasQualityFinding = report.result.findings.some(
        finding => finding.type === 'QUALITY'
      );
      
      if (!hasSecurityFinding) {
        throw new Error('Expected security vulnerability finding not found');
      }
      
      if (!hasQualityFinding) {
        throw new Error('Expected code quality finding not found');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test security vulnerability detection
   */
  private async testSecurityVulnerabilities(): Promise<void> {
    const testName = 'Security Vulnerability Detection Test';
    try {
      // Example code with SQL injection vulnerability
      const vulnerableCode = `
        const mysql = require('mysql');
        
        function getUser(id) {
          const query = "SELECT * FROM users WHERE id = " + id;
          return connection.query(query);
        }
      `;
      
      const report = await this.orchestrator.executeVerification(vulnerableCode, VerificationLevel.COMPREHENSIVE);
      
      if (!report.result?.findings) {
        throw new Error('No findings returned for vulnerable code');
      }
      
      const securityFindings = report.result.findings.filter(
        finding => finding.type === 'SECURITY'
      );
      
      if (securityFindings.length === 0) {
        throw new Error('Security vulnerability not detected');
      }
      
      // Validate finding structure
      const finding = securityFindings[0];
      if (!finding.id || !finding.severity || !finding.message) {
        throw new Error('Security finding structure is invalid');
      }
      
      // Validate high severity for security issues
      if (finding.severity !== 'HIGH' && finding.severity !== 'CRITICAL') {
        throw new Error('Security vulnerability should have high severity');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test code quality issue detection
   */
  private async testCodeQualityIssues(): Promise<void> {
    const testName = 'Code Quality Issue Detection Test';
    try {
      // Poor quality code example
      const poorQualityCode = `
        function processData(data) {
          var result = [];
          for (i = 0; i < data.length; i++) {  // No variable declaration
            if (data[i] != null) {  // Should use !==
              result.push(data[i]);
            }
          }
          return result;
        }
      `;
      
      const report = await this.orchestrator.executeVerification(poorQualityCode, VerificationLevel.STANDARD);
      
      if (!report.result?.findings) {
        throw new Error('No findings returned for poor quality code');
      }
      
      const qualityFindings = report.result.findings.filter(
        finding => finding.type === 'QUALITY'
      );
      
      if (qualityFindings.length === 0) {
        throw new Error('Code quality issues not detected');
      }
      
      // Validate finding structure
      const finding = qualityFindings[0];
      if (!finding.id || !finding.severity || !finding.message) {
        throw new Error('Quality finding structure is invalid');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test metrics collection
   */
  private async testMetricsCollection(): Promise<void> {
    const testName = 'Metrics Collection Test';
    try {
      const code = `
        function example() {
          return "test";
        }
      `;
      
      await this.orchestrator.executeVerification(code, VerificationLevel.BASIC);
      const metrics = this.orchestrator.getMetrics();
      
      if (!metrics) {
        throw new Error('Metrics not collected');
      }
      
      if (typeof metrics.totalVerifications !== 'number' || metrics.totalVerifications < 1) {
        throw new Error('Total verifications metric is invalid');
      }
      
      if (typeof metrics.performance.averageVerificationTime !== 'number') {
        throw new Error('Average verification time metric is invalid');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test verification history
   */
  private async testVerificationHistory(): Promise<void> {
    const testName = 'Verification History Test';
    try {
      const code = `
        function test() {
          return true;
        }
      `;
      
      await this.orchestrator.executeVerification(code, VerificationLevel.BASIC);
      const history = this.orchestrator.getVerificationHistory();
      
      if (!Array.isArray(history)) {
        throw new Error('Verification history is not an array');
      }
      
      if (history.length === 0) {
        throw new Error('Verification history is empty');
      }
      
      const lastEntry = history[history.length - 1];
      if (!lastEntry.timestamp || !lastEntry.level || !lastEntry.status) {
        throw new Error('Verification history entry structure is invalid');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling Test';
    try {
      // Test with invalid code that should cause an error
      const invalidCode = `
        function broken() {
          return 
        }  // Missing closing brace
      `;
      
      const report = await this.orchestrator.executeVerification(invalidCode, VerificationLevel.BASIC);
      
      // Should still return a report even with errors
      if (!report) {
        throw new Error('No report returned for invalid code');
      }
      
      // Status should be ERROR or still provide findings
      if (report.result?.status !== 'ERROR' &&
          (!report.result?.findings || report.result.findings.length === 0)) {
        throw new Error('Error handling did not produce expected results');
      }
      
      this.testResults.push({ name: testName, passed: true });
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Report comprehensive test results
   */
  private reportTestResults(): void {
    console.log('\n=== TEST RESULTS ===');
    let passedTests = 0;
    
    for (const result of this.testResults) {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status}: ${result.name}`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.passed) passedTests++;
    }
    
    console.log(`\nSummary: ${passedTests}/${this.testResults.length} tests passed`);
    
    if (passedTests === this.testResults.length) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Please review the output above.');
    }
  }
}

/**
 * Main function to run all tests
 */
export async function runUnifiedVerificationTests(): Promise<boolean> {
  console.log('🧪 Starting Unified Verification System End-to-End Tests...\n');

  try {
    const testSuite = new EndToEndVerificationTest();
    await testSuite.runAllTests();

    console.log('\n✅ Test suite completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    return false;
  }
}

// Export the test class for external use

// Run if executed directly
if (require.main === module) {
  runUnifiedVerificationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Failed to run tests:', error);
    process.exit(1);
  });
}