import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface GenerateTasksRequest {
  project_name: string;
  project_brief: string;
  scope_items: string[];
  selected_templates: string[];
  reference_tasks?: string;
  custom_instructions?: string;
}

interface JiraTask {
  summary: string;
  description: string;
  task_type: 'Epic' | 'Story' | 'Task' | 'Subtask';
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels: string[];
  story_points?: number;
  acceptance_criteria?: string[];
  parent_ref?: string;
  order: number;
}

const SYSTEM_PROMPT = `You are an expert project manager for a digital agency. Your job is to create comprehensive, Jira-ready task breakdowns for web projects.

Generate tasks that are:
1. Specific and actionable - no vague descriptions
2. Properly sized - stories should be 1-5 story points
3. Well-organized - logical epic/story/task hierarchy
4. Complete - cover all aspects of the project scope
5. Practical - based on real agency workflows

Task Types:
- Epic: Large features/phases (e.g., "UX Research & Wireframes", "Frontend Development")
- Story: User-facing functionality (e.g., "As a user, I can filter products by category")
- Task: Technical work items (e.g., "Set up CI/CD pipeline", "Configure CMS content types")
- Subtask: Smaller pieces of stories/tasks (e.g., "Create mobile responsive styles")

Standard Labels to use:
- Phase: discovery, design, development, content, qa, launch
- Profile: ux, ui, dev, pm, content, analytics
- Priority: must-have, should-have, nice-to-have

Story Points Scale (Fibonacci):
- 1: Trivial (< 2 hours)
- 2: Small (2-4 hours)
- 3: Medium (4-8 hours)
- 5: Large (1-2 days)
- 8: Very Large (3-5 days)
- 13: Epic-sized (should be broken down)

For each task include clear acceptance criteria where applicable.

Respond ONLY with valid JSON in this exact format:
{
  "tasks": [
    {
      "summary": "UX Research & Discovery",
      "description": "Complete UX research phase including stakeholder interviews, competitor analysis, and user research.",
      "task_type": "Epic",
      "priority": "Highest",
      "labels": ["discovery", "ux", "must-have"],
      "order": 1
    },
    {
      "summary": "Conduct stakeholder interviews",
      "description": "Schedule and conduct interviews with key stakeholders to understand business goals, constraints, and success metrics.",
      "task_type": "Task",
      "priority": "High",
      "labels": ["discovery", "ux", "must-have"],
      "story_points": 3,
      "acceptance_criteria": [
        "Minimum 3 stakeholder interviews completed",
        "Interview notes documented",
        "Key insights summarized"
      ],
      "parent_ref": "UX Research & Discovery",
      "order": 2
    }
  ],
  "summary": {
    "total_tasks": 45,
    "by_type": { "Epic": 5, "Story": 20, "Task": 15, "Subtask": 5 },
    "by_priority": { "Highest": 5, "High": 20, "Medium": 15, "Low": 5 },
    "estimated_story_points": 120
  },
  "recommendations": [
    "Consider adding a dedicated QA sprint before launch",
    "Content migration should start in parallel with development"
  ]
}

IMPORTANT:
- Generate realistic tasks based on the project scope
- Ensure proper parent-child relationships using parent_ref
- Order tasks logically (dependencies considered)
- Include all standard project phases unless specifically excluded
- Be thorough - typical web project has 40-80 tasks`;

const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'OpenAI API key not configured' }),
    };
  }

  try {
    const request = JSON.parse(event.body || '{}') as GenerateTasksRequest;

    if (!request.project_name || !request.project_brief) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Project name and brief are required' }),
      };
    }

    const userPrompt = `Generate a complete Jira task breakdown for this project:

PROJECT NAME: ${request.project_name}

PROJECT BRIEF:
${request.project_brief}

SCOPE ITEMS:
${request.scope_items?.length ? request.scope_items.map(item => `- ${item}`).join('\n') : 'Not specified - use standard web project scope'}

TEMPLATES/PAGES TO BUILD:
${request.selected_templates?.length ? request.selected_templates.map(t => `- ${t}`).join('\n') : 'Standard website pages'}

${request.reference_tasks ? `REFERENCE TASKS FROM SIMILAR PROJECTS:\n${request.reference_tasks}\n\nUse these as inspiration for task structure and naming.` : ''}

${request.custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${request.custom_instructions}` : ''}

Generate a comprehensive task breakdown covering:
1. Discovery/Research phase
2. UX/Wireframes phase
3. UI Design phase
4. Development phase (frontend, backend, CMS)
5. Content phase
6. QA/Testing phase
7. Launch preparation

Respond with the JSON format specified.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'OpenAI API error' }),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const result = JSON.parse(jsonMatch[0]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result }),
      };
    } catch (parseError) {
      console.error('Failed to parse tasks:', content);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          result: null,
          raw: content,
          error: 'Failed to parse AI response',
        }),
      };
    }
  } catch (error) {
    console.error('PM generate tasks function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
