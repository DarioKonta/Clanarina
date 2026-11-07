/**
 * Kick box članarina — Google Apps Script backend.
 *
 * Setup (once): open the Google Sheet → Extensions → Apps Script → paste this file →
 * run `setup` → copy the secret from the log → Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone) → copy the /exec URL into the app.
 * Updating: paste the new file → Deploy → Manage deployments → ✏️ → New version → Deploy.
 * Full steps: apps-script/README.md
 *
 * API (POST, JSON body):
 *   { action: "ping", secret }
 *   { action: "push", secret, members: [...], memberships: [...], attendance: [...] }
 *   { action: "pull", secret, since: ISO | null }
 * Every response carries `schema` so the app can tell an outdated script apart.
 * Every row keeps `syncedAt` = server time of its last write; `pull` returns rows
 * with syncedAt > since. Conflicts: last write wins by `updatedAt`.
 *
 * Columns are matched by the header names in row 1, so their order doesn't matter.
 * Missing columns (e.g. after an app update) are appended automatically.
 */

var SCHEMA = 2;

var TABLES = {
  members: {
    sheet: 'Clanovi',
    columns: [
      'id', 'firstName', 'lastName', 'phone', 'note', 'groupName', 'price', 'birthDate', 'joinedAt',
      'active', 'createdAt', 'updatedAt', 'deleted', 'syncedAt',
    ],
  },
  memberships: {
    sheet: 'Clanarine',
    columns: ['id', 'memberId', 'periodStart', 'months', 'periodEnd', 'amount', 'paidAt', 'note', 'createdAt', 'updatedAt', 'deleted', 'syncedAt'],
  },
  attendance: {
    sheet: 'Prisustvo',
    columns: ['id', 'memberId', 'date', 'createdAt', 'updatedAt', 'deleted', 'syncedAt'],
  },
};

