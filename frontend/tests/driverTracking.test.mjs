import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Exercise the production TypeScript without adding a test framework.
const directory = mkdtempSync(join(tmpdir(), 'fleetops-tracking-'));
for (const name of ['tripProgress', 'driverLocation']) {
  const source = readFileSync(new URL(`../src/services/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  writeFileSync(join(directory, `${name}.mjs`), code.replace("'./tripProgress'", "'./tripProgress.mjs'"));
}
const { coordinates, tripProgress, distanceMeters } = await import(pathToFileURL(join(directory, 'tripProgress.mjs')));
const { startDriverLocation } = await import(pathToFileURL(join(directory, 'driverLocation.mjs')));
after(() => rmSync(directory, { recursive: true, force: true }));
const flush = () => new Promise(setImmediate);

function device(report = async () => {}) {
  let clock = 1_800_000_000_000;
  let accept, reject;
  const seen = [], reports = [], gps = [], sync = [], cleared = [];
  let refreshes = 0;
  const geolocation = {
    watchPosition(success, error) { accept = success; reject = error; return 0; },
    clearWatch(id) { cleared.push(id); },
    getCurrentPosition() { refreshes++; },
  };
  const controller = startDriverLocation({
    geolocation, now: () => clock,
    report: async (fix) => { reports.push(fix); return report(fix); },
    onPosition: (fix) => seen.push(fix), onGps: (s) => gps.push(s), onSync: (s) => sync.push(s),
  });
  return { controller, seen, reports, gps, sync, cleared,
    advance: (ms) => { clock += ms; },
    fix: (lat = 13.7, lng = -89.2, accuracy = 10, age = 0) => accept({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: clock - age }),
    reject: (code) => reject({ code }), get refreshes() { return refreshes; },
  };
}

test('missing, non-finite and out-of-range coordinates do not fabricate progress', () => {
  for (const pair of [[null, null], [undefined, 0], [NaN, 0], [Infinity, 0], [91, 0], [0, 181], ['0', '0']]) {
    assert.equal(coordinates(...pair), null);
  }
  assert.deepEqual(coordinates(0, 0), { lat: 0, lng: 0 });
  assert.equal(tripProgress(null, { lat: 0, lng: 1 }, { lat: 0, lng: 0 }).percent, null);
});

test('progress reflects proximity, handles detours, and never claims automatic arrival', () => {
  const start = { lat: 0, lng: 0 }, destination = { lat: 0, lng: 1 };
  assert.equal(tripProgress(start, destination, start).percent, 0);
  assert.equal(tripProgress(start, destination, { lat: 0, lng: 0.5 }).percent, 50);
  assert.equal(tripProgress(start, destination, { lat: 0, lng: -0.5 }).percent, 0);
  assert.equal(tripProgress(start, destination, destination).percent, 99);
  assert.equal(tripProgress(start, destination, destination, true).percent, 100);
  assert.equal(tripProgress(start, start, start).percent, null);
  assert.ok(distanceMeters({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }) < 23_000);
});

test('every fresh GPS fix updates the screen while reporting at most every 30 seconds', async () => {
  const d = device();
  d.fix(); await flush();
  d.advance(1000); d.fix(13.71); await flush();
  d.advance(1000); d.fix(13.72); await flush();
  assert.equal(d.seen.length, 3);
  assert.equal(d.reports.length, 1);
  d.advance(28_000); d.fix(13.73); await flush();
  assert.equal(d.reports.length, 2);
  assert.equal(d.reports[1].lat, 13.73);
  d.controller.stop();
});

test('old, inaccurate and invalid fixes never move the vehicle or reach the API', async () => {
  const d = device();
  d.fix(100); d.fix(13.7, -89.2, 500); d.fix(13.7, -89.2, 10, 46_000);
  await flush();
  assert.equal(d.seen.length, 0);
  assert.equal(d.reports.length, 0);
  assert.ok(d.gps.includes('imprecise'));
  d.controller.stop();
});

test('cached and out-of-order locations are not replayed as new breadcrumbs', async () => {
  const d = device(); d.fix(); await flush();
  d.advance(30_000); d.fix(13.7, -89.2, 10, 30_000); await flush();
  assert.equal(d.reports.length, 1);
  d.fix(13.8); await flush();
  const count = d.seen.length;
  d.fix(13.9, -89.2, 10, 5_000);
  assert.equal(d.seen.length, count);
  d.controller.stop();
});

test('failed network reports leave local GPS usable and retry with a fresh position', async () => {
  let fail = true;
  const d = device(async () => { if (fail) throw new Error('offline'); });
  d.fix(); await flush();
  assert.equal(d.sync.at(-1), 'error');
  assert.equal(d.seen.length, 1);
  fail = false; d.advance(30_000); d.fix(13.8); await flush();
  assert.equal(d.sync.at(-1), 'saved');
  assert.equal(d.reports.at(-1).lat, 13.8);
  d.controller.stop();
});

test('trip cleanup stops the watch and ignores pending callbacks and reports', async () => {
  const d = device(); d.fix(); d.controller.stop(); await flush();
  assert.deepEqual(d.cleared, [0]);
  assert.equal(d.reports.length, 0);
  const count = d.seen.length; d.advance(60_000); d.fix(); d.controller.refresh();
  assert.equal(d.seen.length, count);
  assert.equal(d.refreshes, 0);
});

test('a slow report does not overlap later location reports', async () => {
  let resolve;
  const d = device(() => new Promise((r) => { resolve = r; }));
  d.fix(); await flush(); d.advance(30_000); d.fix(13.8); await flush();
  assert.equal(d.reports.length, 1);
  d.controller.stop(); resolve(); await flush();
  assert.notEqual(d.sync.at(-1), 'saved');
});

test('denied permission is surfaced without repeated permission attempts', () => {
  const d = device(); d.reject(1); d.controller.refresh(); d.fix();
  assert.equal(d.gps.at(-1), 'denied');
  assert.equal(d.refreshes, 0);
  assert.equal(d.seen.length, 0);
  d.controller.stop();
});

test('devices without geolocation receive a clear state and can clean up safely', () => {
  const states = [];
  const controller = startDriverLocation({ report: async () => {}, onPosition() {}, onGps: (s) => states.push(s), onSync() {} });
  assert.deepEqual(states, ['unavailable']);
  controller.refresh(); controller.stop();
});
