export interface Project {
  name: string; abstract: string; objectives: string[]; features: string[]; technologies: string[]; contributions: string[];
  aiTools: { tool: string; use: string; limits: string }[];
  team: { id: string; name: string; role: string; bio: string; hasPhoto: boolean }[];
}
export async function getProject(): Promise<Project | null> {
  try {
    const r = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/api/project`, { next: { revalidate: 30 } });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