var DATE_COLUMNS = { periodStart: true, periodEnd: true, paidAt: true, birthDate: true, joinedAt: true, date: true };

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'bad_json' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return json({ ok: false, error: 'unauthorized' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json({ ok: false, error: 'busy' });
  try {
    var serverTime = new Date().toISOString();
    if (body.action === 'ping') return json({ ok: true, serverTime: serverTime, schema: SCHEMA });
    if (body.action === 'push') {
      for (var table in TABLES) upsert(table, body[table] || [], serverTime);
      return json({ ok: true, serverTime: serverTime, schema: SCHEMA });
    }
    if (body.action === 'pull') {
      var out = { ok: true, serverTime: serverTime, schema: SCHEMA };
      for (var t in TABLES) out[t] = readSince(t, body.since);
      return json(out);
    }
    return json({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/** Health check in a browser: shows that the deployment is reachable. */
function doGet() {
  return json({ ok: true, app: 'clanarina', schema: SCHEMA });
}

// ---------- helpers ----------

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns the sheet and its header (column names in sheet order). Creates the
 * sheet if needed and appends any expected column that is missing.
 */
function getSheet(table) {
  var def = TABLES[table];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.sheet);
  if (!sh) sh = ss.insertSheet(def.sheet);

  var header = [];
  if (sh.getLastColumn() > 0 && sh.getLastRow() > 0) {
    header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
      return String(h).trim();
    });
    while (header.length && header[header.length - 1] === '') header.pop();
  }
  var missing = def.columns.filter(function (c) {
    return header.indexOf(c) < 0;
  });
  if (missing.length) {
    sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    header = header.concat(missing);
    sh.setFrozenRows(1);
  }
  // Plain text everywhere so Sheets never turns dates/ids into other types.
  sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@');
  return { sheet: sh, header: header };
}

/** Reads the sheet into { sheet, header, rows: [{ obj, rowIndex }] }. */
function readAll(table) {
  var s = getSheet(table);
  var sh = s.sheet;
  var header = s.header;
  var last = sh.getLastRow();
  var rows = [];
  if (last >= 2) {
    var values = sh.getRange(2, 1, last - 1, header.length).getValues();
    var tz = Session.getScriptTimeZone();
    for (var i = 0; i < values.length; i++) {
      var obj = {};
      for (var c = 0; c < header.length; c++) {
        var col = header[c];
        if (!col) continue;
        var v = values[i][c];
        if (v instanceof Date) {
          v = DATE_COLUMNS[col] ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
        }
        obj[col] = v === null || v === undefined ? '' : String(v);
      }
      if (obj.id) rows.push({ obj: obj, rowIndex: i + 2 });
    }
  }
  return { sheet: sh, header: header, rows: rows };
}

/** Row values in sheet order. Columns the app doesn't know keep their old value. */
function toCells(header, obj, previous) {
  return header.map(function (col, i) {
    if (!col || !(col in obj)) return previous ? previous[i] : '';
    var v = obj[col];
    if (v === null || v === undefined) return '';
    if (v === true) return '1';
    if (v === false) return '0';
    return String(v);
  });
}

function upsert(table, incoming, serverTime) {
  if (!incoming.length) return;
  var data = readAll(table);
  var header = data.header;
  var byId = {};
  data.rows.forEach(function (r) {
    byId[r.obj.id] = r;
  });
  var appends = [];
  incoming.forEach(function (row) {
    if (!row || !row.id || !row.updatedAt) return;
    var existing = byId[row.id];
    var rec = {};
    for (var k in row) rec[k] = row[k];
    rec.syncedAt = serverTime;
    if (!existing) {
      appends.push(toCells(header, rec, null));
      byId[row.id] = { obj: rec, rowIndex: -1 };
    } else if (existing.rowIndex > 0 && String(row.updatedAt) > String(existing.obj.updatedAt)) {
      var range = data.sheet.getRange(existing.rowIndex, 1, 1, header.length);
      range.setValues([toCells(header, rec, range.getValues()[0])]);
      existing.obj = rec;
    }
    // Otherwise the sheet already has a newer version; the client gets it on pull.
  });
  if (appends.length) {
    var start = data.sheet.getLastRow() + 1;
    data.sheet.getRange(start, 1, appends.length, header.length).setValues(appends);
  }
}

function readSince(table, since) {
  return readAll(table)
    .rows.map(function (r) {
      return r.obj;
    })
    .filter(function (o) {
      return !since || String(o.syncedAt) > String(since);
    });
}

// ---------- manual editing support ----------

/**
 * Simple trigger: when someone edits a row by hand in the sheet, stamp it so
 * phones pick up the change on the next pull. Adds an id to new hand-typed rows.
 */
function onEdit(e) {
  var sh = e.range.getSheet();
  var table = null;
  for (var key in TABLES) if (TABLES[key].sheet === sh.getName()) table = key;
  if (!table) return;
  if (e.range.getRow() === 1 && e.range.getLastRow() === 1) return; // header edit
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  var idx = function (col) {
    return header.indexOf(col);
  };
  var now = new Date().toISOString();
  var first = Math.max(e.range.getRow(), 2);
  var last = e.range.getLastRow();
  for (var r = first; r <= last; r++) {
    var values = sh.getRange(r, 1, 1, header.length).getValues()[0];
    var isEmpty = values.every(function (v) {
      return v === '' || v === null;
    });
    if (isEmpty) continue;
    var set = function (col, value) {
      if (idx(col) >= 0) sh.getRange(r, idx(col) + 1).setValue(value);
    };
    var get = function (col) {
      return idx(col) >= 0 ? values[idx(col)] : '';
    };
    if (!get('id')) set('id', Utilities.getUuid());
    if (!get('createdAt')) set('createdAt', now);
    if (table === 'members' && get('active') === '') set('active', '1');
    if (get('deleted') === '') set('deleted', '0');
    set('updatedAt', now);
    set('syncedAt', now);
  }
}

// ---------- one-time setup ----------

/** Run once from the editor: creates tabs/headers and a secret (see Logs). Safe to run again. */
function setup() {
  for (var table in TABLES) getSheet(table);
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('SECRET', secret);
  }
  Logger.log('Tajni ključ (unesi u aplikaciju): ' + secret);
}
