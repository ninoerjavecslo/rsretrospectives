import type { Handler, HandlerEvent } from '@netlify/functions';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ParseOfferRequest {
  offer_text: string;
}

const SYSTEM_PROMPT = `You are an expert at parsing digital agency project offers/proposals. The offers may be in Slovenian or English.

Extract structured data from the offer document. The agency uses these profiles:
- UX: User experience, research, user flows, wireframes, information architecture
- UI: Visual design, UI components, design system
- DESIGN: Branding, graphics, illustrations, art direction
- DEV: Development, frontend, backend, CMS setup, integrations
- PM: Project management, coordination, communication
- CONTENT: Copywriting, content strategy, content migration
- ANALYTICS: Tracking setup, SEO, analytics, cookies/GDPR

Scope item types: Wireframe, Component, Page, Template, Integration, Content, Custom

Look for:
1. Client name and project name
2. Project type (website, web_app, ecommerce, mobile_app, branding)
3. CMS mentioned (WordPress, Webflow, Shopify, Payload, Umbraco, custom, etc.)
4. Integrations mentioned (payment, CRM, API, PIM, ERP, etc.)
5. Total offer value/price (look for "Skupaj", "Total", final sum)
6. Phases and their costs - map these to profile hours using €80/hour rate
7. Deliverables/scope items with quantities (pages, components, templates, etc.)

When mapping phases to profiles:
- "Načrtovanje", "UX", "wireframe", "sitemap", "analiza" → UX hours
- "Oblikovanje", "dizajn", "UI", "art direction" → UI hours
- "Razvoj", "development", "frontend", "backend", "CMS" → DEV hours
- "Vodenje projekta", "koordinacija", "PM" → PM hours
- "Vsebine", "content", "vnos vsebin" → CONTENT hours
- "SEO", "analitika", "tracking", "piškotki" → ANALYTICS hours
- "QA", "testiranje" → split between DEV and PM

To convert EUR to hours: hours = EUR / 80

If something is unclear, make your best estimate and add a warning.

Respond ONLY with valid JSON in this exact format:
{
  "name": "Project Name",
  "client": "Client Name",
  "project_type": "website",
  "cms": "custom",
  "integrations": "PIM, Analytics",
  "offer_value": 67400,
  "profile_hours": [
    { "profile": "UX", "estimated_hours": 40 },
    { "profile": "UI", "estimated_hours": 60 },
    { "profile": "DEV", "estimated_hours": 200 },
    { "profile": "PM", "estimated_hours": 30 },
    { "profile": "CONTENT", "estimated_hours": 50 },
    { "profile": "ANALYTICS", "estimated_hours": 25 }
  ],
  "scope_items": [
    { "name": "Sitemap", "type": "Custom", "quantity": 1 },
    { "name": "Wireframes", "type": "Wireframe", "quantity": 20 },
    { "name": "Homepage", "type": "Page", "quantity": 1 },
    { "name": "Product page", "type": "Template", "quantity": 1 }
  ],
  "brief_summary": "Website redesign project including UX/UI design, custom CMS development, content migration, and analytics setup.",
  "confidence": "high",
  "warnings": []
}`;

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
    const request = JSON.parse(event.body || '{}') as ParseOfferRequest;

    if (!request.offer_text || request.offer_text.trim().length < 50) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Offer text is too short or missing' }),
      };
    }

    const userPrompt = `Parse this project offer/proposal and extract structured data:

---
${request.offer_text}
---

Extract all relevant information and provide your response in the JSON format specified.`;

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
        temperature: 0.2,
        max_tokens: 3000,
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

    // Try to parse the JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ parsed }),
      };
    } catch (parseError) {
      console.error('Failed to parse offer:', content);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          parsed: null,
          raw: content,
          error: 'Failed to parse AI response',
        }),
      };
    }
  } catch (error) {
    console.error('Parse offer function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler };
