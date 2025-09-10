# Changelog

## [2.6.0] - 2025-09-10

### Added
- **Gemini CLI Integration**: Complete integration with Google's Gemini CLI for enhanced large-context analysis
  - GeminiService wrapper with three core methods: analyzeCode(), debugIssue(), reviewMultipleFiles()
  - Automatic activation for large files (>20k chars), complex debugging (>5k context), cross-file analysis (>3 files)
  - MCP integration for seamless agent delegation to Gemini when token efficiency requires it
- **Intelligent Context Management**: Automatic fallback system between Claude Code → Synthetic Agents → Gemini CLI based on task complexity
- **Production-Ready ML Services**: Enhanced ML module with full TypeScript support and proper exports

### Improved
- **Token Efficiency**: Smart routing reduces token usage by delegating large context tasks to appropriate AI systems
- **Multi-Agent Coordination**: Balanced workload distribution across Claude Code, Synthetic, and Gemini agents
- **Developer Experience**: Simple environment variable configuration (GEMINI_CLI_PATH) for instant activation

### Technical Details
- Core implementation: /packages/core/src/ml/GeminiService.ts
- MCP server integration: /mcp-servers/synthetic/src/services/gemini-service.ts
- Full TypeScript support with proper module resolution
- Comprehensive testing suite validates all three analysis methods

## [2.5.0] - 2024-05-15

### Added
- Batch processing system for handling multiple concurrent sessions
- ML-based predictive cost modeling for optimized resource allocation
- Real-time session monitoring with detailed analytics dashboard
- Intelligent context eviction mechanism to manage memory efficiently
- QA-deployment agent for automated testing and deployment validation

### Improved
- Performance optimizations resulting in 45-50% token savings
- Enhanced error handling and recovery mechanisms
- Streamlined API interfaces for better developer experience

### Changed
- Updated orchestration engine architecture for better scalability
- Revised configuration schema for improved flexibility

### Fixed
- Memory leak issues in long-running sessions
- Race conditions in concurrent processing scenarios
- Data serialization inconsistencies

## [2.4.1] - 2024-04-22

### Fixed
- Minor bug fixes in session management
- Documentation updates

## [2.4.0] - 2024-04-15

### Added
- Initial orchestration system implementation
- Basic session management capabilities
- Core API framework
