import { describe, it, expect } from 'vitest';
import { all, get, run } from '../../db';

describe('DB helpers', () => {
  it('run() inserts and returns lastId', () => {
    const { lastId } = run('INSERT INTO projects (name) VALUES (?)', ['Test']);
    expect(lastId).toBeGreaterThan(0);
  });

  it('get() returns a single row', () => {
    run('INSERT INTO projects (name) VALUES (?)', ['Proj1']);
    const row = get('SELECT * FROM projects WHERE name = ?', ['Proj1']);
    expect(row).toBeDefined();
    expect(row.name).toBe('Proj1');
  });

  it('get() returns undefined for no match', () => {
    const row = get('SELECT * FROM projects WHERE name = ?', ['nonexistent']);
    expect(row).toBeUndefined();
  });

  it('all() returns multiple rows', () => {
    run('INSERT INTO projects (name) VALUES (?)', ['A']);
    run('INSERT INTO projects (name) VALUES (?)', ['B']);
    const rows = all('SELECT * FROM projects ORDER BY name');
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('A');
    expect(rows[1].name).toBe('B');
  });

  it('all() returns empty array for no matches', () => {
    const rows = all('SELECT * FROM projects');
    expect(rows).toEqual([]);
  });

  it('run() reports changes count', () => {
    run('INSERT INTO projects (name) VALUES (?)', ['ToDelete']);
    const { changes } = run('DELETE FROM projects WHERE name = ?', ['ToDelete']);
    expect(changes).toBe(1);
  });

  it('foreign keys are enforced', () => {
    expect(() => {
      run('INSERT INTO todos (project_id, title) VALUES (?, ?)', [9999, 'orphan']);
    }).toThrow();
  });

  it('cascade delete removes child todos', () => {
    const { lastId: projId } = run('INSERT INTO projects (name) VALUES (?)', ['Proj']);
    run('INSERT INTO todos (project_id, title) VALUES (?, ?)', [projId, 'Task1']);
    run('INSERT INTO todos (project_id, title) VALUES (?, ?)', [projId, 'Task2']);

    expect(all('SELECT * FROM todos')).toHaveLength(2);
    run('DELETE FROM projects WHERE id = ?', [projId]);
    expect(all('SELECT * FROM todos')).toHaveLength(0);
  });

  it('schema creates all expected tables', () => {
    const tables = all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const names = tables.map((t: any) => t.name);
    expect(names).toContain('projects');
    expect(names).toContain('todos');
    expect(names).toContain('ado_items');
    expect(names).toContain('todo_ado_links');
    expect(names).toContain('copilot_sessions');
    expect(names).toContain('todo_copilot_sessions');
  });
});
