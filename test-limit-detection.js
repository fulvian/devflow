#!/usr/bin/env node

/**
 * Test script for limit detection
 */

const fs = require('fs');
const path = require('path');

// Simulate Claude Code output with a limit message
const limitMessage = "5-hour limit reached ∙ resets 3am";

console.log("Simulating Claude Code output...");
console.log(limitMessage);

// Send to limit detector
const { spawn } = require('child_process');
const detector = spawn('node', [path.join(__dirname, '../.claude/hooks/session-limit-detector.js')]);

detector.stdout.on('data', (data) => {
  console.log(`Detector output: ${data}`);
});

detector.stderr.on('data', (data) => {
  console.error(`Detector error: ${data}`);
});

detector.on('close', (code) => {
  console.log(`Detector process exited with code ${code}`);
});

// Send the limit message to the detector
detector.stdin.write(limitMessage);
detector.stdin.end();