// types/pqina__flip.d.ts
declare module "@pqina/flip" {
    export interface TickInstance {
      value: any;
      destroy(): void;
    }
    export namespace DOM {
      function create(el: HTMLElement): TickInstance;
    }
    export namespace helper {
      // devuelve un timer con .stop()
      function interval(cb: () => void, ms?: number): { stop(): void };
    }
    const Tick: { DOM: typeof DOM; helper: typeof helper };
    export default Tick;
  }
  