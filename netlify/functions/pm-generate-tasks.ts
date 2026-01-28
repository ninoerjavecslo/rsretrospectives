import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface GenerateTasksRequest {
  offer_text: string;
  additional_notes?: string;
  language?: 'en' | 'sl';
}

const SYSTEM_PROMPT_EN = `You are an expert project manager for a digital agency. Your job is to analyze project offers/briefs and create comprehensive, Jira-ready task breakdowns.

The offers may be in Slovenian or English - analyze them regardless of language but OUTPUT ALL TASKS IN ENGLISH.

First, analyze the offer to understand:
- Project name and client
- Project type (website, e-commerce, web app, etc.)
- CMS or technology stack
- Key deliverables and features
- Timeline if mentioned
- Any integrations needed

Then generate tasks that are:
1. Specific and actionable - no vague descriptions
2. Well-organized - logical epic/story/task hierarchy
3. Complete - cover all aspects mentioned in the offer
4. Practical - based on real agency workflows

Task Types:
- Epic: Large features/phases (e.g., "UX Research & Wireframes", "Frontend Development")
- Story: User-facing functionality (e.g., "As a user, I can filter products by category")
- Task: Technical work items (e.g., "Set up CI/CD pipeline", "Configure CMS content types")
- Subtask: Smaller pieces of stories/tasks

Standard Labels to use:
- Phase: discovery, design, development, content, qa, launch
- Profile: ux, ui, dev, pm, content, analytics
- Priority: must-have, should-have, nice-to-have

IMPORTANT: Include acceptance criteria INSIDE the description field, formatted like this:
"Description text here...

Acceptance Criteria:
- Criterion 1
- Criterion 2
- Criterion 3"

Respond ONLY with valid JSON in this exact format:
{
  "detected_project_name": "Client Name - Project Name",
  "tasks": [
    {
      "summary": "UX Research & Discovery",
      "description": "Complete UX research phase including stakeholder interviews, competitor analysis, and user research.\n\nAcceptance Criteria:\n- Stakeholder interviews completed\n- Competitor analysis documented\n- User research findings summarized",
      "task_type": "Epic",
      "priority": "Highest",
      "labels": ["discovery", "ux", "must-have"],
      "order": 1
    },
    {
      "summary": "Conduct stakeholder interviews",
      "description": "Schedule and conduct interviews with key stakeholders to understand business goals, constraints, and success metrics.\n\nAcceptance Criteria:\n- Minimum 3 stakeholder interviews completed\n- Interview notes documented\n- Key insights summarized",
      "task_type": "Task",
      "priority": "High",
      "labels": ["discovery", "ux", "must-have"],
      "parent_ref": "UX Research & Discovery",
      "order": 2
    }
  ],
  "summary": {
    "total_tasks": 45,
    "by_type": { "Epic": 5, "Story": 20, "Task": 15, "Subtask": 5 },
    "by_priority": { "Highest": 5, "High": 20, "Medium": 15, "Low": 5 }
  },
  "recommendations": [
    "Consider adding a dedicated QA sprint before launch",
    "Content migration should start in parallel with development"
  ]
}

IMPORTANT:
- Extract project name from the offer if possible
- Generate realistic tasks based on what's in the offer
- Ensure proper parent-child relationships using parent_ref
- Order tasks logically (dependencies considered)
- Include all standard project phases unless specifically excluded
- Be thorough - typical web project has 40-80 tasks
- If the offer mentions specific pages/templates, create tasks for each
- DO NOT include story_points field
- Acceptance criteria go INSIDE description, not as separate field`;

