# DEVFLOW-P2-SEARCH-ALGO-002B - Algoritmo di Ricerca Semantica Ibrida

## Specifiche Tecniche Dettagliate

### 1. Panoramica dell'Algoritmo

L'algoritmo di ricerca semantica ibrida combina due approcci complementari:

- **Ricerca Full-Text (FTS5 BM25)**: Per l'individuazione di corrispondenze esatte e parziali nei termini di ricerca
- **Similarità Vettoriale (Cosine Similarity)**: Per il matching semantico basato su rappresentazioni vettoriali dense

### 2. Architettura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    SemanticSearchService                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │   Query Parser   │───▶│     Ranking Strategy        │   │
│  └──────────────────┘    └─────────────────────────────┘   │
│                                   │                       │
│  ┌──────────────────┐             ▼                       │
│  │   FTS5 Engine    │    ┌─────────────────────────────┐   │
│  │    (BM25)        │───▶│    Fusion Algorithm         │   │
│  └──────────────────┘    └─────────────────────────────┘   │
│                                   │                       │
│  ┌──────────────────┐             ▼                       │
│  │ Vector Database  │    ┌─────────────────────────────┐   │
│  │(Cosine Similarity)│───▶│   Results Aggregator        │   │
│  └──────────────────┘    └─────────────────────────────┘   │
│                                   │                       │
│                                   ▼                       │
│                    ┌─────────────────────────────┐         │
│                    │    Final Ranked Results     │         │
│                    └─────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 3. Componenti Principali

#### 3.1 Query Parser

Funzionalità principali:
- Normalizzazione del testo (lowercase, rimozione di stop words)
- Estrazione dei termini di ricerca
- Identificazione di entità nominate
- Generazione di embedding per la similarità vettoriale

#### 3.2 FTS5 BM25 Engine

Caratteristiche:
- Indicizzazione full-text con FTS5 di SQLite
- Calcolo dello score BM25 per ogni documento
- Supporto per query booleane complesse
- Ranking basato sulla frequenza dei termini e lunghezza dei documenti

#### 3.3 Vector Database

Caratteristiche:
- Memorizzazione di embeddings densi per ogni documento
- Calcolo della cosine similarity tra query embedding e document embeddings
- Supporto per indicizzazione ANN (Approximate Nearest Neighbors)
- Normalizzazione degli embeddings

### 4. Strategia di Ranking Ponderato

#### 4.1 Formula di Fusione

```
FinalScore = (α × NormalizedBM25) + (β × NormalizedCosineSimilarity)
```

Dove:
- α = peso del ranking full-text (valore predefinito: 0.7)
- β = peso del ranking semantico (valore predefinito: 0.3)
- α + β = 1.0

#### 4.2 Normalizzazione dei Punteggi

Per garantire una combinazione equilibrata:

```
NormalizedBM25 = BM25Score / MaxBM25ScoreInResultSet
NormalizedCosineSimilarity = (CosineSimilarity + 1) / 2
```

#### 4.3 Configurazione Dinamica

La strategia di ranking può essere configurata tramite parametri:

```typescript
interface RankingConfig {
  textWeight: number;        // α - peso del BM25 (0.0 - 1.0)
  semanticWeight: number;    // β - peso della similarità vettoriale (0.0 - 1.0)
  boostFreshness?: number;   // peso opzionale per contenuti recenti
  boostPopularity?: number;  // peso opzionale per contenuti popolari
}
```

### 5. Algoritmo di Fusione

#### 5.1 Fase 1: Recupero dei Risultati

1. Esecuzione della query FTS5 BM25
2. Recupero dei primi N risultati (configurabile)
3. Generazione dell'embedding della query
4. Recupero dei K nearest neighbors vettoriali

#### 5.2 Fase 2: Normalizzazione

1. Calcolo del massimo score BM25 nei risultati
2. Normalizzazione di tutti i punteggi BM25
3. Normalizzazione delle cosine similarity (-1..1 → 0..1)

#### 5.3 Fase 3: Fusione e Ranking

1. Combinazione dei punteggi con la formula ponderata
2. Unione dei risultati (rimozione duplicati)
3. Riordinamento per punteggio finale decrescente
4. Applicazione di boost opzionali (freshness, popularity)

