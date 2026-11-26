# Cabal Stock Portal

* `backend/Code.gs` – Google Apps Script API (paste into the Spreadsheet's Apps Script editor)
* `frontend/` – React + Vite + Tailwind (dark gaming UI, mobile bottom-nav)
* `docs/ARCHITECTURE.md` – FIFO + lock design

## Run the UI now (mock data, no Google needed)
```
cd frontend && npm install && npm run dev
```
Logins: `admin / admin1234`, `supplier1 / supplier1234`, `supplier2 / supplier1234`.

## Connect to Google Sheets
1. Create a Spreadsheet → Extensions ▸ Apps Script → paste `backend/Code.gs`.
2. Run `setupDatabase()` once and authorise. Open Executions/Logs: the generated **admin password** is printed there. Change it afterwards.
3. Deploy ▸ New deployment ▸ Web app ▸ Execute as **Me**, access **Anyone** → copy the `/exec` URL.
4. `cp frontend/.env.example frontend/.env` and set `VITE_API_URL=<url>`; `npm run build` and host `dist/` anywhere.
5. After editing Code.gs, use Deploy ▸ Manage deployments ▸ edit ▸ New version (the URL stays the same).
6. **Upgrading an existing sheet:** paste the new Code.gs and run `setupDatabase()` again (keeps all data; adds the new `lot_id` / `queued_at` columns to `Stock_Items` and drops a leftover `facebook_id` column). Then Deploy ▸ New version. Pieces already in the sheet keep working: each old piece counts as its own queue slot.
