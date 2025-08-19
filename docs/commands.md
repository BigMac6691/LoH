# LoH – Common Commands

## Docker / Compose
- Start stack (build if needed):  
  `docker compose up -d --build`
- Force fresh rebuild:  
  `docker compose build --no-cache && docker compose up -d`
- Show containers:  
  `docker compose ps`
- View logs (last 100 lines):  
  `docker compose logs api -n 100`  
  `docker compose logs db -n 100`
- Stop stack (keep data volume):  
  `docker compose down`
- Stop stack AND delete data volume (DANGEROUS – wipes DB):  
  `docker compose down -v`

## Postgres inside container
- Open psql shell:  
  `docker compose exec -it db psql -U "$PGUSER" -d "$PGDATABASE"`
- Quick query:  
  `docker compose exec -T db psql -U "$PGUSER" -d "$PGDATABASE" -c "SELECT now()"`

## Volumes (DB persistence)
- List volumes:  
  `docker volume ls`
- Inspect pg volume:  
  `docker volume inspect pgdata`
- Backup DB (custom format):  
  `docker compose exec -T db pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc > backups/loh_$(date +%F).dump`
- Restore to new DB:  
  `docker compose exec -T db createdb -U "$PGUSER" loh_restore`
  `docker compose exec -T db pg_restore -U "$PGUSER" -d loh_restore -c < backups/loh_YYYY-MM-DD.dump`
- Docker (wipe DB volume):
  `docker compose down -v`
  `docker compose up -d`
  `docker compose exec api node scripts/migrate.js`
- Drop schema from psql (faster than deleting volume):
  `docker compose exec -it db psql -U "$PGUSER" -d "$PGDATABASE" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
  `docker compose exec api node scripts/migrate.js`

## Backend (in container)
- Run migrations:  
`docker compose exec api node scripts/migrate.js`

## Backend (WSL host – if running locally)
- Install deps:  
`cd backend && npm install`
- Start dev:  
`npm run dev`
- Run migrations:  
`node scripts/migrate.js`

## Frontend (WSL host)
- Install deps:  
`cd frontend && npm install`
- Start dev (Vite):  
`npm run dev` → http://localhost:5173

## Git / Safety
- Trust this repo path for Git (WSL):  
`git config --global --add safe.directory /home/<you>/projects/LoH`
- Avoid CRLF issues:  
`git config --global core.autocrlf input`
