import { vi } from "vitest";

type EventSourceListener = (event: MessageEvent<string>) => void;

class EventSourceStub implements EventSource {
  static readonly CONNECTING = 0 as const;
  static readonly OPEN = 1 as const;
  static readonly CLOSED = 2 as const;

  readonly CONNECTING = EventSourceStub.CONNECTING;
  readonly OPEN = EventSourceStub.OPEN;
  readonly CLOSED = EventSourceStub.CLOSED;

  readyState: 0 | 1 | 2 = EventSourceStub.OPEN;
  url: string;
  withCredentials: boolean = false;

  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent<string>) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;

  private listeners = new Map<string, Set<EventSourceListener>>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: EventSourceListener): void {
    const set = this.listeners.get(type) ?? new Set<EventSourceListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventSourceListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  close(): void {
    this.readyState = EventSourceStub.CLOSED;
    this.listeners.clear();
  }
}

if (typeof globalThis.EventSource === "undefined") {
  vi.stubGlobal("EventSource", EventSourceStub);
}