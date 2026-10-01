import { describe, expect, it } from 'vitest';
import en from './en-gb.json';
import { APP_NAME } from '../brand';
import { t } from './index';

describe('t', () => {
  it('interpolerar parametrar', () => {
    expect(t('review.findings', { count: 3 })).toBe('3 findings');
  });

  it('lämnar okända platshållare orörda', () => {
    expect(t('error.demoMissing', {})).toBe('The demo app was not found at {path}');
  });

  it('uses the shared app name in visible copy', () => {
    expect(t('onboarding.title')).toContain(APP_NAME);
    expect(t('onboarding.path.codex')).toBe('Codex');
    expect(t('onboarding.done')).toBe('Start');
  });

  it('alla texter är ifyllda', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), key).not.toBe('');
    }
  });
});
