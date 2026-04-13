#!/bin/bash
# Deploy to ITEX server (sitesensei.gasco.digital)
# Usage: bash scripts/deploy-itex.sh
set -e

echo "=== SiteSensei ITEX Deployment ==="

# Write SSH key and env file (without exposing secrets in logs)
node -e "
const key = process.env.SITESENSEI_SSH_KEY || '';
if (!key) { console.error('ERROR: SITESENSEI_SSH_KEY not set'); process.exit(1); }
const match = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
const keyType = match[1]; const body = match[2].replace(/\s+/g, '');
const lines = body.match(/.{1,64}/g).join('\n');
require('fs').mkdirSync('/home/runner/.ssh', {recursive:true});
require('fs').writeFileSync('/home/runner/.ssh/itex_key', '-----BEGIN ' + keyType + '-----\n' + lines + '\n-----END ' + keyType + '-----\n', {mode: 0o600});

// Write env file for server (uses NEON_DATABASE_URL for external access)
const neonUrl = process.env.NEON_DATABASE_URL || '';
const sessionSecret = process.env.SESSION_SECRET || '';
if (!neonUrl) { console.error('ERROR: NEON_DATABASE_URL not set'); process.exit(1); }
if (!sessionSecret) { console.error('ERROR: SESSION_SECRET not set'); process.exit(1); }
const envContent = 'NODE_ENV=production\nPORT=3000\nDATABASE_URL=' + neonUrl + '\nSESSION_SECRET=' + sessionSecret + '\n';
require('fs').writeFileSync('/tmp/itex_server_env', envContent, {mode: 0o600});
console.log('SSH key and env file ready');
"

echo "=== Building app ==="
npm run build

echo "=== Packaging ==="
tar -czf /tmp/sitesensei_deploy.tar.gz dist/ package.json package-lock.json

echo "=== Uploading to server ==="
scp -i ~/.ssh/itex_key -o StrictHostKeyChecking=no /tmp/sitesensei_deploy.tar.gz ubuntu@154.65.101.96:/opt/sitesensei/deploy.tar.gz
scp -i ~/.ssh/itex_key -o StrictHostKeyChecking=no /tmp/itex_server_env ubuntu@154.65.101.96:/tmp/itex_server_env

echo "=== Deploying on server ==="
ssh -i ~/.ssh/itex_key -o StrictHostKeyChecking=no ubuntu@154.65.101.96 "
  cd /opt/sitesensei
  sudo tar -xzf deploy.tar.gz
  sudo rm deploy.tar.gz
  sudo cp /tmp/itex_server_env /opt/sitesensei/.env
  sudo chmod 600 /opt/sitesensei/.env
  rm /tmp/itex_server_env
  echo '--- Restarting server ---'
  sudo pm2 restart sitesensei
  sleep 5
  sudo pm2 status
  curl -s -o /dev/null -w 'HTTP: %{http_code}\n' http://localhost:3000/
"

# Clean up temp files
rm -f /tmp/sitesensei_deploy.tar.gz /tmp/itex_server_env

echo "=== Deployment complete! ==="
echo "Site: https://sitesensei.gasco.digital"
