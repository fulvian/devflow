import { watch } from 'fs';
import { PersistentDebouncer } from './persistent-debouncer.js';

export interface ContextEvent {
  type: 'create' | 'change' | 'delete';
  file: string;
  taskId?: string;
  sessionId?: string;
}

export function watchContextDir(dir: string, onEvent: (evt: ContextEvent) => void) {
  const debouncer = new PersistentDebouncer<ContextEvent>({ delayMs: 200 });
  // Resume any pending events on startup
  debouncer.resume((_key, data) => onEvent(data));
  const w = watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const key = `${eventType}:${filename}`;
    const evt: ContextEvent = { type: eventType === 'rename' ? 'change' : 'change', file: filename };
    debouncer.run(key, evt, (payload) => onEvent(payload));
  });
  return () => w.close();
}
