#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

function bumpVersion(type = 'patch') {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  
  // Parse version
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  // Update CHANGELOG.md
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const today = new Date().toISOString().split('T')[0];
  const newEntry = `## [${newVersion}] - ${today}

### Added
- 

### Changed
- 

### Fixed
- 

---

`;
  
  const updatedChangelog = changelog.replace(
    /^(# Changelog\n\n.*?\n\n)/m,
    `$1${newEntry}`
  );
  
  fs.writeFileSync(changelogPath, updatedChangelog);
  
  console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
  console.log(`📝 Please update CHANGELOG.md with your changes`);
  console.log(`🚀 Commit and push to trigger release workflow`);
  
  return newVersion;
}

// Get command line argument
const versionType = process.argv[2] || 'patch';

if (!['major', 'minor', 'patch'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: major, minor, or patch');
  process.exit(1);
}

bumpVersion(versionType);