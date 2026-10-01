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
  left: { panels: ['analyses'], closed: [], active: 'analyses', open: true, size: 300 },
  right: { panels: ['agent', 'connect'], closed: [], active: 'agent', open: false, size: 460 },
  bottom: {
    panels: ['code', 'flowReview', 'log'],
    closed: [],
    active: 'flowReview',
    open: true,
    size: 220,
  },
};

describe('movePanel', () => {
  it('flyttar till en annan docka, öppnar den och väljer panelen', () => {
    const next = movePanel(LAYOUT, 'flowReview', 'right', 1);
    expect(next.right).toEqual({
      panels: ['agent', 'flowReview', 'connect'],
      closed: [],
      active: 'flowReview',
      open: true,
      size: 460,
    });
    expect(next.bottom.panels).toEqual(['code', 'log']);
    expect(next.bottom.active).toBe('code');
  });

  it('lägger panelen sist utan index', () => {
    expect(movePanel(LAYOUT, 'code', 'left').left.panels).toEqual(['analyses', 'code']);
  });

  it('fäller ihop dockan som blir tom', () => {
    const next = movePanel(LAYOUT, 'analyses', 'bottom', 0);
    expect(next.left).toEqual({ panels: [], closed: [], active: null, open: false, size: 300 });
    expect(next.bottom.panels).toEqual(['analyses', 'code', 'flowReview', 'log']);
  });

  it('flyttar inom samma docka med index räknat före flytten', () => {
    expect(movePanel(LAYOUT, 'code', 'bottom', 3).bottom.panels).toEqual([
      'flowReview',
      'log',
      'code',
    ]);
    expect(movePanel(LAYOUT, 'log', 'bottom', 0).bottom.panels).toEqual([
      'log',
      'code',
      'flowReview',
    ]);
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
    const next = closePanel(LAYOUT, 'flowReview');
    expect(next.bottom.panels).toEqual(['code', 'log']);
    expect(next.bottom.closed).toEqual(['flowReview']);
    expect(next.bottom.active).toBe('code');
    expect(sideOf(next, 'flowReview')).toBe('bottom');
    expect(isClosed(next, 'flowReview')).toBe(true);
  });

  it('fäller ihop dockan när sista fliken stängs', () => {
    expect(closePanel(LAYOUT, 'analyses').left.open).toBe(false);
  });

  it('öppnas igen sist i sin docka när den visas', () => {
    const next = revealPanel(closePanel(LAYOUT, 'code'), 'code');
    expect(next.bottom.panels).toEqual(['flowReview', 'log', 'code']);
    expect(next.bottom.closed).toEqual([]);
    expect(next.bottom.active).toBe('code');
  });

  it('öppnas i en annan docka när den flyttas', () => {
    const next = movePanel(closePanel(LAYOUT, 'log'), 'log', 'left', 0);
    expect(next.left.panels).toEqual(['log', 'analyses']);
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
      panels: ['agent', 'analyses'],
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
    expect(next.bottom.panels).toEqual(['code', 'flowReview', 'log']);
  });
});
