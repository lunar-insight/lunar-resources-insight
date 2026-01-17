import React, { useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from 'react-aria-components';
import styles from './FeatureNameEditor.module.scss';

interface FeatureNameEditorProps {
  initialName: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

export const FeatureNameEditor: React.FC<FeatureNameEditorProps> = ({
  initialName,
  onSave,
  onCancel,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input and select all text when editor mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Manually handle space key at document level to work around GridListItem interference
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleNativeKeyDown = (e: globalThis.KeyboardEvent) => {
      // Only handle if the event target is our specific input
      if (e.target === input && e.key === ' ') {
        // Prevent default and manually insert space
        e.preventDefault();
        e.stopImmediatePropagation();

        // Manually insert space at cursor position
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const currentValue = input.value;

        input.value = currentValue.substring(0, start) + ' ' + currentValue.substring(end);

        // Restore cursor position after the inserted space
        const newPosition = start + 1;
        input.setSelectionRange(newPosition, newPosition);

        // Trigger input event for React to detect the change
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    // Add listener at DOCUMENT level in CAPTURE phase to run before React's delegated listeners
    document.addEventListener('keydown', handleNativeKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleNativeKeyDown, true);
    };
  }, []);

  const handleSave = () => {
    const newName = inputRef.current?.value || '';
    // Normalize: trim and collapse multiple spaces into single space
    const normalizedName = newName.trim().replace(/\s+/g, ' ');

    if (normalizedName && normalizedName !== initialName) {
      onSave(normalizedName);
    } else {
      onCancel(); // Cancel if unchanged or empty
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div ref={containerRef} className={styles.editorContainer}>
      <input
        ref={inputRef}
        className={styles.input}
        defaultValue={initialName}
        aria-label="Feature name"
        onKeyDown={handleKeyDown}
        maxLength={100}
        type="text"
      />

      <div className={styles.editorActions}>
        <Button
          onPress={handleSave}
          aria-label="Save"
          className={styles.saveButton}
        >
          <span className="material-symbols-outlined">
            check
          </span>
        </Button>

        <Button
          onPress={onCancel}
          aria-label="Cancel"
          className={styles.cancelButton}
        >
          <span className="material-symbols-outlined">
            close
          </span>
        </Button>
      </div>
    </div>
  );
};
