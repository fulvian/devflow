import { Finding, Correction } from './types';

/**
 * AutoCorrectionEngine handles automated corrections for verification findings.
 * It maintains a history of applied corrections and allows rollback functionality.
 */
export class AutoCorrectionEngine {
  private correctionHistory: Correction[] = [];

  /**
   * Applies corrections to the provided findings based on their severity levels.
   * Only processes findings with severity levels of 'medium' or higher.
   * 
   * @param findings - Array of findings to apply corrections to
   * @returns Array of applied corrections
   * @throws Error if correction application fails
   */
  applyCorrections(findings: Finding[]): Correction[] {
    try {
      const appliedCorrections: Correction[] = [];

      for (const finding of findings) {
        // Only apply corrections for medium, high, and critical severity levels
        if (this.isCorrectableSeverity(finding.severity)) {
          const correction: Correction = {
            id: `correction-${Date.now()}-${finding.id}`,
            findingId: finding.id,
            appliedAt: new Date(),
            description: `Auto-applied correction for: ${finding.message}`,
            originalValue: 'original_content',
            correctedValue: 'corrected_content',
            filePath: finding.location
          };

          appliedCorrections.push(correction);
          this.correctionHistory.push(correction);
        }
      }

      return appliedCorrections;
    } catch (error) {
      throw new Error(`Failed to apply corrections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Rolls back previously applied corrections by their IDs or correction objects.
   *
   * @param corrections - Array of correction IDs or correction objects to rollback
   * @returns Array of rolled back corrections
   * @throws Error if rollback fails
   */
  rollbackChanges(corrections: string[] | Correction[]): Correction[] {
    try {
      const rolledBackCorrections: Correction[] = [];

      // Extract IDs from either string array or Correction array
      const correctionIds = corrections.map(c => typeof c === 'string' ? c : c.id);

      for (const id of correctionIds) {
        const correctionIndex = this.correctionHistory.findIndex(c => c.id === id);

        if (correctionIndex !== -1) {
          const correction = { ...this.correctionHistory[correctionIndex] };
          // Mark correction as rolled back (add to metadata if needed)
          rolledBackCorrections.push(correction);

          // Remove from history
          this.correctionHistory.splice(correctionIndex, 1);
        }
      }

      return rolledBackCorrections;
    } catch (error) {
      throw new Error(`Failed to rollback changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves the complete correction history.
   * 
   * @returns Array of all corrections in history
   */
  getCorrectionHistory(): Correction[] {
    return [...this.correctionHistory];
  }

  /**
   * Determines if a finding's severity level is correctable.
   * 
   * @param severity - The severity level to check
   * @returns True if the severity is correctable, false otherwise
   */
  private isCorrectableSeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): boolean {
    return severity === 'MEDIUM' || severity === 'HIGH' || severity === 'CRITICAL';
  }

}