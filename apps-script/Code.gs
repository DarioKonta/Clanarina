/**
 * Članarina — Google Apps Script backend.
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
 *
 * The "Pregled članova" tab is a read-only view for trainers (who paid, until when).
 * It is rebuilt after every push, when the file is opened, after hand edits, daily
 * (trigger installed by `setup`) and from the menu Članarina → Osveži pregled.
 */

// 3 = adds the "Pregled članova" tab. The sync protocol is unchanged, so the app still accepts 2.
var SCHEMA = 3;

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
      try {
        refreshOverview();
      } catch (err) {
        // The overview is cosmetic; never fail a sync because of it.
      }
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

// ---------- read-only overview for trainers ----------

var OVERVIEW_SHEET = 'Pregled članova';
var EXPIRING_SOON_DAYS = 5; // keep in sync with src/domain/status.ts
var MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
var OVERVIEW_HEADER = ['Ime i prezime', 'Grupa', 'Stanje', 'Plaćeno do', 'Objašnjenje', 'Telefon'];
var OVERVIEW_WIDTHS = [200, 120, 150, 130, 300, 130];

/** Sorted most urgent first. `bg` = row color, `fg` = status text color. */
var OVERVIEW_KINDS = {
  duguje: { label: '🔴 Duguje', bg: '#F8D7D5', fg: '#B71C1C', order: 0 },
  isteklo: { label: '🟠 Isteklo', bg: '#FDE3C8', fg: '#BF5B00', order: 1 },
  istice_uskoro: { label: '🟡 Ističe uskoro', bg: '#FFF4C2', fg: '#8D6E00', order: 2 },
  placeno: { label: '🟢 Plaćeno', bg: '#DDF0DA', fg: '#1B5E20', order: 3 },
  bez_clanarine: { label: '⚪ Nema članarinu', bg: '#F3F3F3', fg: '#616161', order: 4 },
};

/** Called from onOpen, the menu and the daily trigger: waits for a running sync, never throws. */
function refreshOverviewSafely() {
  var lock = null;
  try {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return;
  } catch (err) {
    lock = null; // e.g. a simple trigger without lock access: refresh anyway
  }
  try {
    refreshOverview();
  } catch (err) {
    // Viewers without edit rights can't rewrite the tab; ignore.
  } finally {
    if (lock) lock.releaseLock();
  }
}

/** Rebuilds the "Pregled članova" tab from Clanovi + Clanarine. */
function refreshOverview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var now = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var plain = function (r) {
    return r.obj;
  };
  var view = buildOverview(readAll('members').rows.map(plain), readAll('memberships').rows.map(plain), today);

  var sh = ss.getSheetByName(OVERVIEW_SHEET);
  if (!sh) sh = ss.insertSheet(OVERVIEW_SHEET, 0);
  sh.clear();
  var cols = OVERVIEW_HEADER.length;
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
  var needRows = 5 + Math.max(view.rows.length, 1);
  if (sh.getMaxRows() < needRows) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows());

  var c = view.counts;
  var summary =
    OVERVIEW_KINDS.duguje.label + ': ' + c.duguje + (view.totalDebt ? ' (ukupno ' + formatMoneyRsd(view.totalDebt) + ')' : '') +
    '     ' + OVERVIEW_KINDS.isteklo.label + ': ' + c.isteklo +
    '     ' + OVERVIEW_KINDS.istice_uskoro.label + ': ' + c.istice_uskoro +
    '     ' + OVERVIEW_KINDS.placeno.label + ': ' + c.placeno;
  sh.getRange(1, 1).setValue('Pregled članova').setFontSize(18).setFontWeight('bold');
  sh.getRange(2, 1)
    .setValue(
      'Ažurirano: ' + formatDateKey(today) + ' u ' + Utilities.formatDate(now, tz, 'HH:mm') +
        '  ·  Ova strana se sama osvežava iz aplikacije. Ne menjaj je ručno.',
    )
    .setFontColor('#757575')
    .setFontStyle('italic');
  sh.getRange(3, 1).setValue(summary).setFontSize(12).setFontWeight('bold');

  var head = sh.getRange(5, 1, 1, cols);
  head.setValues([OVERVIEW_HEADER]).setFontWeight('bold').setBackground('#424242').setFontColor('#FFFFFF');

  var body = sh.getRange(6, 1, Math.max(view.rows.length, 1), cols);
  body.setNumberFormat('@'); // keep leading zeros in phone numbers
  if (view.rows.length) {
    body.setValues(
      view.rows.map(function (r) {
        return [r.name, r.group, OVERVIEW_KINDS[r.kind].label, r.paidUntil, r.note, r.phone];
      }),
    );
    body.setBackgrounds(
      view.rows.map(function (r) {
        var bg = OVERVIEW_KINDS[r.kind].bg;
        return OVERVIEW_HEADER.map(function () {
          return bg;
        });
      }),
    );
    sh.getRange(6, 3, view.rows.length, 1)
      .setFontColors(
        view.rows.map(function (r) {
          return [OVERVIEW_KINDS[r.kind].fg];
        }),
      )
      .setFontWeight('bold');
    sh.getRange(6, 1, view.rows.length, 1).setFontWeight('bold');
  } else {
    sh.getRange(6, 1).setValue('Još nema članova.').setFontColor('#757575');
  }
  body.setFontSize(12).setVerticalAlignment('middle');
  sh.getRange(5, 1, body.getNumRows() + 1, cols).setBorder(true, true, true, true, true, true, '#BDBDBD', null);
  sh.setFrozenRows(5);
  OVERVIEW_WIDTHS.forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });
  sh.setRowHeights(6, body.getNumRows(), 28);

  // Warn (not block) anyone who tries to type here.
  if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
    sh.protect().setDescription('Pregled se pravi automatski').setWarningOnly(true);
  }
}

