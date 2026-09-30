import { createContext, useContext } from 'react';
import { type ReviewFinding } from '@/common/model/review';
import { type StepStatus, type StepView } from '../../model/playback';

/**
 * Tillstånd som ändras ofta, hover och uppspelningssteg, delas via context i
 * stället för via noddata. Då förblir React Flows nodobjekt stabila, annars
 * gömmer React Flow noderna tills de mätts om och hela grafen blinkar.
 */
export interface GraphState {
  hoveredNodeId: string | null;
  view: StepView;
  /** Döljer en nod med dess kanter, från krysset på noden */
  hide: (nodeId: string) => void;
  /** Öppnar frågerutan för en nod, från pratbubblan på noden */
  askNode: (nodeId: string) => void;
  /** Noden som just nu är utpekad i frågerutan */
  askingNodeId: string | null;
  /** Zoomar in i ett system, från förstoringsglaset på systemnoden */
  zoomInto: (systemId: string) => void;
  /** Tillbaka till systemvyn, från förstoringsglaset på en systemram */
  zoomOut: () => void;
  /** Fyndet som är valt i panelen Review, elementet det gäller ringas in */
  focusedFindingId: string | null;
  /** Klick på en fyndflagga öppnar fyndet i panelen Review */
  focusFinding: (findingId: string) => void;
}

const EMPTY: GraphState = {
  hoveredNodeId: null,
  view: { nodes: new Map(), edges: new Map(), activeEdgeId: null },
  hide: () => undefined,
  askNode: () => undefined,
  askingNodeId: null,
  zoomInto: () => undefined,
  zoomOut: () => undefined,
  focusedFindingId: null,
  focusFinding: () => undefined,
};

export const GraphStateContext = createContext<GraphState>(EMPTY);

export function useNodeState(
  id: string,
  findings: readonly ReviewFinding[] = [],
): {
  status: StepStatus;
  hovered: boolean;
  asking: boolean;
  /** Ett av nodens fynd är valt i panelen Review */
  focused: boolean;
  hide: () => void;
  ask: () => void;
  zoom: () => void;
} {
  const { hoveredNodeId, view, hide, askNode, askingNodeId, zoomInto, focusedFindingId } =
    useContext(GraphStateContext);
  return {
    status: view.nodes.get(id) ?? 'pending',
    hovered: hoveredNodeId === id,
    asking: askingNodeId === id,
    focused: focusedFindingId !== null && findings.some((f) => f.id === focusedFindingId),
    hide: () => {
      hide(id);
    },
    ask: () => {
      askNode(id);
    },
    zoom: () => {
      zoomInto(id);
    },
  };
}

export function useZoomOut(): () => void {
  return useContext(GraphStateContext).zoomOut;
}

export function useFindingState(): {
  focusedFindingId: string | null;
  focusFinding: (findingId: string) => void;
} {
  const { focusedFindingId, focusFinding } = useContext(GraphStateContext);
  return { focusedFindingId, focusFinding };
}
