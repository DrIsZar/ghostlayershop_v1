import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  handler: (event: KeyboardEvent) => void;
  description: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  ignoreWhen?: (event: KeyboardEvent) => boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  ignoreWhen
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input, textarea, or contenteditable
      if (ignoreWhen?.(event)) return;

      const target = event.target as HTMLElement;
      const isInputElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') !== null;

      // Always allow Escape and some special keys
      const alwaysAllowedKeys = ['Escape', '?'];
      if (!alwaysAllowedKeys.includes(event.key) && isInputElement) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        const keyMatches = 
          shortcut.key.toLowerCase() === event.key.toLowerCase() ||
          shortcut.key === event.key;

        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shift === undefined ? true : shortcut.shift === event.shiftKey;
        const altMatches = shortcut.alt === undefined ? true : shortcut.alt === event.altKey;
        const metaMatches = shortcut.meta === undefined ? true : shortcut.meta === event.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          if (shortcut.stopPropagation) {
            event.stopPropagation();
          }
          shortcut.handler(event);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ignoreWhen]);
}

// Helper to check if we should ignore the keyboard event
export function shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null ||
    target.closest('[role="textbox"]') !== null
  );
}

