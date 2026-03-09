export {};

declare global {
  interface Window {
    addCleanup?(fn: (...args: unknown[]) => void): void;
  }

  interface DocumentEventMap {
    nav: Event;
  }
}
