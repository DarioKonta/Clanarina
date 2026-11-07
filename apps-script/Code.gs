/**
 * Kick box članarina — Google Apps Script backend.
 *
 * Setup (once): open the Google Sheet → Extensions → Apps Script → paste this file →
 * run `setup` → copy the secret from the log → Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone) → copy the /exec URL into the app.
 * Full steps: apps-script/README.md
 *
 * API (POST, JSON body):
 *   { action: "ping", secret }
 *   { action: "push", secret, members: [...], memberships: [...] }
 *   { action: "pull", secret, since: ISO | null }
 * Every row keeps `syncedAt` = server time of its last write; `pull` returns rows
 * with syncedAt > since. Conflicts: last write wins by `updatedAt`.
 */

var TABLES = {
  members: {
    sheet: 'Clanovi',
    columns: ['id', 'firstName', 'lastName', 'phone', 'note', 'active', 'createdAt', 'updatedAt', 'deleted', 'syncedAt'],
  },
  memberships: {
    sheet: 'Clanarine',
    columns: ['id', 'memberId', 'periodStart', 'months', 'periodEnd', 'amount', 'paidAt', 'note', 'createdAt', 'updatedAt', 'deleted', 'syncedAt'],
  },
};

var DATE_COLUMNS = { periodStart: true, periodEnd: true, paidAt: true };

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
    if (body.action === 'ping') return json({ ok: true, serverTime: serverTime });
    if (body.action === 'push') {
      upsert('members', body.members || [], serverTime);
      upsert('memberships', body.memberships || [], serverTime);
      return json({ ok: true, serverTime: serverTime });
    }
    if (body.action === 'pull') {
      return json({
        ok: true,
        serverTime: serverTime,
        members: readSince('members', body.since),
        memberships: readSince('memberships', body.since),
      });
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
  return json({ ok: true, app: 'clanarina' });
}

// ---------- helpers ----------

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(table) {
  var def = TABLES[table];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.sheet);
  if (!sh) {
    sh = ss.insertSheet(def.sheet);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, def.columns.length).setValues([def.columns]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  // Plain text everywhere so Sheets never turns dates/ids into other types.
  sh.getRange(1, 1, sh.getMaxRows(), def.columns.length).setNumberFormat('@');
  return sh;
}

/** Reads the sheet into { header, rows: [{ obj, rowIndex }] }. */
function readAll(table) {
  var def = TABLES[table];
  var sh = getSheet(table);
  var last = sh.getLastRow();
  var rows = [];
  if (last >= 2) {
    var values = sh.getRange(2, 1, last - 1, def.columns.length).getValues();
    var tz = Session.getScriptTimeZone();
    for (var i = 0; i < values.length; i++) {
      var obj = {};
      for (var c = 0; c < def.columns.length; c++) {
        var col = def.columns[c];
        var v = values[i][c];
        if (v instanceof Date) {
          v = DATE_COLUMNS[col] ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
        }
        obj[col] = v === null || v === undefined ? '' : String(v);
      }
      if (obj.id) rows.push({ obj: obj, rowIndex: i + 2 });
    }
  }
  return { sheet: sh, rows: rows };
}

function toCells(table, obj) {
  return TABLES[table].columns.map(function (col) {
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
      appends.push(toCells(table, rec));
      byId[row.id] = { obj: rec, rowIndex: -1 };
    } else if (existing.rowIndex > 0 && String(row.updatedAt) > String(existing.obj.updatedAt)) {
      data.sheet.getRange(existing.rowIndex, 1, 1, TABLES[table].columns.length).setValues([toCells(table, rec)]);
      existing.obj = rec;
    }
    // Otherwise the sheet already has a newer version; the client gets it on pull.
  });
  if (appends.length) {
    var start = data.sheet.getLastRow() + 1;
    data.sheet.getRange(start, 1, appends.length, TABLES[table].columns.length).setValues(appends);
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
  var cols = TABLES[table].columns;
  var now = new Date().toISOString();
  var first = Math.max(e.range.getRow(), 2);
  var last = e.range.getLastRow();
  for (var r = first; r <= last; r++) {
    var values = sh.getRange(r, 1, 1, cols.length).getValues()[0];
    var isEmpty = values.every(function (v) {
      return v === '' || v === null;
    });
    if (isEmpty) continue;
    var set = function (col, value) {
      sh.getRange(r, cols.indexOf(col) + 1).setValue(value);
    };
    if (!values[cols.indexOf('id')]) set('id', Utilities.getUuid());
    if (!values[cols.indexOf('createdAt')]) set('createdAt', now);
    if (table === 'members' && values[cols.indexOf('active')] === '') set('active', '1');
    if (values[cols.indexOf('deleted')] === '') set('deleted', '0');
    set('updatedAt', now);
    set('syncedAt', now);
  }
}

// ---------- one-time setup ----------

/** Run once from the editor: creates tabs/headers and a secret (see Logs). */
function setup() {
  getSheet('members');
  getSheet('memberships');
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('SECRET', secret);
  }
  Logger.log('Tajni ključ (unesi u aplikaciju): ' + secret);
}
