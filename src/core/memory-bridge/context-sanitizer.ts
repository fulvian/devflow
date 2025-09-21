/**
 * ContextSanitizer - Security-focused sanitizer for preventing injection attacks
 * and XSS vulnerabilities in the DevFlow memory bridge system.
 */
export class ContextSanitizer {
  // Character whitelist for legitimate content
  private static readonly WHITELIST_REGEX = /[^a-zA-Z0-9\s\-_.,;:()\[\]{}/\\@#$%&+=<>|~`"'*!?]/g;

  // Dangerous patterns to be removed
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /\$\{[^}]*\}/g,
    /\{\{[^}]*\}\}/g
  ];

  /**
   * Sanitizes a string by removing dangerous patterns and HTML escaping
   * @param input - String to sanitize
   * @returns Sanitized string or empty string if input exceeds limit
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    // Enforce length limit
    if (input.length > 10000) return '';

    // Remove dangerous patterns
    let sanitized = input;
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove non-whitelisted characters
    sanitized = sanitized.replace(this.WHITELIST_REGEX, '');

    // HTML escape special characters
    return sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Sanitizes an array of strings
   * @param input - Array of strings to sanitize
   * @returns New array with sanitized strings
   */
  static sanitizeArray(input: string[]): string[] {
    if (!Array.isArray(input)) return [];

    return input.map(item => this.sanitizeString(item));
  }
}