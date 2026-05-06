import { SRSItem } from '../types';

/**
 * SM-2 Algorithm for Spaced Repetition
 * @param quality 0-5 scale (0: total failure, 5: perfect response)
 * @param item Current SRS item
 * @returns Updated SRS item
 */
export function updateSRSItem(quality: number, item: SRSItem): SRSItem {
  let { interval, repetitions, easeFactor } = item;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...item,
    interval,
    repetitions,
    easeFactor,
    nextReview: nextReview.toISOString(),
  };
}

export function createInitialSRSItem(id: string, type: SRSItem['type'], content: string): SRSItem {
  return {
    id,
    type,
    content,
    interval: 0,
    easeFactor: 2.5,
    nextReview: new Date().toISOString(),
    repetitions: 0,
  };
}
