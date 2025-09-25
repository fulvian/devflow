#!/usr/bin/env node
/**
 * Phase 1 Test Runner - Enhanced Project Memory System
 * Validates implementation and demonstrates Phase 1 capabilities
 * Usage: npx ts-node src/core/semantic-memory/phase1-test-runner.ts
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';

async function runPhase1Demo() {
  console.log('\n🚀 Enhanced Project Memory System - Phase 1 Demo\n');
  console.log('═'.repeat(60));

  const memorySystem = new EnhancedProjectMemorySystem({
    enableClustering: true,
    enablePerformanceMonitoring: true,
    autoMigration: true
  });

  try {
    // Step 1: Initialize system
    console.log('\n📋 Step 1: System Initialization');
    console.log('-'.repeat(40));

    const initResult = await memorySystem.initialize();

    if (!initResult.success) {
      console.error('❌ Initialization failed:', initResult.error);
      console.log('\n💡 Recommendations:');
      if (initResult.data?.issues) {
        initResult.data.issues.forEach(issue => console.log(`   • ${issue}`));
      }
      if (initResult.data?.recommendations) {
        initResult.data.recommendations.forEach(rec => console.log(`   • ${rec}`));
      }
      return;
    }

    console.log('✅ System initialized successfully');
    console.log(`   Duration: ${initResult.performanceMetrics?.duration.toFixed(2)}ms`);

    // Step 2: Store sample memories
    console.log('\n💾 Step 2: Storing Sample Memories');
    console.log('-'.repeat(40));

    const sampleMemories = [
      {
        content: 'Implement user authentication system with JWT tokens and role-based access control',
        contentType: 'task' as const,
        projectId: 1,
        metadata: { priority: 'high', category: 'security' }
      },
      {
        content: 'Optimize database queries for better performance using indexes and query optimization',
        contentType: 'task' as const,
        projectId: 1,
        metadata: { priority: 'medium', category: 'performance' }
      },
      {
        content: 'Create responsive UI components with React and TypeScript for better user experience',
        contentType: 'task' as const,
        projectId: 1,
        metadata: { priority: 'medium', category: 'frontend' }
      },
      {
        content: 'Set up automated testing pipeline with Jest and continuous integration',
        contentType: 'task' as const,
        projectId: 1,
        metadata: { priority: 'high', category: 'testing' }
      },
      {
        content: 'Design microservices architecture for scalable backend system',
        contentType: 'decision' as const,
        projectId: 1,
        metadata: { impact: 'high', stakeholders: ['backend-team', 'devops'] }
      }
    ];

    for (const memory of sampleMemories) {
      const result = await memorySystem.storeMemory(memory);
      if (result.success) {
        console.log(`✅ Stored: ${memory.content.substring(0, 50)}...`);
        console.log(`   Hash: ${result.data}`);
        console.log(`   Duration: ${result.performanceMetrics?.duration.toFixed(2)}ms`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    }

    // Step 3: Perform semantic search
    console.log('\n🔍 Step 3: Semantic Search Demo');
    console.log('-'.repeat(40));

    const searchQueries = [
      'authentication and security implementation',
      'frontend user interface components',
      'database performance optimization'
    ];

    for (const query of searchQueries) {
      console.log(`\n🔍 Searching: "${query}"`);

      const searchResult = await memorySystem.searchMemories({
        query,
        projectId: 1,
        limit: 3,
        similarityThreshold: 0.5
      });

      if (searchResult.success && searchResult.data) {
        console.log(`✅ Found ${searchResult.data.length} results`);
        console.log(`   Duration: ${searchResult.performanceMetrics?.duration.toFixed(2)}ms`);

        searchResult.data.forEach((result, index) => {
          console.log(`   ${index + 1}. [${result.similarity.toFixed(3)}] ${result.memory.content.substring(0, 60)}...`);
        });
      } else {
        console.log(`❌ Search failed: ${searchResult.error}`);
      }
    }

    // Step 4: Memory clustering
    console.log('\n🧠 Step 4: Memory Clustering');
    console.log('-'.repeat(40));

    const clusterResult = await memorySystem.getProjectClusters(1);

    if (clusterResult.success && clusterResult.data) {
      console.log(`✅ Generated ${clusterResult.data.length} clusters`);

      clusterResult.data.forEach((cluster, index) => {
        console.log(`   ${index + 1}. ${cluster.clusterName} (${cluster.clusterSize} memories)`);
        console.log(`      Relevance: ${cluster.relevanceScore.toFixed(3)}`);
        console.log(`      Memory IDs: ${cluster.memoryIds.slice(0, 3).join(', ')}${cluster.memoryIds.length > 3 ? '...' : ''}`);
      });
    } else {
      console.log(`❌ Clustering failed: ${clusterResult.error}`);
    }

    // Step 5: Project statistics
    console.log('\n📊 Step 5: Project Statistics');
    console.log('-'.repeat(40));

    const statsResult = await memorySystem.getProjectStats(1);

    if (statsResult.success && statsResult.data) {
      const stats = statsResult.data;
      console.log('✅ Project Memory Statistics:');
      console.log(`   Total Memories: ${stats.totalMemories}`);
      console.log(`   Total Clusters: ${stats.totalClusters}`);
      console.log(`   Average Similarity: ${stats.averageSimilarity.toFixed(3)}`);
      console.log(`   Storage Efficiency: ${stats.storageEfficiency.toFixed(3)}`);
      console.log(`   Last Clustering: ${stats.lastClusteringUpdate?.toISOString() || 'Never'}`);
    } else {
      console.log(`❌ Stats calculation failed: ${statsResult.error}`);
    }

    // Step 6: Context recommendations
    console.log('\n💡 Step 6: Context Recommendations');
    console.log('-'.repeat(40));

    const recommendationsResult = await memorySystem.getContextRecommendations(
      1,
      'Need to implement user login and authentication for the web application',
      3
    );

    if (recommendationsResult.success && recommendationsResult.data) {
      console.log('✅ Context Recommendations:');
      recommendationsResult.data.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.similarity.toFixed(3)}] ${rec.memory.content.substring(0, 80)}...`);
        console.log(`      Type: ${rec.memory.contentType} | Created: ${rec.memory.createdAt.toISOString().split('T')[0]}`);
      });
    } else {
      console.log(`❌ Recommendations failed: ${recommendationsResult.error}`);
    }

    // Step 7: System health check
    console.log('\n🏥 Step 7: System Health Check');
    console.log('-'.repeat(40));

    const healthResult = await memorySystem.runHealthCheck(1);

    if (healthResult.success && healthResult.data) {
      const { systemHealth, benchmarkResults } = healthResult.data;

      console.log('✅ System Health:');
      console.log(`   Total Memories: ${systemHealth.totalMemories}`);
      console.log(`   Total Clusters: ${systemHealth.totalClusters}`);
      console.log(`   Storage Size: ${(systemHealth.storageSize / 1024).toFixed(2)} KB`);
      console.log(`   Memory Range: ${systemHealth.oldestMemory?.toISOString().split('T')[0]} - ${systemHealth.newestMemory?.toISOString().split('T')[0]}`);

      if (benchmarkResults) {
        console.log('\n📈 Performance Benchmarks:');
        console.log(`   Overall Score: ${benchmarkResults.overallScore}/100`);
        console.log(`   Embedding Generation: ${benchmarkResults.embeddingGeneration.averageTime.toFixed(2)}ms (target: ${benchmarkResults.embeddingGeneration.targetTime}ms) ${benchmarkResults.embeddingGeneration.passed ? '✅' : '❌'}`);
        console.log(`   Memory Storage: ${benchmarkResults.memoryStorage.averageTime.toFixed(2)}ms (target: ${benchmarkResults.memoryStorage.targetTime}ms) ${benchmarkResults.memoryStorage.passed ? '✅' : '❌'}`);
        console.log(`   Semantic Search: ${benchmarkResults.semanticSearch.averageTime.toFixed(2)}ms (target: ${benchmarkResults.semanticSearch.targetTime}ms) ${benchmarkResults.semanticSearch.passed ? '✅' : '❌'}`);

        if (benchmarkResults.recommendations.length > 0) {
          console.log('\n💡 Performance Recommendations:');
          benchmarkResults.recommendations.forEach(rec => console.log(`   • ${rec}`));
        }
      }
    } else {
      console.log(`❌ Health check failed: ${healthResult.error}`);
    }

  } catch (error) {
    console.error('\n💥 Demo failed with error:', error);
  } finally {
    // Cleanup
    await memorySystem.shutdown();
  }

  console.log('\n🎉 Phase 1 Demo Completed!');
  console.log('═'.repeat(60));
  console.log('\nPhase 1 Implementation Summary:');
  console.log('✅ Ollama embeddinggemma:300m integration (cost-free)');
  console.log('✅ Vector storage with SQLite BLOB format');
  console.log('✅ Semantic search with cosine similarity');
  console.log('✅ K-means clustering for content organization');
  console.log('✅ Database migration and validation utilities');
  console.log('✅ Performance benchmarking (<50ms search target)');
  console.log('✅ Unified integration service with error handling');
  console.log('\nReady for Phase 2: Intelligent Context Injection! 🚀');
}

// Run demo if called directly
if (require.main === module) {
  runPhase1Demo().catch(console.error);
}

export { runPhase1Demo };