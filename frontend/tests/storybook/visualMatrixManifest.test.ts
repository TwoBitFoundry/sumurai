import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VISUAL_STORYBOOK_MATRIX } from './visualMatrix';

type StorybookIndex = {
  entries: Record<
    string,
    {
      type?: string;
      subtype?: string;
    }
  >;
};

describe('storybook visual matrix', () => {
  it('uses unique story ids', () => {
    const ids = VISUAL_STORYBOOK_MATRIX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pins theme metadata for documentation', () => {
    for (const entry of VISUAL_STORYBOOK_MATRIX) {
      expect(entry.theme === 'light' || entry.theme === 'dark').toBe(true);
    }
  });

  it('resolves every matrix id in storybook-static when the build output exists', () => {
    const indexPath = join(process.cwd(), 'storybook-static/index.json');
    if (!existsSync(indexPath)) {
      return;
    }
    const raw = readFileSync(indexPath, 'utf8');
    const index = JSON.parse(raw) as StorybookIndex;
    for (const { id } of VISUAL_STORYBOOK_MATRIX) {
      const entry = index.entries[id];
      if (!entry) {
        throw new Error(`missing story id ${id}`);
      }
      expect(entry.type).toBe('story');
      expect(entry.subtype).toBe('story');
    }
  });
});
