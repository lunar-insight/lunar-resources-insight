import React, { useRef, useEffect, KeyboardEvent } from 'react';
import { TextField, Input, Button } from 'react-aria-components';
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

  // Auto-focus input and select all text when editor mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    const newName = inputRef.current?.value || '';
    if (newName.trim() && newName.trim() !== initialName) {
      onSave(newName);
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
    } else if (e.key === ' ') {
      // Prevent space from being captured by parent GridListItem
      e.stopPropagation();
    }
  };

  return (
    <div className={styles.editorContainer}>
      <TextField
        className={styles.textField}
        defaultValue={initialName}
        aria-label="Feature name"
      >
        <Input
          ref={inputRef}
          className={styles.input}
          onKeyDown={handleKeyDown}
          maxLength={100}
        />
      </TextField>

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
