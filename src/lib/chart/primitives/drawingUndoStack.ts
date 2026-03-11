// ═══════════════════════════════════════════════════════════════
// Stockclaw — Drawing Undo/Redo Stack
// ═══════════════════════════════════════════════════════════════

import type { DrawingData } from './drawingManagerTypes';

export type DrawingActionType = 'create' | 'delete' | 'move' | 'resize' | 'style' | 'clear';

export interface DrawingAction {
  type: DrawingActionType;
  /** For create/delete/move/resize/style: snapshot of affected drawing(s) BEFORE the action */
  before: DrawingData[];
  /** Snapshot of affected drawing(s) AFTER the action */
  after: DrawingData[];
}

const MAX_STACK_SIZE = 50;

export class DrawingUndoStack {
  private _undoStack: DrawingAction[] = [];
  private _redoStack: DrawingAction[] = [];

  get canUndo(): boolean { return this._undoStack.length > 0; }
  get canRedo(): boolean { return this._redoStack.length > 0; }

  /** Record an action (clears redo stack) */
  push(action: DrawingAction): void {
    this._undoStack.push(action);
    if (this._undoStack.length > MAX_STACK_SIZE) {
      this._undoStack.shift();
    }
    // Any new action invalidates the redo stack
    this._redoStack.length = 0;
  }

  /** Pop the last action for undo. Returns null if empty. */
  popUndo(): DrawingAction | null {
    const action = this._undoStack.pop() ?? null;
    if (action) {
      this._redoStack.push(action);
    }
    return action;
  }

  /** Pop from redo stack. Returns null if empty. */
  popRedo(): DrawingAction | null {
    const action = this._redoStack.pop() ?? null;
    if (action) {
      this._undoStack.push(action);
    }
    return action;
  }

  /** Clear both stacks */
  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
}
