# Release workflow

Branch **`release`** holds production-only files. Version numbers live in **annotated tags** (`v1.0.0`, `v1.1.0`, …), not in the branch name.

```
Dev (full tree, .env may be committed)
  -> scripts/promote-to-release.ps1 -Tag vX.Y.Z
  -> release (allowlist only)
  -> tag vX.Y.Z
  -> push origin + server
```

Do **not** merge `Dev` into `release`; that would drag docs, dumps, and one-off scripts into production.

## Rules

| Branch | `.env` / `server/.env` |
| --- | --- |
| `Dev` | May be committed (including GitHub) |
| `release` | Never committed; blocked by script + release `.gitignore` |

Legacy branch **`release/production`** is retired. Use `release` + tags only.

## Promote

From a clean `Dev` (no staged/unstaged tracked changes):

```powershell
# Preview export only
.\scripts\promote-to-release.ps1 -Tag v1.0.1 -DryRun

# Create commit on release + annotated tag; stay local
.\scripts\promote-to-release.ps1 -Tag v1.0.1

# Same, then dual-push branch + tag
.\scripts\promote-to-release.ps1 -Tag v1.0.1 -Push
```

Without `-Push`, publish manually:

```bash
git push -u origin release
git push origin v1.0.1
git push -u server release
git push server v1.0.1
```

The script always returns you to `Dev` when finished.

## Allowlist (what enters `release`)

**Root:** `index.html`, `index.php`, `.htaccess`, favicon/logo, `ecosystem.config.cjs`, `nginx-kpi-production.conf`, `package.json`, `package-lock.json`, `vite.config.js`, `api/.htaccess`, `assets/`

**Server:** `index.js`, `db.js`, `.htaccess`, `package.json`, `package-lock.json`, `.env.example`, `routes/`, `lib/`, `middleware/`, `migrations/`, `services/`, `scripts/migrate-passwords.js`

**Excluded:** `docs/`, `db/`, dumps/SQL, rekon/Excel/tmp, `dist/`, one-off `server/check_*` / import / seed scripts, legacy `server/index.cjs`, root `scripts/` (promote stays on `Dev` only), and any `.env`.

## First cut

```powershell
.\scripts\promote-to-release.ps1 -Tag v1.0.0 -Push
```

**Note:** Git cannot keep both `release` and `release/production` (nested ref). The promote script deletes local `release/production` before creating `release`. After remotes have `release` + tag, remove the legacy remote branch:

```bash
git push origin --delete release/production
git push server --delete release/production
```
