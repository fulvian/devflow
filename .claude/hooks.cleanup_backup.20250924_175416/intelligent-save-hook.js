const fs = require('fs');
const path = require('path');

class IntelligentSaveHook {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../..');
    this.verificationTriggerPath = path.join(this.baseDir, '.devflow/verification-trigger.json');
    this.snapshotsDir = path.join(this.baseDir, '.devflow/snapshots');
    this.logFile = path.join(this.baseDir, '.devflow/intelligent-save.log');
    this.ensureDirectories();
  }

  ensureDirectories() {
    [path.dirname(this.verificationTriggerPath), this.snapshotsDir, path.dirname(this.logFile)]
      .forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));
  }

  onHookTrigger(hookData) {
    try {
      const timestamp = new Date().toISOString();
      const transcript = hookData.transcript || '';
      const codeBlocks = this.extractCodeBlocks(transcript);
      const filePaths = this.extractFilePaths(transcript);
      const hasChanges = codeBlocks.length > 0 || filePaths.length > 0;

      if (hasChanges) {
        this.triggerVerification(timestamp, codeBlocks, filePaths);
        this.saveSnapshot(timestamp, hookData, codeBlocks, filePaths);
        this.logOperation(timestamp, 'CODE_CHANGES_DETECTED', {
          codeBlocksCount: codeBlocks.length,
          filePathsCount: filePaths.length,
          files: filePaths
        });
      }

      return { continue: true, suppressOutput: false };
    } catch (error) {
      this.logOperation(new Date().toISOString(), 'ERROR', { error: error.message });
      return { continue: true, suppressOutput: false };
    }
  }

  extractCodeBlocks(text) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        language: match[1] || 'unknown',
        code: match[2].trim()
      });
    }
    return blocks;
  }

  extractFilePaths(text) {
    const filePathRegex = /(?:src\/|\.claude\/|mcp-servers\/)[^\s\n]+\.(?:ts|js|py|json)/g;
    return [...new Set(text.match(filePathRegex) || [])];
  }

  triggerVerification(timestamp, codeBlocks, filePaths) {
    const triggerData = {
      timestamp,
      trigger: 'intelligent-save-hook',
      changes: { codeBlocks: codeBlocks.length, filePaths }
    };
    fs.writeFileSync(this.verificationTriggerPath, JSON.stringify(triggerData, null, 2));
  }

  saveSnapshot(timestamp, hookData, codeBlocks, filePaths) {
    const snapshotFile = path.join(this.snapshotsDir, `snapshot-${timestamp.replace(/[:.]/g, '-')}.json`);
    const snapshot = {
      timestamp,
      hookType: hookData.hookType,
      codeBlocks,
      filePaths,
      transcriptLength: (hookData.transcript || '').length
    };
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
  }

  logOperation(timestamp, eventType, data) {
    const logEntry = `${timestamp} [${eventType}] ${JSON.stringify(data)}\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }
}

module.exports = IntelligentSaveHook;