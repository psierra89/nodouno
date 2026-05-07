import type { DrawingState } from './types';

export class History {
  private stack: DrawingState[] = [];
  private cursor = -1;
  private readonly max: number;

  constructor(max = 50) {
    this.max = max;
  }

  reset(state: DrawingState): void {
    this.stack = [structuredClone(state)];
    this.cursor = 0;
  }

  push(state: DrawingState): void {
    if (this.cursor < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.cursor + 1);
    }
    this.stack.push(structuredClone(state));
    if (this.stack.length > this.max) {
      this.stack.shift();
    } else {
      this.cursor++;
    }
  }

  canUndo(): boolean {
    return this.cursor > 0;
  }

  canRedo(): boolean {
    return this.cursor < this.stack.length - 1;
  }

  undo(): DrawingState | null {
    if (!this.canUndo()) return null;
    this.cursor--;
    return structuredClone(this.stack[this.cursor]);
  }

  redo(): DrawingState | null {
    if (!this.canRedo()) return null;
    this.cursor++;
    return structuredClone(this.stack[this.cursor]);
  }

  size(): number {
    return this.stack.length;
  }
}
