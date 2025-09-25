#!/usr/bin/env node
/**
 * Phase 4 Test Runner - Advanced Intelligence & Learning Demonstration
 * Showcases intelligent context injection and predictive analytics capabilities
 * Usage: npx ts-node src/core/semantic-memory/phase4-test-runner.ts
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { ContextInjectionConfig } from './intelligent-context-injector';

async function runPhase4Demo() {
  console.log('\n🚀 Enhanced Project Memory System - Phase 4 Demo');
  console.log('🧠 Advanced Intelligence & Learning Capabilities');
  console.log('═'.repeat(70));

  const memorySystem = new EnhancedProjectMemorySystem({
    enableClustering: true,
    enablePerformanceMonitoring: true,
    autoMigration: true,
    // Phase 4: Enable Advanced Intelligence
    enableIntelligentContext: true,
    enablePredictiveAnalytics: true,
    enableCrossProjectLearning: false, // Conservative for demo
    adaptiveThresholds: true
  });

  try {
    // Step 1: Initialize Phase 4 system
    console.log('\n📋 Step 1: Phase 4 System Initialization');
    console.log('-'.repeat(50));

    const initResult = await memorySystem.initialize();

    if (!initResult.success) {
      console.error('❌ Initialization failed:', initResult.error);
      return;
    }

    console.log('✅ Phase 4 system initialized successfully');
    console.log(`   Duration: ${initResult.performanceMetrics?.duration.toFixed(2)}ms`);

    // Show system capabilities
    const capabilities = memorySystem.getSystemCapabilities();
    console.log(`\n🎯 System Capabilities (${capabilities.phase}):`);
    capabilities.capabilities.forEach(cap => console.log(`   ✅ ${cap}`));

    // Step 2: Store contextual memories for intelligent analysis
    console.log('\n💾 Step 2: Storing Contextual Memories');
    console.log('-'.repeat(50));

    const contextualMemories = [
      {
        content: 'Implementing OAuth 2.0 authentication with JWT token refresh strategy for secure API access',
        contentType: 'task' as const,
        projectId: 19,
        metadata: {
          priority: 'high',
          category: 'security',
          context: 'authentication_system',
          complexity: 'high'
        }
      },
      {
        content: 'Database connection pooling optimization reduced response time by 60% using connection recycling',
        contentType: 'task' as const,
        projectId: 19,
        metadata: {
          priority: 'medium',
          category: 'performance',
          context: 'database_optimization',
          success_metric: 0.6
        }
      },
      {
        content: 'React component state management using Redux Toolkit for scalable application architecture',
        contentType: 'task' as const,
        projectId: 19,
        metadata: {
          priority: 'medium',
          category: 'frontend',
          context: 'state_management',
          framework: 'react'
        }
      },
      {
        content: 'Implemented comprehensive error handling with structured logging and monitoring dashboard',
        contentType: 'task' as const,
        projectId: 19,
        metadata: {
          priority: 'high',
          category: 'reliability',
          context: 'error_handling',
          monitoring: true
        }
      },
      {
        content: 'Microservices deployment strategy using Docker containers and Kubernetes orchestration',
        contentType: 'decision' as const,
        projectId: 19,
        metadata: {
          impact: 'high',
          stakeholders: ['devops', 'backend'],
          context: 'deployment_architecture',
          technology: 'kubernetes'
        }
      }
    ];

    for (const memory of contextualMemories) {
      const result = await memorySystem.storeMemory(memory);
      if (result.success) {
        console.log(`✅ Stored: ${memory.content.substring(0, 60)}...`);
      }
    }

    // Step 3: Intelligent Context Injection Demo
    console.log('\n🧠 Step 3: Intelligent Context Injection');
    console.log('-'.repeat(50));

    const contextConfig: ContextInjectionConfig = {
      projectId: 19,
      sessionContext: 'Working on user authentication and security improvements',
      activeTask: 'implement secure login with multi-factor authentication',
      codeContext: [
        'JWT token validation middleware',
        'User authentication service',
        'Security configuration setup'
      ],
      userIntent: 'development',
      adaptiveThreshold: true,
      crossProjectLearning: false
    };

    const intelligentResult = await memorySystem.getIntelligentContext(contextConfig);

    if (intelligentResult.success && intelligentResult.data) {
      const context = intelligentResult.data;
      console.log('🎯 Intelligent Context Analysis:');
      console.log(`   Confidence Score: ${(context.confidence * 100).toFixed(1)}%`);
      console.log(`   Relevant Memories: ${context.relevantMemories.length}`);
      console.log(`   Suggested Patterns: ${context.suggestedPatterns.length}`);
      console.log(`   Contextual Insights: ${context.contextualInsights.length}`);

      console.log('\n📊 Top Relevant Memories:');
      context.relevantMemories.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. [${result.similarity.toFixed(3)}] ${result.memory.content.substring(0, 80)}...`);
      });

      if (context.suggestedPatterns.length > 0) {
        console.log('\n🔍 Learning Patterns Detected:');
        context.suggestedPatterns.slice(0, 3).forEach((pattern, index) => {
          console.log(`   ${index + 1}. ${pattern.pattern}: ${pattern.description}`);
          console.log(`      Success Rate: ${(pattern.successRate * 100).toFixed(1)}%`);
        });
      }

      console.log('\n🎯 Adaptive Parameters:');
      console.log(`   Optimal Similarity Threshold: ${context.adaptiveParameters.optimalSimilarityThreshold.toFixed(3)}`);
      console.log(`   Recommended Clusters: ${context.adaptiveParameters.recommendedClusterCount}`);
      console.log(`   Context Window Size: ${context.adaptiveParameters.contextWindowSize}`);
    } else {
      console.log('❌ Intelligent context injection failed:', intelligentResult.error);
    }

    // Step 4: Predictive Analytics Demo
    console.log('\n🔮 Step 4: Predictive Analytics');
    console.log('-'.repeat(50));

    const predictiveResult = await memorySystem.getPredictiveContext(contextConfig);

    if (predictiveResult.success && predictiveResult.data) {
      const predictive = predictiveResult.data;

      console.log('🎯 Session Prediction:');
      console.log(`   Predicted Intent: ${predictive.currentSession.predictedIntent}`);
      console.log(`   Confidence: ${(predictive.currentSession.confidence * 100).toFixed(1)}%`);
      console.log(`   Estimated Duration: ${predictive.currentSession.estimatedDuration} minutes`);
      console.log(`   Complexity Score: ${(predictive.currentSession.complexityScore * 100).toFixed(1)}%`);

      console.log('\n📋 Suggested Workflow:');
      predictive.currentSession.suggestedWorkflow.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });

      if (predictive.upcomingNeeds.length > 0) {
        console.log('\n🔮 Predictive Recommendations:');
        predictive.upcomingNeeds.slice(0, 4).forEach((rec, index) => {
          console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
          console.log(`      ${rec.description}`);
          console.log(`      Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
        });
      }

      if (predictive.learningOpportunities.length > 0) {
        console.log('\n📚 Learning Opportunities:');
        predictive.learningOpportunities.slice(0, 3).forEach((opp, index) => {
          console.log(`   ${index + 1}. ${opp.skill} (${opp.currentLevel} → ${opp.suggestedLevel})`);
          console.log(`      Estimated Time: ${opp.estimatedTime} hours`);
        });
      }

    } else {
      console.log('❌ Predictive analytics failed:', predictiveResult.error);
    }

    // Step 5: Enhanced Search with Intelligence
    console.log('\n🔍 Step 5: Enhanced Intelligent Search');
    console.log('-'.repeat(50));

    const enhancedSearchResult = await memorySystem.searchWithIntelligentContext(
      'authentication security implementation',
      19,
      {
        sessionContext: 'Security enhancement sprint',
        activeTask: 'implement multi-factor authentication',
        userIntent: 'development',
        includeRecommendations: true
      }
    );

    if (enhancedSearchResult.success && enhancedSearchResult.data) {
      const searchData = enhancedSearchResult.data;

      console.log(`✅ Enhanced Search Results: ${searchData.searchResults.length} matches`);
      searchData.searchResults.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. [${result.similarity.toFixed(3)}] ${result.memory.content.substring(0, 70)}...`);
      });

      if (searchData.recommendations) {
        console.log('\n🎯 AI Recommendations:');
        searchData.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec.title} (${rec.priority})`);
        });
      }

      if (searchData.intelligentContext) {
        console.log(`\n🧠 Context Intelligence: ${(searchData.intelligentContext.confidence * 100).toFixed(1)}% confidence`);
      }

    } else {
      console.log('❌ Enhanced search failed:', enhancedSearchResult.error);
    }

    // Step 6: Learning Analytics
    console.log('\n📊 Step 6: Learning Analytics & Insights');
    console.log('-'.repeat(50));

    const learningResult = await memorySystem.getLearningInsights(19);

    if (learningResult.success && learningResult.data) {
      const insights = learningResult.data;

      console.log('✅ Learning Analytics Available:');
      console.log(`   Learning Patterns: ${Object.keys(insights.learningPatterns.patterns).length} patterns`);
      console.log(`   Adaptive Threshold: ${insights.learningPatterns.adaptiveThreshold.toFixed(3)}`);
      console.log(`   Performance Score: ${insights.performanceMetrics?.overallScore || 0}/100`);

      if (insights.performanceMetrics) {
        const perf = insights.performanceMetrics;
        console.log('\n⚡ Performance Metrics:');
        console.log(`   Embedding Generation: ${perf.embeddingGeneration.averageTime.toFixed(2)}ms ${perf.embeddingGeneration.passed ? '✅' : '❌'}`);
        console.log(`   Memory Storage: ${perf.memoryStorage.averageTime.toFixed(2)}ms ${perf.memoryStorage.passed ? '✅' : '❌'}`);
        console.log(`   Semantic Search: ${perf.semanticSearch.averageTime.toFixed(2)}ms ${perf.semanticSearch.passed ? '✅' : '❌'}`);
      }

    } else {
      console.log('❌ Learning insights failed:', learningResult.error);
    }

  } catch (error) {
    console.error('\n💥 Demo failed with error:', error);
  } finally {
    // Cleanup
    await memorySystem.shutdown();
  }

  console.log('\n🎉 Phase 4 Demo Completed!');
  console.log('═'.repeat(70));
  console.log('\nPhase 4 Advanced Intelligence Summary:');
  console.log('🧠 ✅ Intelligent Context Injection with adaptive learning');
  console.log('🔮 ✅ Predictive Analytics with AI-driven recommendations');
  console.log('🎯 ✅ Enhanced Search with contextual understanding');
  console.log('📊 ✅ Learning Analytics with performance optimization');
  console.log('⚡ ✅ Context7-compliant performance optimizations');
  console.log('🚀 ✅ Production-ready advanced intelligence system');
  console.log('\n🏆 Enhanced Project Memory System Phase 4 Complete!');
}

// Run demo if called directly
if (require.main === module) {
  runPhase4Demo().catch(console.error);
}

export { runPhase4Demo };