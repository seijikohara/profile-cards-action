/** Recover the value bands behind an API-supplied contribution level. */

import type { DayContribution } from '../model.js';

/**
 * Lower bounds of levels 1..4 for a calendar the API already leveled.
 *
 * The contribution calendar ships a quartile level per day but never the cuts
 * it used, so the ramp on a card is a scale with no units. Each level's lowest
 * observed count IS its lower bound, which recovers the cuts exactly from data
 * already fetched.
 *
 * A level nobody reached has no observed minimum. It inherits the next level's
 * floor, which keeps the bounds non-decreasing and makes the empty band render
 * as a dash instead of as a range starting at zero.
 */
export function calendarThresholds(days: readonly DayContribution[]): [number, number, number, number] {
  const floorAt = (level: number): number => {
    const counts = days.filter((day) => day.level === level).map((day) => day.count);
    return counts.length === 0 ? 0 : Math.min(...counts);
  };
  const q4 = floorAt(4);
  const q3 = floorAt(3) || q4;
  const q2 = floorAt(2) || q3;
  const q1 = floorAt(1) || q2;
  return [q1, q2, q3, q4];
}
