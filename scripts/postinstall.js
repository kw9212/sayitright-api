#!/usr/bin/env node

// Husky v9 설치 스크립트 (개발 환경에서만)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CI 환경이거나 프로덕션 환경이면 스킵
if (process.env.CI || process.env.NODE_ENV === 'production') {
  console.log('Skipping husky install in CI/production environment');
  process.exit(0);
}

// .git 폴더가 없으면 스킵 (npm install이 git repo가 아닌 곳에서 실행될 때)
if (!fs.existsSync(path.join(__dirname, '..', '.git'))) {
  console.log('Skipping husky install (not a git repository)');
  process.exit(0);
}

// Husky v9: core.hooksPath를 .husky로 설정
try {
  execSync('git config core.hooksPath .husky', {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
  });
  console.log('Husky installed successfully (core.hooksPath = .husky)');
} catch (e) {
  console.log('Husky install skipped:', e.message);
}
