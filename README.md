# Deploying to undergroundradio.us

Single VPS (`72.61.75.183`) running both the Next.js frontend and the Django
backend, fronted by nginx on one domain with path-based routing:

- `https://undergroundradio.us/`     → Next.js (port 3000)
- `https://undergroundradio.us/api/` → Django (port 8000), `/api` prefix stripped

Same origin means **no CORS is needed for real traffic** — `ug_radio_ux/.env.production`
already points the frontend at the relative path `/api`.

None of this was run for you — it needs real access to your registrar and server
that I don't have. This is the exact sequence to run yourself.

## 1. DNS (at your registrar)

Point both of these at `72.61.75.183`:
- `undergroundradio.us` → A record → `72.61.75.183`
- `www.undergroundradio.us` → A record → `72.61.75.183`

## 2. On the server: get the code + dependencies

```bash
git clone <your repo url> /opt/undergroundradio   # or git pull if already cloned
cd /opt/undergroundradio/undergroundradio

python3 -m venv /opt/undergroundradio/venv
/opt/undergroundradio/venv/bin/pip install -r requirements.txt

cd ug_radio_ux
npm ci
npm run build   # picks up .env.production (NEXT_PUBLIC_API_BASE_URL=/api) automatically
```

## 3. Confirm the RS256 JWT keys exist

`settings.py` expects real keys at `/srv/mp3private.key` and `/srv/mp3public.key`
by default (not the throwaway dev keypair under `keys/` used for local testing —
that one never leaves your machine). If they're not already on this server:

```bash
openssl genrsa -out /srv/mp3private.key 2048
openssl rsa -in /srv/mp3private.key -pubout -out /srv/mp3public.key
sudo chmod 600 /srv/mp3private.key
```

## 4. Database migration — READ THIS FIRST

`myapp/migrations/0001_initial.py` was regenerated this session to match the
current models (`Song.song`/`producer`/`coverArt`, `Library.username`). Per what
you told me earlier, the **real Neon database already has this schema** — the old
migration file just hadn't caught up as a record.

That means: **do not blindly run `python manage.py migrate`** against production
without checking first, or Django may try to `CREATE TABLE` on tables that already
exist.

```bash
cd /opt/undergroundradio/undergroundradio
/opt/undergroundradio/venv/bin/python manage.py showmigrations myapp
```

- If `myapp.0001_initial` shows as **already applied** (`[X]`) — you're done, skip to step 5.
- If it shows as **unapplied** (`[ ]`) but the tables already exist with the current
  column names — mark it applied without touching the schema:
  ```bash
  /opt/undergroundradio/venv/bin/python manage.py migrate myapp 0001 --fake
  ```
- If you're not sure which case you're in, stop and inspect the actual table
  columns (`\d myapp_song` in `psql`) before running anything.

## 5. Systemd services

```bash
sudo cp deploy/systemd/undergroundradio-backend.service /etc/systemd/system/
sudo cp deploy/systemd/undergroundradio-frontend.service /etc/systemd/system/
```

Edit both files first — replace the placeholder `WorkingDirectory`/`ExecStart`
paths with the real clone/venv locations, and in the backend unit replace
`DJANGO_SECRET_KEY=REPLACE_WITH_A_REAL_SECRET_NEVER_COMMITTED` with a real
generated secret (`python -c "import secrets; print(secrets.token_urlsafe(50))"`).
**Do not put that secret in the tracked `.env` file** — it stays in the systemd
unit (or another untracked env file) only.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now undergroundradio-backend undergroundradio-frontend
sudo systemctl status undergroundradio-backend undergroundradio-frontend
```

## 6. nginx + HTTPS

```bash
sudo cp deploy/nginx/undergroundradio.conf /etc/nginx/sites-available/undergroundradio.conf
sudo ln -s /etc/nginx/sites-available/undergroundradio.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d undergroundradio.us -d www.undergroundradio.us
```

certbot rewrites the nginx config in place to add the HTTPS server block + HTTP→HTTPS redirect.

## 7. Verify

```bash
curl -I https://undergroundradio.us/
curl -X POST https://undergroundradio.us/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"<real user>","password":"<real password>"}'
```

The first should return the Next.js page; the second should return real
`access`/`refresh` tokens (or a 401 for bad credentials — either means routing
is working).

## Also worth doing before going live (flagged earlier, not fixed here)

- `ug_radio_django/.env` is committed to git with a real Neon Postgres password,
  and `myapp/db.py` has a hardcoded MongoDB credential committed across several
  commits — rotate both and stop tracking `.env` going forward.