### 6. Ottimizzazioni per Performance

#### 6.1 Caching

- Cache LRU per query frequenti
- Cache degli embeddings per documenti stabili
- Cache dei risultati parziali (BM25 e vettoriali separatamente)

#### 6.2 Indicizzazione

- Indici FTS5 configurati per performance
- Indicizzazione ANN per similarità vettoriale
- Indici secondari per metadati (data, popolarità)

#### 6.3 Limitazione dei Risultati

- Limite configurabile per risultati FTS5 (es. 100)
- Limite configurabile per risultati vettoriali (es. 100)
- Pre-filtraggio basato su criteri aggiuntivi (categoria, data, ecc.)

#### 6.4 Parallelizzazione

- Esecuzione parallela delle query FTS5 e vettoriali
- Utilizzo di worker threads per calcoli pesanti
- Streaming dei risultati per evitare caricamenti in memoria

### 7. Implementazione di Riferimento

#### 7.1 Interfaccia SemanticSearchService

```typescript
interface SearchResult {
  id: string;
  content: string;
  score: number;
  textScore: number;
  semanticScore: number;
  metadata?: Record<string, any>;
}

class SemanticSearchService {
  async search(
    query: string, 
    config: RankingConfig,
    limit?: number
  ): Promise<SearchResult[]> {
    // Implementazione dell'algoritmo ibrido
  }
  
  private async executeBM25Search(
    query: string, 
    limit: number
  ): Promise<BM25Result[]> {
    // Implementazione FTS5 BM25
  }
  
  private async executeVectorSearch(
    queryEmbedding: number[], 
    limit: number
  ): Promise<VectorResult[]> {
    // Implementazione cosine similarity
  }
  
  private fuseResults(
    bm25Results: BM25Result[],
    vectorResults: VectorResult[],
    config: RankingConfig
  ): SearchResult[] {
    // Implementazione dell'algoritmo di fusione
  }
}
```

#### 7.2 Gestione della Configurazione

```typescript
const DEFAULT_RANKING_CONFIG: RankingConfig = {
  textWeight: 0.7,
  semanticWeight: 0.3
};

// Configurazione personalizzata per diversi casi d'uso
const PRECISION_CONFIG: RankingConfig = {
  textWeight: 0.8,
  semanticWeight: 0.2
};

const RECALL_CONFIG: RankingConfig = {
  textWeight: 0.5,
  semanticWeight: 0.5
};
```

### 8. Metriche di Valutazione

#### 8.1 Metriche Offline

- **Precision@K**: Percentuale di risultati rilevanti nei primi K risultati
- **Recall@K**: Percentuale di tutti i documenti rilevanti recuperati nei primi K
- **NDCG@K**: Normalized Discounted Cumulative Gain
- **MRR**: Mean Reciprocal Rank

#### 8.2 Metriche Online

- **CTR**: Click-Through Rate sui risultati di ricerca
- **Engagement**: Tempo trascorso sui risultati
- **User Satisfaction**: Feedback esplicito degli utenti

### 9. Considerazioni sull'Implementazione

#### 9.1 Scalabilità

- Supporto per indicizzazione batch
- Possibilità di distribuire il carico tra nodi multipli
- Gestione della concorrenza per alti volumi di query

#### 9.2 Manutenibilità

- Configurazione esternalizzata
- Logging dettagliato per debugging
- Monitoraggio delle performance
- Test automatizzati per i vari componenti

#### 9.3 Estensibilità

- Supporto per altri algoritmi di ranking
- Possibilità di aggiungere nuovi fattori di ranking
- Plugin system per funzionalità avanzate

### 10. Requisiti di Sistema

#### 10.1 Dipendenze

- SQLite con estensione FTS5
- Libreria per calcolo vettoriale (es. TensorFlow.js o ONNX)
- Sistema di embedding pre-addestrato (es. Sentence-BERT)

#### 10.2 Risorse

- Memoria sufficiente per caching degli embeddings
- Storage per database FTS5 e vettoriale
- Capacità di calcolo per operazioni vettoriali

#### 10.3 Performance Target

- Latenza < 200ms per query
- Throughput > 100 QPS
- Scalabilità fino a 1M documenti
