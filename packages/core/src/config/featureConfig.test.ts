import { describe, expect, it } from 'vitest';
import { resolveFeatureConfig } from './featureConfig';

describe('resolveFeatureConfig', () => {
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
