# Google Sheets backend setup

1. Create a new Google Sheet, e.g. "Članarine kik boks".
2. Go to **Extensions → Apps Script**. Delete the sample code and paste in all of [`Code.gs`](Code.gs). Save.
3. In the toolbar, select the `setup` function and click **Run**. Allow access when asked; the warning "Google hasn't verified this app" is expected for your own script, so click **Advanced → Go to …**.
   - This creates the tabs **Clanovi** and **Clanarine** with their headers.
   - Open **View → Logs** (Execution log) and copy the **secret key**.
4. **Deploy → New deployment** → type **Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. In the app, open **Podešavanja**, enter the URL and the secret key, then tap **Proveri vezu** and **Sačuvaj**.

## After changing Code.gs
**Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** The URL stays the same.

## Notes
- The sheet is plain text. Dates are `YYYY-MM-DD`; `active`/`deleted` are `1`/`0`.
- You can edit rows by hand. The `onEdit` trigger updates `updatedAt`, so the phones pick up the change. A new row typed by hand gets an `id` automatically.
- To delete, set `deleted` to `1` rather than deleting the row. Otherwise the phones will push it back.
- To change the secret: **Project Settings → Script properties → SECRET**, then update it on every phone.
