# Google Sheets backend setup

1. Create a new Google Sheet, e.g. "Članarine kik boks".
2. Go to **Extensions → Apps Script**. Delete the sample code and paste in all of [`Code.gs`](Code.gs). Save.
3. In the toolbar, select the `setup` function and click **Run**. Allow access when asked; the warning "Google hasn't verified this app" is expected for your own script, so click **Advanced → Go to …**.
   - This creates the tabs **Clanovi**, **Clanarine** and **Prisustvo** with their headers.
   - Open **View → Logs** (Execution log) and copy the **secret key**.
4. **Deploy → New deployment** → type **Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. In the app, open **Podešavanja**, enter the URL and the secret key, then tap **Poveži i sačuvaj** (it tests the connection and saves).
   Step-by-step guide with troubleshooting: [docs/secret-key.md](../docs/secret-key.md).

## After changing Code.gs (or when the app says the script is outdated)
1. **Extensions → Apps Script**, delete the old code, paste the new [`Code.gs`](Code.gs), save.
2. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** The URL and secret stay the same.

Missing columns and tabs are added automatically on the next sync; existing rows are kept. Columns are matched
by the names in row 1, so their order doesn't matter, and extra columns you add by hand are left alone.

**Schema 2 (app v1.1.0):** adds `groupName`, `price`, `birthDate`, `joinedAt` to **Clanovi** and the **Prisustvo**
tab (attendance). The app refuses to sync with an older script ("Skripta u Google Sheets je zastarela") so no data
is lost; it keeps everything on the phone until the script is updated. The new script still works with older apps.

## Notes
- The sheet is plain text. Dates are `YYYY-MM-DD`; `active`/`deleted` are `1`/`0`; `price` is whole RSD (empty = club default).
- You can edit rows by hand. The `onEdit` trigger updates `updatedAt`, so the phones pick up the change. A new row typed by hand gets an `id` automatically.
- To delete, set `deleted` to `1` rather than deleting the row. Otherwise the phones will push it back.
- To change the secret: **Project Settings → Script properties → SECRET**, then update it on every phone.
