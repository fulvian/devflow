export function compactContext(blocks, strategy, targetSize = 0.6) {
    const originalSize = blocks.length;
    if (originalSize === 0) {
        return { originalSize: 0, compactedSize: 0, compressionRatio: 1, preservedBlocks: [], removedBlocks: [], strategy, qualityScore: 1 };
    }
    let preserved = [];
    switch (strategy) {
        case 'importance_based':
            preserved = [...blocks].sort((a, b) => b.importanceScore - a.importanceScore);
            break;
        case 'recency_based':
            preserved = [...blocks].sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
            break;
        case 'platform_optimized':
        case 'ml_powered':
        case 'hybrid':
        default:
            preserved = [...blocks].sort((a, b) => (b.importanceScore + (b.accessCount ?? 0) / 10) - (a.importanceScore + (a.accessCount ?? 0) / 10));
            break;
    }
    const keepCount = Math.max(1, Math.floor(originalSize * targetSize));
    const kept = preserved.slice(0, keepCount);
    const removed = preserved.slice(keepCount);
    const compactedSize = kept.length;
    const compressionRatio = originalSize > 0 ? compactedSize / originalSize : 1;
    const qualityScore = kept.reduce((acc, b) => acc + b.importanceScore, 0) / kept.length;
    return {
        originalSize,
        compactedSize,
        compressionRatio,
        preservedBlocks: kept.map(b => b.id),
        removedBlocks: removed.map(b => b.id),
        strategy,
        qualityScore,
    };
}
//# sourceMappingURL=compaction.js.map