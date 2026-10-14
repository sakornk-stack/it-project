// Snapshot of the ACTIVE courses of ICT curriculum 2564 (read from the dev DB on
// 2026-10-14), used by engine.spec.ts so the generator can be tested without a
// database. The seed script never uses this: it loads the live catalog and
// checks it against PLAN before planning anything.
import type { CatalogCourse } from './engine';

// code, credits, isRequired, prerequisite codes (active prerequisites only)
const ROWS: [string, number, boolean, string[]][] = [
  ['01175129', 1, true, []],
  ['01175153', 1, true, []],
  ['01355101', 3, true, []],
  ['01355102', 3, true, []],
  ['01355103', 3, true, []],
  ['01371111', 1, true, []],
  ['01387102', 3, true, []],
  ['01417111', 3, true, []],
  ['01999111', 2, true, []],
  ['01999213', 3, true, []],
  ['02032304', 2, false, []],
  ['02701011', 3, true, []],
  ['02714101', 3, true, []],
  ['02721101', 3, true, []],
  ['02721121', 3, true, []],
  ['02738453', 3, false, []],
  ['02738473', 3, false, []],
  ['02739111', 3, true, []],
  ['02739112', 3, true, ['02739111']],
  ['02739161', 3, true, []],
  ['02739211', 3, true, ['02739112']],
  ['02739212', 3, true, ['02739112']],
  ['02739221', 3, true, ['02739112']],
  ['02739231', 3, true, ['02739112']],
  ['02739232', 3, true, []],
  ['02739241', 3, true, ['02739112']],
  ['02739242', 3, true, ['02739211']],
  ['02739243', 3, true, []],
  ['02739321', 3, true, ['02739221']],
  ['02739322', 3, true, ['02739221']],
  ['02739323', 3, true, ['02739221']],
  ['02739326', 3, false, []],
  ['02739327', 1, true, ['02739221']],
  ['02739331', 3, true, ['02739231']],
  ['02739341', 3, true, ['02739112']],
  ['02739342', 3, true, ['02739112']],
  ['02739344', 3, false, []],
  ['02739351', 3, true, []],
  ['02739352', 3, true, ['02739112']],
  ['02739353', 3, true, []],
  ['02739354', 3, true, []],
  ['02739391', 1, true, []],
  ['02739397', 1, true, []],
  ['02739452', 3, false, ['02739351']],
  ['02739490', 6, false, []],
  ['02739498', 3, false, []],
  ['02739499', 3, true, []],
  ['02999037', 3, true, []],
  ['02999144', 1, true, []],
  ['03751111', 3, false, []],
];

export const ICT2564_FIXTURE: CatalogCourse[] = ROWS.map(
  ([code, credits, isRequired, prereqs]) => ({
    code,
    credits,
    isRequired,
    prereqs,
  }),
);
