/**
 * Usage Monitor - Monitoraggio dell'utilizzo delle API
 */

// Interfaccia per i limiti di utilizzo
export interface UsageLimit {
  used: number;
  limit: number;
  resetTime?: Date;
}

// Classe per il monitoraggio dell'utilizzo
export class UsageMonitor {
  // Implementazione semplificata per il momento
  getUsage(agentType: string): number {
    // Restituisce un valore di utilizzo fittizio
    return 0;
  }

  getThreshold(agentType: string): number {
    // Restituisce una soglia fittizia
    return 100;
  }
}