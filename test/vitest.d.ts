import type { MatchImageSnapshotOptions } from '@types/jest-image-snapshot';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toMatchImageSnapshot(options?: MatchImageSnapshotOptions): T;
  }
}
