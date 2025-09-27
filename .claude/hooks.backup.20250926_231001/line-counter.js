#!/usr/bin/env node

const fs = require('fs');

function countLines(content) {
  return typeof content === 'string' ? content.split('\n').length : 0;
}

function isClaudeOnlyMode() {
  try {
    const data = JSON.parse(fs.readFileSync('.claude/state/daic-mode.json', 'utf8'));
    return data.mode === 'claude-only';
  } catch {
    return false;
  }
}

function extractContent(toolCall) {
  const params = toolCall.function?.parameters || {};
  if (params.content) return params.content;
  if (params.new_string) return params.new_string;
  if (params.edits) return params.edits.map(e => e.new_string || '').join('\n');
  return '';
}

module.exports = { countLines, isClaudeOnlyMode, extractContent };