/**
 * Pure: members + memberships (sheet rows as strings) → overview rows, most urgent first.
 * Mirrors memberStatus() in src/domain/status.ts. Archived and deleted members are left out.
 */
function buildOverview(members, memberships, today) {
  var byMember = {};
  memberships.forEach(function (m) {
    if (isTruthy(m.deleted) || !isDateKey(m.periodStart)) return;
    var months = Number(m.months) || 1;
    var ms = {
      start: m.periodStart,
      end: isDateKey(m.periodEnd) ? m.periodEnd : periodEndKey(m.periodStart, months),
      amount: Number(m.amount) || 0,
      paid: isDateKey(m.paidAt),
    };
    (byMember[m.memberId] = byMember[m.memberId] || []).push(ms);
  });

  var counts = { duguje: 0, isteklo: 0, istice_uskoro: 0, placeno: 0, bez_clanarine: 0 };
  var totalDebt = 0;
  var rows = [];
  members.forEach(function (mem) {
    if (isTruthy(mem.deleted) || String(mem.active) === '0') return;
    var s = overviewStatus(byMember[mem.id] || [], today);
    counts[s.kind]++;
    totalDebt += s.debt;
    rows.push({
      name: (String(mem.firstName || '') + ' ' + String(mem.lastName || '')).trim(),
      group: String(mem.groupName || ''),
      phone: String(mem.phone || ''),
      kind: s.kind,
      paidUntil: s.paidUntil ? formatDateKey(s.paidUntil) : '—',
      note: s.note,
      sortKey: s.sortKey,
    });
  });
  rows.sort(function (a, b) {
    var k = OVERVIEW_KINDS[a.kind].order - OVERVIEW_KINDS[b.kind].order;
    if (k) return k;
    if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { rows: rows, counts: counts, totalDebt: totalDebt };
}

/** One member's status with a plain-language explanation. */
function overviewStatus(list, today) {
  var paid = list.filter(function (m) {
    return m.paid;
  });
  var lastPaidEnd = paid.reduce(function (acc, m) {
    return !acc || m.end > acc ? m.end : acc;
  }, null);
  if (!list.length) {
    return { kind: 'bez_clanarine', debt: 0, paidUntil: null, note: 'Još nije uneta nijedna članarina', sortKey: '' };
  }

  var unpaid = list
    .filter(function (m) {
      return !m.paid && m.start <= today;
    })
    .sort(function (a, b) {
      return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
    });
  if (unpaid.length) {
    var debt = unpaid.reduce(function (s, m) {
      return s + m.amount;
    }, 0);
    var what = unpaid.length > 1 ? unpaid.length + ' članarine' : 'članarinu';
    return {
      kind: 'duguje',
      debt: debt,
      paidUntil: lastPaidEnd,
      note: 'Treba da plati ' + formatMoneyRsd(debt) + ' (' + what + ' od ' + formatDateKey(unpaid[0].start) + ')',
      sortKey: unpaid[0].start, // oldest debt first
    };
  }

  // Paid coverage: walk forward from today through consecutive paid periods.
  var cursor = today;
  var covered = null;
  for (;;) {
    var next = null;
    for (var i = 0; i < paid.length; i++) {
      if (paid[i].start <= cursor && paid[i].end >= cursor) next = paid[i];
    }
    if (!next) break;
    covered = next.end;
    cursor = addDaysKey(covered, 1);
  }
  if (covered) {
    var left = daysBetweenKeys(today, covered);
    if (left <= EXPIRING_SOON_DAYS) {
      var when = left === 0 ? 'Ističe danas' : left === 1 ? 'Ističe sutra' : 'Ističe za ' + daysText(left);
      return { kind: 'istice_uskoro', debt: 0, paidUntil: covered, note: when + ', treba produžiti', sortKey: covered };
    }
    return { kind: 'placeno', debt: 0, paidUntil: covered, note: 'Sve u redu, još ' + daysText(left), sortKey: covered };
  }

  var ended = list
    .map(function (m) {
      return m.end;
    })
    .filter(function (e) {
      return e < today;
    })
    .sort();
  if (ended.length) {
    var lastEnd = ended[ended.length - 1];
    var ago = daysBetweenKeys(lastEnd, today);
    return {
      kind: 'isteklo',
      debt: 0,
      paidUntil: lastPaidEnd,
      note: 'Isteklo pre ' + daysText(ago) + ', treba nova članarina',
      sortKey: invertKey(lastEnd), // most recently expired first
    };
  }
  return { kind: 'bez_clanarine', debt: 0, paidUntil: null, note: 'Članarina počinje kasnije', sortKey: '' };
}

/** 1 dan, 2 dana, 11 dana, 21 dan. */
function daysText(n) {
  return n + (n % 10 === 1 && n % 100 !== 11 ? ' dan' : ' dana');
}

function isTruthy(v) {
  var s = String(v).toLowerCase();
  return s === '1' || s === 'true';
}

function isDateKey(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

function keyToUtc(k) {
  var p = k.split('-');
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function utcToKey(t) {
  var d = new Date(t);
  var pad = function (n) {
    return (n < 10 ? '0' : '') + n;
  };
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function addDaysKey(k, n) {
  return utcToKey(keyToUtc(k) + n * 86400000);
}

function daysBetweenKeys(a, b) {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / 86400000);
}

/** start + months − 1 day, clamping the day like date-fns addMonths (31 Jan + 1 → 28 Feb). */
function periodEndKey(start, months) {
  var p = start.split('-');
  var y = Number(p[0]);
  var m = Number(p[1]) - 1 + months;
  var d = Number(p[2]);
  var daysInTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return addDaysKey(utcToKey(Date.UTC(y, m, Math.min(d, daysInTarget))), -1);
}

/** Sort key that orders dates newest first. */
function invertKey(k) {
  return String(99999999 - Number(k.replace(/-/g, '')));
}

/** "2026-11-01" → "1. nov 2026." (same as the app). */
function formatDateKey(k) {
  var p = k.split('-');
  return Number(p[2]) + '. ' + MONTHS_SHORT[Number(p[1]) - 1] + ' ' + p[0] + '.';
}

/** 3000 → "3.000 RSD". */
function formatMoneyRsd(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' RSD';
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
  if (table !== 'attendance') {
    try {
      refreshOverview();
    } catch (err) {
      // Ignore: the next push/open/daily run refreshes it.
    }
  }
}

/** Simple trigger: adds the menu and refreshes the overview when the file is opened. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Članarina').addItem('Osveži pregled', 'refreshOverviewSafely').addToUi();
  refreshOverviewSafely();
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
  // Daily refresh so "ističe za N dana" stays right even when nobody syncs.
  var hasDaily = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'refreshOverviewSafely';
  });
  if (!hasDaily) ScriptApp.newTrigger('refreshOverviewSafely').timeBased().everyDays(1).atHour(4).create();
  refreshOverview();
  Logger.log('Tajni ključ (unesi u aplikaciju): ' + secret);
}
