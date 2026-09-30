import { describe, expect, it } from 'vitest';
import {
  closePanel,
  type DockLayoutState,
  isClosed,
  movePanel,
  normalizeLayout,
  resizeDock,
  revealPanel,
  sideOf,
} from './dock';

const LAYOUT: DockLayoutState = {
  left: { panels: ['explorer'], closed: [], active: 'explorer', open: true, size: 300 },
  right: { panels: ['agent', 'connect'], closed: [], active: 'agent', open: false, size: 460 },
  bottom: {
    panels: ['code', 'summary', 'log'],
    closed: [],
    active: 'summary',
    open: true,
    size: 220,
  },
};

describe('movePanel', () => {
  it('flyttar till en annan docka, öppnar den och väljer panelen', () => {
    const next = movePanel(LAYOUT, 'summary', 'right', 1);
    expect(next.right).toEqual({
      panels: ['agent', 'summary', 'connect'],
      closed: [],
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
    expect(next.left).toEqual({ panels: [], closed: [], active: null, open: false, size: 300 });
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

describe('closePanel', () => {
  it('tar bort fliken men låter panelen höra till dockan', () => {
    const next = closePanel(LAYOUT, 'summary');
    expect(next.bottom.panels).toEqual(['code', 'log']);
    expect(next.bottom.closed).toEqual(['summary']);
    expect(next.bottom.active).toBe('code');
    expect(sideOf(next, 'summary')).toBe('bottom');
    expect(isClosed(next, 'summary')).toBe(true);
  });

  it('fäller ihop dockan när sista fliken stängs', () => {
    expect(closePanel(LAYOUT, 'explorer').left.open).toBe(false);
  });

  it('öppnas igen sist i sin docka när den visas', () => {
    const next = revealPanel(closePanel(LAYOUT, 'code'), 'code');
    expect(next.bottom.panels).toEqual(['summary', 'log', 'code']);
    expect(next.bottom.closed).toEqual([]);
    expect(next.bottom.active).toBe('code');
  });

  it('öppnas i en annan docka när den flyttas', () => {
    const next = movePanel(closePanel(LAYOUT, 'log'), 'log', 'left', 0);
    expect(next.left.panels).toEqual(['log', 'explorer']);
    expect(next.bottom.closed).toEqual([]);
    expect(isClosed(next, 'log')).toBe(false);
  });

  it('överlever en sparad layout', () => {
    const stored = JSON.parse(JSON.stringify(closePanel(LAYOUT, 'agent'))) as unknown;
    expect(normalizeLayout(stored, LAYOUT).right.closed).toEqual(['agent']);
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
      closed: [],
      active: 'agent',
      open: true,
      size: 250,
    });
    expect(next.right).toEqual({
      panels: ['connect'],
      closed: [],
      active: 'connect',
      open: false,
      size: 460,
    });
    expect(next.bottom.panels).toEqual(['code', 'summary', 'log']);
  });
});
