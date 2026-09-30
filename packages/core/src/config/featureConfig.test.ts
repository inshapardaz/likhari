import { describe, expect, it } from 'vitest';
import { resolveFeatureConfig } from './featureConfig';

describe('resolveFeatureConfig', () => {
  it('keeps a usable image size limit for presets that enable images without naming one', () => {
    for (const preset of ['standard', 'poetry', 'full'] as const) {
      const config = resolveFeatureConfig(undefined, preset);
      expect(config.images.embedded).toBe(true);
      expect(config.images.maxSizeMB).toBe(5);
    }
  });

  it('lets a caller override the image size limit', () => {
    expect(resolveFeatureConfig({ images: { maxSizeMB: 2 } }, 'standard').images.maxSizeMB).toBe(2);
  });

  it('defaults to the full preset with every feature on', () => {
    const config = resolveFeatureConfig();
    expect(config.formatting.bold).toBe(true);
    expect(config.poetry.enabled).toBe(true);
  });

  it('minimal preset turns off formatting and lists', () => {
    const config = resolveFeatureConfig(undefined, 'minimal');
    expect(config.formatting.bold).toBe(false);
    expect(config.history).toBe(true);
  });

  it('layers explicit overrides on top of a preset without touching sibling fields', () => {
    const config = resolveFeatureConfig({ formatting: { bold: false } }, 'standard');
    expect(config.formatting.bold).toBe(false);
    expect(config.formatting.italic).toBe(true);
    expect(config.lists.bullet).toBe(true);
  });
});
