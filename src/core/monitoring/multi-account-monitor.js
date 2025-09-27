"use strict";
/**
 * Multi-Account Usage Monitoring System
 * Monitors usage limits for Claude Pro, OpenAI Plus, and Gemini CLI
 * Implements cascade fallback logic based on real-time usage data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAccountMonitor = exports.GeminiMonitor = exports.OpenAIMonitor = exports.ClaudeMonitor = void 0;
const util_1 = require("util");
const child_process_1 = require("child_process");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// Constants
const CLAUDE_RESET_PERIOD_HOURS = 5;
const DAILY_RESET_HOUR = 0; // Midnight
/**
 * Claude Pro Usage Monitor
 * Uses ccusage tool to check real usage limits
 */
class ClaudeMonitor {
    constructor() {
        this.lastCheck = null;
        this.lastResult = null;
    }
    async checkUsage() {
        try {
            const { stdout } = await execPromise('ccusage --json');
            const usageData = JSON.parse(stdout);
            // Parse the usage data
            const used = usageData.used_requests || 0;
            const limit = usageData.request_limit || Infinity;
            // Calculate reset time (5 hours from now)
            const resetTime = new Date();
            resetTime.setHours(resetTime.getHours() + CLAUDE_RESET_PERIOD_HOURS);
            const result = {
                used,
                limit,
                resetTime,
                resetPeriod: '5h'
            };
            this.lastCheck = new Date();
            this.lastResult = result;
            return result;
        }
        catch (error) {
            throw new Error(`Claude usage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    isAvailable(usage) {
        return usage.used < usage.limit;
    }
}
exports.ClaudeMonitor = ClaudeMonitor;
/**
 * OpenAI Plus Usage Monitor
 * Monitors ChatGPT Plus usage through profile/session tracking (no API key needed)
 */
class OpenAIMonitor {
    constructor() {
        this.sessionUsage = 0;
        this.sessionStart = new Date();
        this.lastCheck = null;
        this.lastResult = null;
        // No API key needed - uses profile authentication
    }
    async checkUsage() {
        try {
            // For ChatGPT Plus, we estimate usage based on local session tracking
            // since it uses web profile authentication, not API keys
            const now = new Date();
            const sessionDuration = now.getTime() - this.sessionStart.getTime();
            const hoursElapsed = sessionDuration / (1000 * 60 * 60);
            // ChatGPT Plus typical limits: 30-150 messages per 5-hour window
            const estimatedLimit = 100; // Conservative estimate
            const used = Math.min(this.sessionUsage, estimatedLimit);
            // Reset every 5 hours
            if (hoursElapsed >= 5) {
                this.sessionUsage = 0;
                this.sessionStart = now;
            }
            // Calculate reset time (5 hours from session start)
            const resetTime = new Date(this.sessionStart.getTime() + (5 * 60 * 60 * 1000));
            const result = {
                used,
                limit: estimatedLimit,
                resetTime,
                resetPeriod: '5h'
            };
            this.lastCheck = new Date();
            this.lastResult = result;
            return result;
        }
        catch (error) {
            throw new Error(`OpenAI usage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Record a usage event (call this when using ChatGPT Plus)
     */
    recordUsage() {
        this.sessionUsage++;
    }
    isAvailable(usage) {
        return usage.used < usage.limit * 0.9; // 90% threshold
    }
}
exports.OpenAIMonitor = OpenAIMonitor;
/**
 * Gemini CLI Usage Monitor
 * Uses profile authentication and local session tracking
 */
class GeminiMonitor {
    constructor() {
        this.sessionUsage = 0;
        this.sessionStart = new Date();
        this.lastCheck = null;
        this.lastResult = null;
        // Reset daily usage at midnight
        this.resetDailyUsageIfNeeded();
    }
    async checkUsage() {
        try {
            // Reset daily usage if new day
            this.resetDailyUsageIfNeeded();
            // Try to get real usage from Gemini CLI if available
            let used = this.sessionUsage;
            let limit = 100; // Free daily limit
            try {
                const { stdout } = await execPromise('echo "/stats" | gemini --timeout 3s 2>/dev/null || echo "unavailable"');
                if (!stdout.includes('unavailable')) {
                    // Parse stats output for real usage data
                    const match = stdout.match(/(\d+).*requests.*today/i);
                    if (match) {
                        used = parseInt(match[1], 10);
                    }
                }
            }
            catch (error) {
                // Fallback to session tracking
                console.warn('Gemini CLI stats unavailable, using session tracking');
            }
            // Calculate next reset (next midnight)
            const resetTime = new Date();
            resetTime.setHours(DAILY_RESET_HOUR, 0, 0, 0);
            if (resetTime <= new Date()) {
                resetTime.setDate(resetTime.getDate() + 1);
            }
            const result = {
                used,
                limit,
                resetTime,
                resetPeriod: 'daily'
            };
            this.lastCheck = new Date();
            this.lastResult = result;
            return result;
        }
        catch (error) {
            throw new Error(`Gemini usage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Record a usage event (call this when using Gemini CLI)
     */
    recordUsage() {
        this.sessionUsage++;
    }
    /**
     * Reset daily usage tracking if it's a new day
     */
    resetDailyUsageIfNeeded() {
        const now = new Date();
        const lastMidnight = new Date(now);
        lastMidnight.setHours(0, 0, 0, 0);
        if (this.sessionStart < lastMidnight) {
            this.sessionUsage = 0;
            this.sessionStart = now;
        }
    }
    isAvailable(usage) {
        return usage.used < usage.limit * 0.9; // 90% threshold
    }
}
exports.GeminiMonitor = GeminiMonitor;
/**
 * Unified Multi-Account Usage Monitor
 * Orchestrates monitoring across all services and implements fallback logic
 */
class MultiAccountMonitor {
    constructor(syntheticAlwaysAvailable = true) {
        this.claudeMonitor = new ClaudeMonitor();
        this.openaiMonitor = new OpenAIMonitor(); // No API key needed - uses profile auth
        this.geminiMonitor = new GeminiMonitor(); // Uses profile auth
        this.syntheticAlwaysAvailable = syntheticAlwaysAvailable;
    }
    /**
     * Check usage for all services simultaneously
     */
    async checkAllServices() {
        const services = [
            { name: 'claude', available: false, usage: null },
            { name: 'openai', available: false, usage: null },
            { name: 'gemini', available: false, usage: null }
        ];
        // Run all checks in parallel
        const checks = [
            this.claudeMonitor.checkUsage().catch(error => ({ error })),
            this.openaiMonitor.checkUsage().catch(error => ({ error })),
            this.geminiMonitor.checkUsage().catch(error => ({ error }))
        ];
        const results = await Promise.all(checks);
        // Process Claude results
        if (!results[0].error) {
            services[0].usage = results[0];
            services[0].available = this.claudeMonitor.isAvailable(results[0]);
        }
        else {
            services[0].error = results[0].error.message;
        }
        // Process OpenAI results
        if (!results[1].error) {
            services[1].usage = results[1];
            services[1].available = this.openaiMonitor.isAvailable(results[1]);
        }
        else {
            services[1].error = results[1].error.message;
        }
        // Process Gemini results
        if (!results[2].error) {
            services[2].usage = results[2];
            services[2].available = this.geminiMonitor.isAvailable(results[2]);
        }
        else {
            services[2].error = results[2].error.message;
        }
        return services;
    }
    /**
     * Determine the best available service based on cascade priority
     * Priority: Claude > OpenAI > Gemini > Synthetic
     */
    determineRecommendedService(services) {
        // Check in priority order
        if (services[0].available)
            return 'claude'; // Claude
        if (services[1].available)
            return 'openai'; // OpenAI
        if (services[2].available)
            return 'gemini'; // Gemini
        // If all services are exhausted, use synthetic as emergency fallback
        if (this.syntheticAlwaysAvailable) {
            return 'synthetic';
        }
        // Find service with earliest reset time among unavailable services
        const unavailableServices = services.filter(s => !s.available && s.usage?.resetTime);
        if (unavailableServices.length > 0) {
            unavailableServices.sort((a, b) => (a.usage?.resetTime?.getTime() || 0) - (b.usage?.resetTime?.getTime() || 0));
            return unavailableServices[0].name;
        }
        // Default to synthetic if no better option
        return 'synthetic';
    }
    /**
     * Get complete monitoring result with recommended service
     */
    async getMonitoringResult() {
        const services = await this.checkAllServices();
        const recommendedService = this.determineRecommendedService(services);
        return {
            services,
            recommendedService
        };
    }
    /**
     * Check if a specific service is available
     */
    async isServiceAvailable(service) {
        const services = await this.checkAllServices();
        const serviceStatus = services.find(s => s.name === service);
        return serviceStatus?.available ?? false;
    }
    /**
     * Get time until a service resets
     */
    async getTimeUntilReset(service) {
        const services = await this.checkAllServices();
        const serviceStatus = services.find(s => s.name === service);
        if (serviceStatus?.usage?.resetTime) {
            return Math.max(0, serviceStatus.usage.resetTime.getTime() - Date.now());
        }
        return null;
    }
}
exports.MultiAccountMonitor = MultiAccountMonitor;
exports.default = MultiAccountMonitor;
