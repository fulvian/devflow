interface SessionMetadata {
  sessionId: string;
  userId: string;
  createdAt: number;
  similarityScore?: number;
}

class CrossSessionMemory {
  private sessions: Map<string, SessionMetadata> = new Map();

  addSession(sessionId: string, metadata: SessionMetadata): void {
    this.sessions.set(sessionId, metadata);
  }

  getSession(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  calculateSimilarity(sessionId: string): number {
    const session = this.getSession(sessionId);
    if (session && session.similarityScore !== undefined) {
      return session.similarityScore;
    }
    // Default similarity calculation
    return 0.5;
  }
}

export default CrossSessionMemory;
