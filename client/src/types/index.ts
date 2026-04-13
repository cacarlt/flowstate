export interface Project {
  id: number;
  name: string;
  due_date: string | null;
  collapsed: number;
  sort_order: number;
  priority: number;
  created_at: string;
  updated_at: string;
  total_estimate_hours: number;
  todo_count: number;
  done_count: number;
}

export interface Todo {
  id: number;
  project_id: number;
  title: string;
  notes: string | null;
  estimate_hours: number | null;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  sort_order: number;
  created_at: string;
  updated_at: string;
  session_count: number;
  ado_link_count: number;
}

export interface AdoItem {
  id: number;
  ado_work_item_id: number;
  type: 'Product Backlog Item' | 'Feature';
  url: string;
  title: string;
  sprint_name: string | null;
  state: string | null;
  assigned_to: string | null;
  last_synced_at: string;
  linked_todos: { todo_id: number; todo_title: string; project_name: string }[];
  linked_projects: { project_id: number; project_name: string }[];
}

export interface CopilotSession {
  id: number;
  project_id: number | null;
  todo_id: number | null;
  session_url: string | null;
  session_id: string | null;
  task_prompt: string | null;
  notes: string;
  status: 'logged' | 'launched' | 'in_progress' | 'completed' | 'abandoned';
  repo: string | null;
  branch: string | null;
  created_at: string;
  project_name: string | null;
  todo_title: string | null;
}

export interface GithubItem {
  id: number;
  github_id: number;
  type: 'issue' | 'pull_request';
  url: string;
  title: string;
  repo: string;
  state: string | null;
  labels: string | null;
  created_at_gh: string | null;
  updated_at_gh: string | null;
  last_synced_at: string;
}

export interface AppConfig {
  profileName: string;
  profileColor: string;
  integrations: string[];
}

export interface PatStatus {
  status: 'active' | 'expiring_soon' | 'expired' | 'not_configured' | 'configured' | 'unknown';
  name: string | null;
  scopes: string | null;
  organization: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  manageUrl: string | null;
}

export type Tab = 'myday' | 'tasks' | 'ado' | 'github' | 'sessions';
