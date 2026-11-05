/**
 * EFB 브리핑 앱 — 저장용 백엔드 (Google Apps Script Web App)  SPEC §7.3
 *
 * 설치:
 *  1. 새 Google Sheet 생성 → 확장 프로그램 → Apps Script → 이 파일 내용 붙여넣기
 *  2. 편집기에서 setup() 실행 (권한 승인) → 실행 로그에 출력된 토큰을 앱 Settings에 입력
 *  3. 배포 → 새 배포 → 유형 "웹 앱" / 실행: 나 / 액세스: 모든 사용자 → /exec URL을 앱 Settings에 입력
 *  ※ 코드를 고친 뒤에는 "배포 관리 → 편집 → 새 버전"으로 다시 배포해야 반영된다.
 *
 * 요청: POST, Content-Type: text/plain, 본문 JSON { token, op, ... }
 *   op=upsertLog { records:[{logId,...}], flights:[{flightId,flightNo,dep,arr,std}] }
 *      → { ok, results:[{logId, status:'inserted'|'duplicate'|'error'}], warnings? }
 *   op=listLogs  { flightId? } → { ok, logs:[...] }
 *   op=ping      → { ok, pong }
 * 토큰은 Script Properties(API_TOKEN)에만 저장한다. 코드에 쓰지 않는다.
 */

var VERSION = '0.2.0';
var SHEET_NAME = 'Logs';
// 새 칸은 항상 맨 뒤에 추가 (기존 시트와 열 위치 호환)
var HEADERS = ['logId', 'flightId', 'kind', 'wpt', 'ata', 'fuel', 'note', 'createdAt', 'receivedAt', 'seq', 'unit', 'void'];
var MAX_RECORDS = 200;

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!expected || !safeEqual_(String(req.token || ''), expected)) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    switch (req.op) {
      case 'upsertLog':
        return json_(upsertLog_(req.records || [], req.flights || []));
      case 'listLogs':
        return json_({ ok: true, logs: listLogs_(req.flightId) });
      case 'ping':
        return json_({ ok: true, pong: true, version: VERSION, now: new Date().toISOString() });
      default:
        return json_({ ok: false, error: 'unknown op' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** 헬스체크만. 기록 조회는 토큰이 URL에 남지 않도록 POST op=listLogs 사용 */
function doGet() {
  return json_({ ok: true, service: 'efb-backend', version: VERSION });
}

function upsertLog_(records, flights) {
  if (!Array.isArray(records)) throw new Error('records must be array');
  if (records.length > MAX_RECORDS) throw new Error('too many records (max ' + MAX_RECORDS + ')');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // 동시 요청 시 중복 검사 경쟁 방지
  try {
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    var existing = {};
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
        existing[String(r[0])] = true;
      });
    }

    var receivedAt = new Date().toISOString();
    var rows = [];
    var results = [];
    var touched = {};

    records.forEach(function (r) {
      var id = r && typeof r.logId === 'string' ? r.logId : '';
      if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
        results.push({ logId: id, status: 'error', error: 'invalid logId' });
        return;
      }
      if (existing[id]) {
        results.push({ logId: id, status: 'duplicate' });
        return;
      }
      existing[id] = true;
      rows.push([
        id,
        cell_(r.flightId),
        cell_(r.kind),
        cell_(r.wpt),
        cell_(r.ata),
        typeof r.fuel === 'number' ? r.fuel : '',
        cell_(r.note),
        cell_(r.createdAt),
        receivedAt,
        typeof r.seq === 'number' ? r.seq : '',
        cell_(r.unit),
        r.void === true ? 'VOID' : '',
      ]);
      results.push({ logId: id, status: 'inserted' });
      if (r.flightId) touched[r.flightId] = true;
    });

    if (rows.length) {
      sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.length).setValues(rows);
      SpreadsheetApp.flush();
    }

    // 비행 단위 JSON 백업 (실패해도 기록 저장은 성공으로 응답)
    var warnings = [];
    var meta = {};
    (flights || []).forEach(function (f) {
      if (f && f.flightId) meta[f.flightId] = f;
    });
    Object.keys(touched).forEach(function (fid) {
      try {
        backupFlight_(fid, meta[fid]);
      } catch (err) {
        warnings.push('backup ' + fid + ': ' + err);
      }
    });

    return { ok: true, results: results, warnings: warnings };
  } finally {
    lock.releaseLock();
  }
}

function listLogs_(flightId) {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values
    .map(function (row) {
      var o = {};
      HEADERS.forEach(function (h, i) {
        o[h] = row[i];
      });
      return o;
    })
    .filter(function (o) {
      return !flightId || o.flightId === flightId;
    });
}

/** 파일명: YYYYMMDD_HHMM_편명_출발-도착.json (STD 기준 한국시간). 같은 비행은 같은 파일을 덮어쓴다 */
function backupFlight_(flightId, f) {
  var name;
  if (f && f.std && f.flightNo && f.dep && f.arr) {
    var stamp = Utilities.formatDate(new Date(f.std), 'Asia/Seoul', 'yyyyMMdd_HHmm');
    name = stamp + '_' + safeName_(f.flightNo) + '_' + safeName_(f.dep) + '-' + safeName_(f.arr) + '.json';
  } else {
    name = safeName_(flightId) + '.json';
  }
  var payload = JSON.stringify({ flightId: flightId, flight: f || null, exportedAt: new Date().toISOString(), logs: listLogs_(flightId) }, null, 2);
  var folder = getBackupFolder_();
  var files = folder.getFilesByName(name);
  if (files.hasNext()) files.next().setContent(payload);
  else folder.createFile(name, payload, MimeType.PLAIN_TEXT);
}

// ---------- 설치·유틸 ----------

/** 최초 1회 편집기에서 실행: 시트 헤더 생성 + 토큰 발급 + 백업 폴더 생성 */
function setup() {
  getSheet_();
  getBackupFolder_();
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) {
    props.setProperty('API_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  Logger.log('API_TOKEN (앱 Settings에 입력, 외부 공유 금지): ' + props.getProperty('API_TOKEN'));
}

/** 토큰 유출 의심 시 실행 → 새 토큰을 앱에 다시 입력 */
function rotateToken() {
  PropertiesService.getScriptProperties().deleteProperty('API_TOKEN');
  setup();
}

function getSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('spreadsheet not found (시트에 바인딩하거나 SPREADSHEET_ID 설정)');
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // 이전 버전 시트: 머리줄에 새 칸 이름만 추가 (기존 데이터 열은 그대로)
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function getBackupFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      /* 삭제됨 → 새로 생성 */
    }
  }
  var folder = DriveApp.createFolder('EFB Backups');
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}

/** 시트 수식 주입 방지 (=, +, -, @ 로 시작하는 문자열) */
function cell_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).slice(0, 5000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function safeName_(s) {
  return String(s).replace(/[^A-Za-z0-9_-]/g, '');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
