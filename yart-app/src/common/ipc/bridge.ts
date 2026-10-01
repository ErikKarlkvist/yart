/** Formen på det preload exponerar som `window.api`. */
export interface IpcBridge {
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
  /** Prenumerera på en händelse från main. Returnerar en avregistreringsfunktion. */
  on: (event: string, listener: (payload: unknown) => void) => () => void;
}

declare global {
  interface Window {
    api: IpcBridge;
  }
}
