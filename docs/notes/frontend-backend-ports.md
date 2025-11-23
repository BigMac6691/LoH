# Frontend and Backend Port Configuration

## Port Overview

- **Port 5173** = Frontend (Vite dev server) - This is what you access in your browser
- **Port 3000** = Backend API (Docker container) - Internal API server

## How They Work Together

1. **You access the frontend at:** `http://localhost:5173` (or `https://localhost:5173` if using HTTPS)
2. **Frontend uses Vite proxy** to forward `/api/*` requests to the backend
3. **Backend runs in Docker** on port 3000 (mapped to host port 3000)
4. **Vite proxy** handles the connection between frontend and backend

## Vite Proxy Configuration

The frontend (`vite.config.js`) has a proxy that:
- Intercepts requests starting with `/api`
- Forwards them to `https://localhost:3000` (backend)
- Handles HTTPS/SSL certificates automatically

## Testing

### Test Frontend:
```
http://localhost:5173
```

### Test Backend Directly:
```
https://localhost:3000/api/health
```

### Frontend → Backend (via proxy):
When frontend calls `/api/auth/login`, it goes:
1. Frontend (5173) → Vite proxy → Backend (3000)
2. Browser only sees the frontend URL (5173)
3. Backend responses come back through the proxy

---

## Troubleshooting

### "Connection refused" or "Network error"

**Possible causes:**
1. Backend not running (check `docker compose ps`)
2. Proxy target wrong (check `vite.config.js`)
3. Port 3000 blocked

**Solution:**
```bash
# Check backend is running
docker compose ps

# Check backend logs
docker compose logs api --tail 20

# Test backend directly
curl -k https://localhost:3000/api/health
```

### Mixed Content Warning

**If frontend is HTTP but backend is HTTPS:**
- Browser may block mixed content
- Solution: Use HTTPS for both, or HTTP for both

### CORS Errors

**If you see CORS errors:**
- Backend CORS is configured to allow frontend
- Check `backend/server.js` has `app.use(cors())`
- Verify proxy is working (should handle CORS automatically)

---

## Quick Reference

**Ports:**
- Frontend: `5173` (Vite dev server)
- Backend: `3000` (Docker container)

**URLs:**
- Frontend: `http://localhost:5173`
- Backend API: `https://localhost:3000/api/*`
- Frontend API calls: `/api/*` (proxied to backend)

**Testing:**
- Frontend: Open browser to `http://localhost:5173`
- Backend: `curl -k https://localhost:3000/api/health`

