import { describe, expect, it } from 'vitest';
import {
  type DockLayoutState,
  movePanel,
  normalizeLayout,
  resizeDock,
  revealPanel,
  sideOf,
} from './dock';

const LAYOUT: DockLayoutState = {
  left: { panels: ['explorer'], active: 'explorer', open: true, size: 300 },
  right: { panels: ['agent', 'connect'], active: 'agent', open: false, size: 460 },
  bottom: { panels: ['code', 'summary', 'log'], active: 'summary', open: true, size: 220 },
};

describe('movePanel', () => {
  it('flyttar till en annan docka, öppnar den och väljer panelen', () => {
    const next = movePanel(LAYOUT, 'summary', 'right', 1);
    expect(next.right).toEqual({
      panels: ['agent', 'summary', 'connect'],
      active: 'summary',
      open: true,
      size: 460,
    });
    expect(next.bottom.panels).toEqual(['code', 'log']);
    expect(next.bottom.active).toBe('code');
  });

  it('lägger panelen sist utan index', () => {
    expect(movePanel(LAYOUT, 'code', 'left').left.panels).toEqual(['explorer', 'code']);
  });

  it('fäller ihop dockan som blir tom', () => {
    const next = movePanel(LAYOUT, 'explorer', 'bottom', 0);
    expect(next.left).toEqual({ panels: [], active: null, open: false, size: 300 });
    expect(next.bottom.panels).toEqual(['explorer', 'code', 'summary', 'log']);
  });

  it('flyttar inom samma docka med index räknat före flytten', () => {
    expect(movePanel(LAYOUT, 'code', 'bottom', 3).bottom.panels).toEqual([
      'summary',
      'log',
      'code',
    ]);
    expect(movePanel(LAYOUT, 'log', 'bottom', 0).bottom.panels).toEqual(['log', 'code', 'summary']);
  });

  it('lämnar layouten orörd för okända paneler', () => {
    expect(movePanel(LAYOUT, 'nope', 'left')).toBe(LAYOUT);
  });
});

describe('revealPanel', () => {
  it('öppnar dockan och väljer panelen', () => {
    const next = revealPanel(LAYOUT, 'connect');
    expect(next.right.open).toBe(true);
    expect(next.right.active).toBe('connect');
    expect(sideOf(next, 'connect')).toBe('right');
  });
});

describe('resizeDock', () => {
  it('håller storleken inom gränserna', () => {
    expect(resizeDock(LAYOUT, 'left', 10).left.size).toBe(200);
    expect(resizeDock(LAYOUT, 'bottom', 5000).bottom.size).toBe(700);
  });
});

describe('normalizeLayout', () => {
  it('faller tillbaka på standard för trasiga värden', () => {
    expect(normalizeLayout('trasig', LAYOUT)).toEqual(LAYOUT);
  });

  it('tar bort okända och dubblerade paneler och lägger till saknade', () => {
    const next = normalizeLayout(
      {
        left: { panels: ['agent', 'gammal', 'agent'], active: 'gammal', open: true, size: 250 },
        right: { panels: [], active: null, open: false, size: 460 },
        bottom: { panels: ['code', 'agent'], active: 'code', open: false, size: 220 },
      },
      LAYOUT,
    );
    expect(next.left).toEqual({
      panels: ['agent', 'explorer'],
      active: 'agent',
      open: true,
      size: 250,
    });
    expect(next.right).toEqual({ panels: ['connect'], active: 'connect', open: false, size: 460 });
    expect(next.bottom.panels).toEqual(['code', 'summary', 'log']);
  });
});
