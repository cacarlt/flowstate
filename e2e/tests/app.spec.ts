import { test, expect } from '@playwright/test';

test.describe('Full app E2E', () => {

  test('loads the app and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('FlowState');
  });

  test('create a project and add a task', async ({ page }) => {
    await page.goto('/');

    // Create project
    await page.click('text=+ New Project');
    await page.fill('input[placeholder="Project name"]', 'E2E Test Project');
    await page.click('button:has-text("Create")');

    // Verify project appears
    await expect(page.locator('text=E2E Test Project')).toBeVisible();

    // Expand project
    await page.click('text=E2E Test Project');
    await expect(page.locator('text=+ Add task')).toBeVisible();

    // Add a task
    await page.click('text=+ Add task');
    await page.fill('input[placeholder="Task title"]', 'Write E2E tests');
    await page.fill('input[placeholder="Est. hours"]', '3');
    await page.click('button:has-text("Add")');

    // Verify task appears
    await expect(page.locator('text=Write E2E tests')).toBeVisible();
  });

  test('cycle task status through todo → in_progress → done', async ({ page }) => {
    await page.goto('/');

    // Create project + task
    await page.click('text=+ New Project');
    await page.fill('input[placeholder="Project name"]', 'Status Test');
    await page.click('button:has-text("Create")');
    await page.click('text=Status Test');
    await page.click('text=+ Add task');
    await page.fill('input[placeholder="Task title"]', 'Status task');
    await page.click('button:has-text("Add")');

    // Initial status: todo (⬜)
    const statusBtn = page.locator('button:has-text("⬜")').first();
    await expect(statusBtn).toBeVisible();

    // Click → in_progress (🔵)
    await statusBtn.click();
    await expect(page.locator('button:has-text("🔵")').first()).toBeVisible();

    // Click → done
    await page.locator('button:has-text("🔵")').first().click();
    await expect(page.locator('text=Status task')).toBeVisible();
  });

  test('edit a task inline', async ({ page }) => {
    await page.goto('/');

    // Create project + task
    await page.click('text=+ New Project');
    await page.fill('input[placeholder="Project name"]', 'Edit Test');
    await page.click('button:has-text("Create")');
    await page.click('text=Edit Test');
    await page.click('text=+ Add task');
    await page.fill('input[placeholder="Task title"]', 'Original title');
    await page.click('button:has-text("Add")');

    // Click edit button (revealed on hover)
    const todoRow = page.locator('text=Original title').locator('..');
    await todoRow.hover();
    await page.locator('button:has-text("✏️")').first().click();

    // Edit the title in the input that now appears
    const titleInput = page.locator('input').first();
    await titleInput.clear();
    await titleInput.fill('Updated title');
    await page.click('text=Save');

    await expect(page.locator('text=Updated title')).toBeVisible();
  });

  test('delete a project', async ({ page }) => {
    await page.goto('/');

    // Create project
    await page.click('text=+ New Project');
    await page.fill('input[placeholder="Project name"]', 'Delete Me');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Delete Me')).toBeVisible();

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Find the delete button near "Delete Me" text
    const projectCard = page.locator('div.bg-white').filter({ hasText: 'Delete Me' }).first();
    await projectCard.getByTitle('Delete project').click();

    await expect(page.locator('text=Delete Me')).not.toBeVisible();
  });

  test('navigate between tabs', async ({ page }) => {
    await page.goto('/');

    // Go to ADO tab
    await page.click('text=ADO Items');
    await expect(page.locator('button:has-text("Sync from ADO")')).toBeVisible();

    // Go to Sessions tab
    await page.click('text=Copilot Sessions');
    await expect(page.locator('text=+ Log Session')).toBeVisible();

    // Back to Tasks
    await page.click('text=My Tasks');
    await expect(page.locator('text=+ New Project')).toBeVisible();
  });

  test('create a copilot session', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Copilot Sessions');

    await page.click('text=+ Log Session');
    await page.fill('textarea', 'Working on E2E tests for the todo app');
    await page.fill('input[placeholder="Repo (optional)"]', 'best_todo_work');
    await page.fill('input[placeholder="Branch (optional)"]', 'main');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Working on E2E tests for the todo app')).toBeVisible();
  });

  test('filter projects by active/done', async ({ page }) => {
    await page.goto('/');

    // Create a project with a done task
    await page.click('text=+ New Project');
    await page.fill('input[placeholder="Project name"]', 'Filter Test Proj');
    await page.click('button:has-text("Create")');
    await page.click('text=Filter Test Proj');
    await page.click('text=+ Add task');
    await page.fill('input[placeholder="Task title"]', 'Completed task');
    await page.click('button:has-text("Add")');

    // Mark task as done (click status twice: todo→in_progress→done)
    await page.locator('button:has-text("⬜")').first().click();
    await page.locator('button:has-text("🔵")').first().click();

    // Filter to "done" — project should still be visible
    await page.click('button:has-text("done")');
    await expect(page.locator('text=Filter Test Proj')).toBeVisible();

    // Filter to "active" — project should be hidden (all tasks done)
    await page.click('button:has-text("active")');
    await expect(page.locator('text=Filter Test Proj')).not.toBeVisible();
  });
});
