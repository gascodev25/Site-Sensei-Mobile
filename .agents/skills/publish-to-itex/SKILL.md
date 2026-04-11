---
name: publish-to-itex
description: Deploys the SiteSensei app to the ITEX production server at sitesensei.gasco.digital. Use when the user says "publish to ITEX", "deploy to ITEX", "push to production", or any similar phrase requesting a deployment to the live ITEX site.
---

# Publish to ITEX

Deploy the current codebase to the ITEX production server at `sitesensei.gasco.digital`.

## Steps

1. Run the deploy script:
   ```bash
   bash scripts/deploy-itex.sh
   ```

2. The script automatically:
   - Builds the app (`npm run build`)
   - Packages `dist/`, `package.json`, `package-lock.json`
   - SCPs the bundle to the VPS at `154.65.101.96`
   - Writes the correct `.env` (using `NEON_DATABASE_URL` and `SESSION_SECRET` from Replit secrets)
   - Restarts the pm2 process (`sitesensei`)
   - Confirms the server is responding

3. After the script finishes, verify the deployment succeeded:
   ```bash
   curl -s -o /dev/null -w "HTTP:%{http_code}" https://sitesensei.gasco.digital/
   ```
   Expected: `HTTP:200`

## Server Details

- **VPS IP**: `154.65.101.96`
- **User**: `ubuntu`
- **SSH key**: `SITESENSEI_SSH_KEY` (Replit secret)
- **App directory**: `/opt/sitesensei/`
- **Process manager**: PM2 (`sudo pm2 restart sitesensei`)
- **Database**: Neon public endpoint via `NEON_DATABASE_URL`

## Important Notes

- This is completely separate from the Replit "Publish" button, which deploys to Replit hosting — NOT to sitesensei.gasco.digital
- If the deploy script fails mid-way, SSH in and check `sudo pm2 logs sitesensei` for errors
- Schema changes must be pushed to Neon separately: `DATABASE_URL=$NEON_DATABASE_URL npm run db:push`
