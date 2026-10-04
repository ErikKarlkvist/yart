import { type JSX } from 'react';
import './flow-spinner.css';

/**
 * Laddningsikonen: märket med de två systemen, där datan går fram och tillbaka
 * längs den streckade linjen mellan dem. Färgerna kommer från paletten.
 */
export function FlowSpinner({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      className="flow-spinner"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect className="flow-spinner__from" x="12.5" y="12.5" width="41" height="35" />
      <rect className="flow-spinner__from-head" x="10" y="10" width="46" height="13" />
      <polyline className="flow-spinner__line" points="33,50 33,96 74,96" />
      <rect className="flow-spinner__to" x="76.5" y="78.5" width="41" height="35" />
      <rect className="flow-spinner__to-head" x="74" y="76" width="46" height="13" />
      <circle className="flow-spinner__packet" r="9">
        <animateMotion
          dur="1.6s"
          repeatCount="indefinite"
          path="M 33 50 L 33 96 L 74 96"
          keyPoints="0;1;0"
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
      </circle>
    </svg>
  );
}