const SYSTEM_PROMPT_SL = `Ti si strokovni projektni vodja za digitalno agencijo. Tvoja naloga je analizirati projektne ponudbe in ustvariti celovite razčlenitve nalog, pripravljene za Jiro.

Ponudbe so lahko v slovenščini ali angleščini - analiziraj jih ne glede na jezik, vendar IZPIŠI VSE NALOGE V SLOVENŠČINI.

Najprej analiziraj ponudbo, da razumeš:
- Ime projekta in stranke
- Tip projekta (spletna stran, e-trgovina, spletna aplikacija itd.)
- CMS ali tehnološki sklad
- Ključne izdelke in funkcionalnosti
- Časovnico, če je omenjena
- Potrebne integracije

Nato generiraj naloge, ki so:
1. Specifične in izvedljive - brez nejasnih opisov
2. Dobro organizirane - logična hierarhija epic/story/task
3. Celovite - pokrivajo vse vidike omenjene v ponudbi
4. Praktične - temeljijo na realnih agencijskih delovnih tokovih

Tipi nalog:
- Epic: Velike funkcionalnosti/faze (npr. "UX raziskava in žičnati okvirji", "Frontend razvoj")
- Story: Funkcionalnosti za uporabnike (npr. "Kot uporabnik lahko filtriram izdelke po kategoriji")
- Task: Tehnične delovne naloge (npr. "Nastavi CI/CD pipeline", "Konfiguriraj CMS tipe vsebin")
- Subtask: Manjši deli zgodb/nalog

Standardne oznake za uporabo:
- Faza: discovery, design, development, content, qa, launch
- Profil: ux, ui, dev, pm, content, analytics
- Prioriteta: must-have, should-have, nice-to-have

POMEMBNO: Vključi kriterije sprejemljivosti ZNOTRAJ polja description, formatirano takole:
"Besedilo opisa tukaj...

Kriteriji sprejemljivosti:
- Kriterij 1
- Kriterij 2
- Kriterij 3"

Odgovori SAMO z veljavnim JSON v tej natančni obliki:
{
  "detected_project_name": "Ime stranke - Ime projekta",
  "tasks": [
    {
      "summary": "UX raziskava in odkrivanje",
      "description": "Izvedba UX raziskovalne faze vključno z intervjuji deležnikov, analizo konkurence in raziskavo uporabnikov.\n\nKriteriji sprejemljivosti:\n- Intervjuji z deležniki zaključeni\n- Analiza konkurence dokumentirana\n- Ugotovitve raziskave uporabnikov povzete",
      "task_type": "Epic",
      "priority": "Highest",
      "labels": ["discovery", "ux", "must-have"],
      "order": 1
    }
  ],
  "summary": {
    "total_tasks": 45,
    "by_type": { "Epic": 5, "Story": 20, "Task": 15, "Subtask": 5 },
    "by_priority": { "Highest": 5, "High": 20, "Medium": 15, "Low": 5 }
  },
  "recommendations": [
    "Razmisli o dodatnem QA sprintu pred lansiranjem",
    "Migracija vsebin naj se začne vzporedno z razvojem"
  ]
}

POMEMBNO:
- Izvleci ime projekta iz ponudbe, če je mogoče
- Generiraj realistične naloge na podlagi vsebine ponudbe
- Zagotovi pravilne odnose nadrejeni-podrejeni z uporabo parent_ref
- Razvrsti naloge logično (upoštevaj odvisnosti)
- Vključi vse standardne projektne faze, razen če so izrecno izključene
- Bodi temeljit - tipičen spletni projekt ima 40-80 nalog
- Če ponudba omenja specifične strani/predloge, ustvari naloge za vsako
- NE vključuj polja story_points
- Kriteriji sprejemljivosti gredo ZNOTRAJ opisa, ne kot ločeno polje`;

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

    if (!request.offer_text || request.offer_text.trim().length < 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Offer text is required (minimum 50 characters)' }),
      };
    }

    const language = request.language || 'en';
    const systemPrompt = language === 'sl' ? SYSTEM_PROMPT_SL : SYSTEM_PROMPT_EN;

    const userPrompt = `Analyze this project offer/brief and generate a complete Jira task breakdown:

---
OFFER/BRIEF:
${request.offer_text}
---

${request.additional_notes ? `ADDITIONAL NOTES FROM PM:\n${request.additional_notes}\n---` : ''}

Generate a comprehensive task breakdown covering all aspects mentioned in the offer. Include:
1. Discovery/Research phase
2. UX/Wireframes phase
3. UI Design phase
4. Development phase (frontend, backend, CMS setup)
5. Content phase (if applicable)
6. QA/Testing phase
7. Launch preparation

Remember: Acceptance criteria go INSIDE the description field, not as a separate field.
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
          { role: 'system', content: systemPrompt },
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
