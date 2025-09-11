#!/usr/bin/env node

/**
 * DevFlow Semantic Search Engine - Local Demo
 * 
 * Questo script dimostra il funzionamento del semantic search engine
 * installato localmente sulla tua macchina.
 */

import { SemanticSearchService } from './dist/memory/semantic.js';
import { SearchService } from './dist/memory/search.js';
import { VectorEmbeddingService } from './dist/ml/VectorEmbeddingService.js';
import { getDB, runInitialSchema, closeDB } from './dist/database/connection.js';
import { SQLiteMemoryManager } from './dist/memory/manager.js';

// Configurazione
const DEMO_DB_PATH = './demo-semantic-search.db';
const DEMO_CONTENT = [
  {
    content: 'Ottimizzazione database SQLite con indici e query efficienti',
    type: 'code',
    importance: 0.9
  },
  {
    content: 'Implementazione cache Redis per migliorare performance API',
    type: 'architecture',
    importance: 0.8
  },
  {
    content: 'Configurazione Docker per deployment containerizzato',
    type: 'devops',
    importance: 0.7
  },
  {
    content: 'Test automatizzati con Jest e coverage reporting',
    type: 'testing',
    importance: 0.6
  },
  {
    content: 'Machine Learning con PyTorch per classificazione testi',
    type: 'ml',
    importance: 0.9
  },
  {
    content: 'API REST con Express.js e middleware di autenticazione',
    type: 'backend',
    importance: 0.8
  },
  {
    content: 'Frontend React con TypeScript e componenti riutilizzabili',
    type: 'frontend',
    importance: 0.7
  },
  {
    content: 'Monitoraggio applicazioni con Prometheus e Grafana',
    type: 'monitoring',
    importance: 0.6
  }
];

async function setupDemo() {
  console.log('🚀 Setting up DevFlow Semantic Search Engine Demo...\n');
  
  // Inizializza database
  const db = getDB({ path: DEMO_DB_PATH });
  runInitialSchema(db);
  
  // Inizializza servizi
  const searchService = new SearchService(db);
  const vectorService = new VectorEmbeddingService('text-embedding-3-small', undefined, DEMO_DB_PATH);
  const semanticService = new SemanticSearchService(db, searchService, vectorService);
  const memoryManager = new SQLiteMemoryManager(db, vectorService);
  
  console.log('✅ Database e servizi inizializzati');
  
  // Verifica disponibilità vector search
  const vectorAvailable = vectorService.isVectorSearchAvailable();
  console.log(`🔍 Vector Search: ${vectorAvailable ? '✅ Disponibile' : '⚠️  Fallback a keyword-only'}`);
  
  return { db, searchService, vectorService, semanticService, memoryManager };
}

async function populateDemoData(memoryManager) {
  console.log('\n📝 Popolando database con dati demo...');
  
  const sessionId = 'demo-session-' + Date.now();
  
  for (const item of DEMO_CONTENT) {
    await memoryManager.createBlock({
      content: item.content,
      type: item.type,
      importanceScore: item.importance,
      sessionId,
      contextId: 'demo-context'
    });
  }
  
  console.log(`✅ Inseriti ${DEMO_CONTENT.length} blocchi di memoria`);
}

async function runSearchDemo(semanticService) {
  console.log('\n🔍 DEMO RICERCHE SEMANTICHE\n');
  
  const queries = [
    'database performance optimization',
    'machine learning implementation',
    'web development best practices',
    'monitoring and observability',
    'container deployment strategies'
  ];
  
  for (const query of queries) {
    console.log(`\n🔎 Query: "${query}"`);
    console.log('─'.repeat(50));
    
    try {
      // Hybrid search (keyword + semantic)
      const hybridResults = await semanticService.hybridSearch(query, {
        maxResults: 3,
        mode: 'hybrid'
      });
      
      console.log('🎯 Hybrid Search Results:');
      hybridResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.block.content.substring(0, 60)}...`);
        console.log(`     Similarity: ${result.similarity.toFixed(3)} | Type: ${result.block.type}`);
      });
      
      // Keyword-only search
      const keywordResults = await semanticService.keywordSearch(query, {
        maxResults: 3
      });
      
      console.log('\n📝 Keyword Search Results:');
      keywordResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.block.content.substring(0, 60)}...`);
        console.log(`     Score: ${result.scores.keyword.toFixed(3)} | Type: ${result.block.type}`);
      });
      
    } catch (error) {
      console.error(`❌ Errore nella ricerca: ${error.message}`);
    }
  }
}

async function runPerformanceTest(semanticService) {
  console.log('\n⚡ PERFORMANCE TEST\n');
  
  const testQuery = 'database optimization techniques';
  const iterations = 5;
  
  console.log(`Test: ${iterations} ricerche per query "${testQuery}"`);
  
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      await semanticService.hybridSearch(testQuery, { maxResults: 5 });
      const endTime = Date.now();
      const duration = endTime - startTime;
      times.push(duration);
      
      console.log(`  Iterazione ${i + 1}: ${duration}ms`);
    } catch (error) {
      console.error(`  Iterazione ${i + 1}: ERRORE - ${error.message}`);
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`\n📊 Risultati Performance:`);
    console.log(`  Tempo medio: ${avgTime.toFixed(2)}ms`);
    console.log(`  Tempo minimo: ${minTime}ms`);
    console.log(`  Tempo massimo: ${maxTime}ms`);
    console.log(`  Target (<200ms): ${avgTime < 200 ? '✅ RAGGIUNTO' : '❌ NON RAGGIUNTO'}`);
  }
}

async function cleanup(db) {
  console.log('\n🧹 Cleanup...');
  closeDB(DEMO_DB_PATH);
  console.log('✅ Demo completata!');
}

async function main() {
  try {
    const { db, semanticService, memoryManager } = await setupDemo();
    
    await populateDemoData(memoryManager);
    await runSearchDemo(semanticService);
    await runPerformanceTest(semanticService);
    
    await cleanup(db);
    
  } catch (error) {
    console.error('❌ Errore durante il demo:', error);
    process.exit(1);
  }
}

// Esegui demo
main();