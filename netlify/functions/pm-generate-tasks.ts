import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface GenerateTasksRequest {
  offer_text: string;
  additional_notes?: string;
  language?: 'en' | 'sl';
  job_id?: string;
}

const SYSTEM_PROMPT_EN = `You are a senior project manager at a digital agency. Analyze project offers and create DETAILED, SPECIFIC Jira task breakdowns.

IMPORTANT - Be SPECIFIC, not generic:
- For EACH page/template mentioned, create separate UX wireframe task AND UI design task
- For EACH feature, create development tasks broken down by component
- Include specific deliverables, not vague descriptions

REQUIRED TASK STRUCTURE:

1. DISCOVERY PHASE (Epic)
   - Kickoff meeting with client
   - Stakeholder interviews (specify who)
   - Competitor analysis (list competitors if mentioned)
   - Technical requirements gathering
   - Content audit (if redesign)

2. UX PHASE (Epic) - BE SPECIFIC FOR EACH PAGE:
   - User persona development
   - User journey mapping
   - Information architecture
   - For EACH page type create: "Wireframe: [Page Name]" (e.g., "Wireframe: Homepage", "Wireframe: Product Detail Page", "Wireframe: Contact Page")
   - Prototype creation
   - Usability testing

3. UI DESIGN PHASE (Epic) - BE SPECIFIC FOR EACH PAGE:
   - Design system/style guide creation
   - Component library design
   - For EACH page type create: "UI Design: [Page Name]" (e.g., "UI Design: Homepage", "UI Design: Product Listing", "UI Design: Checkout Flow")
   - Responsive design variants (mobile, tablet, desktop)
   - Design review and iterations

4. DEVELOPMENT PHASE (Epic) - BREAK DOWN BY FEATURE:
   - Environment setup (staging, production)
   - CMS configuration and content types
   - For EACH major feature: separate frontend and backend tasks
   - For EACH page: "Develop: [Page Name]"
   - For EACH integration: specific integration task
   - API development (if applicable)
   - Form implementations with validation
   - Search functionality (if mentioned)
   - User authentication (if mentioned)
   - E-commerce features (cart, checkout, payment - if applicable)

5. CONTENT PHASE (Epic)
   - Content migration plan
   - SEO content optimization
   - Image optimization and asset preparation
   - Content entry into CMS

6. QA PHASE (Epic)
   - Test plan creation
   - Cross-browser testing (list browsers)
   - Mobile device testing
   - Performance testing
   - Accessibility testing (WCAG)
   - Security testing
   - UAT with client

7. LAUNCH PHASE (Epic)
   - Pre-launch checklist
   - DNS and domain configuration
   - SSL certificate setup
   - Analytics and tracking setup
   - Go-live deployment
   - Post-launch monitoring
   - Client training/handover

OUTPUT FORMAT (JSON only):
{
  "detected_project_name": "Client - Project Name",
  "tasks": [
    {
      "summary": "Specific task name",
      "description": "Detailed description of what needs to be done.\\n\\nAcceptance Criteria:\\n- Specific criterion 1\\n- Specific criterion 2\\n- Specific criterion 3",
      "task_type": "Epic|Story|Task|Subtask",
      "priority": "Highest|High|Medium|Low",
      "labels": ["phase-label", "role-label"],
      "parent_ref": "Parent Epic name (for Stories/Tasks)",
      "order": 1
    }
  ],
  "summary": {
    "total_tasks": 50,
    "by_type": {"Epic": 7, "Story": 20, "Task": 20, "Subtask": 3},
    "by_priority": {"Highest": 10, "High": 20, "Medium": 15, "Low": 5}
  },
  "recommendations": ["Actionable recommendation based on offer analysis"]
}

LABELS TO USE:
- Phase: discovery, ux, ui, development, content, qa, launch
- Role: ux, ui, dev, pm, content, analytics, devops

CRITICAL RULES:
- Generate 40-70 tasks for comprehensive coverage
- Every page mentioned = wireframe task + UI design task + development task
- Every feature mentioned = specific implementation task
- Every integration = dedicated task
- Include acceptance criteria with 3-5 specific items per task
- Parent_ref links subtasks to their Epic`;

