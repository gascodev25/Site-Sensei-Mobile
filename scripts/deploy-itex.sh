#!/bin/bash
# Deploy to ITEX server (sitesensei.gasco.digital)
# Usage: bash scripts/deploy-itex.sh
set -e

echo "=== SiteSensei ITEX Deployment ==="

# Write SSH key
node -e "
const key = process.env.SITESENSEI_SSH_KEY || '';
if (!key) { console.error('ERROR: SITESENSEI_SSH_KEY not set'); process.exit(1); }
const match = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
const keyType = match[1]; const body = match[2].replace(/\s+/g, '');
const lines = body.match(/.{1,64}/g).join('\n');
require('fs').mkdirSync('/home/runner/.ssh', {recursive:true});
require('fs').writeFileSync('/home/runner/.ssh/itex_key', '-----BEGIN ' + keyType + '-----\n' + lines + '\n-----END ' + keyType + '-----\n', {mode: 0o600});
console.log('SSH key ready');
"

echo "=== Building app ==="
npm run build

echo "=== Packaging ==="
tar -czf /tmp/sitesensei_deploy.tar.gz dist/ package.json package-lock.json

echo "=== Uploading to server ==="
scp -i ~/.ssh/itex_key -o StrictHostKeyChecking=no /tmp/sitesensei_deploy.tar.gz ubuntu@154.65.101.96:/opt/sitesensei/deploy.tar.gz

echo "=== Deploying on server ==="
ssh -i ~/.ssh/itex_key -o StrictHostKeyChecking=no ubuntu@154.65.101.96 "
  cd /opt/sitesensei
  tar -xzf deploy.tar.gz
  rm deploy.tar.gz
  sudo pm2 restart sitesensei
  sleep 3
  sudo pm2 status
  curl -s -o /dev/null -w 'HTTP: %{http_code}\n' http://localhost:3000/
"

echo "=== Deployment complete! ==="
echo "Site: https://sitesensei.gasco.digital"