const SYSTEM_PROMPT_SL = `Si senior projektni vodja v digitalni agenciji. Analiziraj ponudbe in ustvari PODROBNE, SPECIFIČNE Jira naloge V SLOVENŠČINI.

POMEMBNO - Bodi SPECIFIČEN, ne generičen:
- Za VSAKO stran/predlogo ustvari ločeno UX wireframe nalogo IN UI design nalogo
- Za VSAKO funkcionalnost ustvari razvojne naloge razdeljene po komponentah
- Vključi specifične rezultate, ne nejasnih opisov

ZAHTEVANA STRUKTURA NALOG:

1. FAZA ODKRIVANJA (Epic)
   - Uvodni sestanek s stranko
   - Intervjuji z deležniki
   - Analiza konkurence
   - Zbiranje tehničnih zahtev
   - Revizija vsebine (če gre za prenovo)

2. UX FAZA (Epic) - SPECIFIČNO ZA VSAKO STRAN:
   - Razvoj uporabniških person
   - Mapiranje uporabniške poti
   - Informacijska arhitektura
   - Za VSAKO stran: "Žičnati okvir: [Ime strani]"
   - Izdelava prototipa
   - Testiranje uporabnosti

3. UI DESIGN FAZA (Epic) - SPECIFIČNO ZA VSAKO STRAN:
   - Oblikovanje design sistema
   - Oblikovanje knjižnice komponent
   - Za VSAKO stran: "UI oblikovanje: [Ime strani]"
   - Odzivne variante (mobilno, tablica, namizje)
   - Pregled in iteracije oblikovanja

4. RAZVOJNA FAZA (Epic) - RAZDELI PO FUNKCIONALNOSTIH:
   - Postavitev okolij (staging, produkcija)
   - Konfiguracija CMS in tipov vsebin
   - Za VSAKO funkcionalnost: ločene frontend in backend naloge
   - Za VSAKO stran: "Razvoj: [Ime strani]"
   - Za VSAKO integracijo: specifična naloga
   - Implementacija obrazcev z validacijo
   - Iskalna funkcionalnost (če omenjena)
   - E-commerce funkcije (košarica, checkout - če relevantno)

5. VSEBINSKA FAZA (Epic)
   - Načrt migracije vsebin
   - SEO optimizacija vsebin
   - Optimizacija slik
   - Vnos vsebin v CMS

6. QA FAZA (Epic)
   - Izdelava testnega načrta
   - Testiranje v različnih brskalnikih
   - Testiranje na mobilnih napravah
   - Testiranje zmogljivosti
   - Testiranje dostopnosti (WCAG)
   - UAT s stranko

7. FAZA LANSIRANJA (Epic)
   - Predlansirni seznam
   - DNS in konfiguracija domene
   - Nastavitev SSL
   - Nastavitev analitike
   - Deployment v produkcijo
   - Spremljanje po lansiranju
   - Usposabljanje stranke

FORMAT IZHODA (samo JSON):
{
  "detected_project_name": "Stranka - Ime projekta",
  "tasks": [
    {
      "summary": "Specifično ime naloge",
      "description": "Podroben opis naloge.\\n\\nKriteriji sprejemljivosti:\\n- Specifičen kriterij 1\\n- Specifičen kriterij 2",
      "task_type": "Epic|Story|Task|Subtask",
      "priority": "Highest|High|Medium|Low",
      "labels": ["faza", "vloga"],
      "parent_ref": "Ime nadrejenega Epica",
      "order": 1
    }
  ],
  "summary": {
    "total_tasks": 50,
    "by_type": {"Epic": 7, "Story": 20, "Task": 20, "Subtask": 3},
    "by_priority": {"Highest": 10, "High": 20, "Medium": 15, "Low": 5}
  },
  "recommendations": ["Priporočilo na podlagi analize ponudbe"]
}

OZNAKE:
- Faza: discovery, ux, ui, development, content, qa, launch
- Vloga: ux, ui, dev, pm, content, analytics, devops

KRITIČNA PRAVILA:
- Generiraj 40-70 nalog za celovito pokritost
- Vsaka omenjena stran = wireframe + UI design + razvoj naloga
- Vsaka funkcionalnost = specifična implementacijska naloga
- Vsaka integracija = dedikirana naloga
- Vključi kriterije sprejemljivosti s 3-5 elementi na nalogo`;

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!OPENAI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
  }

  try {
    const request = JSON.parse(event.body || '{}') as GenerateTasksRequest;

    // If job_id is provided, this is a poll request
    if (request.job_id) {
      const { data, error } = await supabase
        .from('pm_jobs')
        .select('*')
        .eq('id', request.job_id)
        .single();

      if (error || !data) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: data.status,
          result: data.result,
          error: data.error_message,
        }),
      };
    }

    // Validate input
    if (!request.offer_text || request.offer_text.trim().length < 50) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Offer text is required (minimum 50 characters)' }) };
    }

    // Create a job record
    const { data: job, error: jobError } = await supabase
      .from('pm_jobs')
      .insert({ status: 'pending', offer_text: request.offer_text.slice(0, 6000) })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create job:', jobError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create job' }) };
    }

    const jobId = job.id;

    // Process in background
    processJob(jobId, request).catch(err => console.error('Job processing error:', err));

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ job_id: jobId, status: 'pending' }),
    };

  } catch (error) {
    console.error('PM generate tasks function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

async function processJob(jobId: string, request: GenerateTasksRequest) {
  try {
    const language = request.language || 'en';
    const systemPrompt = language === 'sl' ? SYSTEM_PROMPT_SL : SYSTEM_PROMPT_EN;
    const offerText = request.offer_text.slice(0, 6000);

    const userPrompt = `Analyze this project offer and create a DETAILED task breakdown. Be SPECIFIC - create separate tasks for each page, feature, and integration mentioned.

PROJECT OFFER:
${offerText}

${request.additional_notes ? `ADDITIONAL PM NOTES:\n${request.additional_notes}\n` : ''}

IMPORTANT:
- Extract ALL pages/templates mentioned and create wireframe + design + dev tasks for each
- Extract ALL features and create specific implementation tasks
- Extract ALL integrations and create dedicated tasks
- Be thorough - a typical web project needs 40-70 tasks
- Output valid JSON only`;

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
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI error:', error);
      await supabase.from('pm_jobs').update({ status: 'error', error_message: 'OpenAI API error' }).eq('id', jobId);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await supabase.from('pm_jobs').update({ status: 'error', error_message: 'Failed to parse AI response' }).eq('id', jobId);
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    await supabase.from('pm_jobs').update({ status: 'completed', result }).eq('id', jobId);

  } catch (error) {
    console.error('Process job error:', error);
    await supabase.from('pm_jobs').update({
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error'
    }).eq('id', jobId);
  }
}

export { handler };
