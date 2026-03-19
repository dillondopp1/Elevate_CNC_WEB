export const prerender = false;

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import machineCatalogData from '../../lib/machine_catalog.json';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env with override=true to fix Windows system env vars set to empty string
function loadEnvOverride() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch { /* .env not found — rely on platform env vars */ }
}
loadEnvOverride();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_BASE = 'https://api.hubapi.com';
const MODEL = 'claude-sonnet-4-5';
const MAX_ITERATIONS = 10;

// ── Machine Catalog ──────────────────────────────────────────────────────────

const machines: any[] = (machineCatalogData as any).machines;

function getMachineCatalog(): string {
  return machines
    .map(m => `• ${m.name} | SKU: ${m.sku} | Price: $${m.price.toLocaleString()} | Line: ${m.line}`)
    .join('\n');
}

function getMachineDetails(sku: string): string {
  const m = machines.find(m => m.sku.toLowerCase() === sku.toLowerCase());
  if (!m) return `No machine found with SKU '${sku}'. Use get_machine_catalog to see all SKUs.`;
  return `Name: ${m.name}\nSKU: ${m.sku}\nPrice: $${m.price.toLocaleString()}\nLine: ${m.line}\nStatus: ${m.status}\n\nDescription:\n${m.description}`;
}

function findMachinesByBudget(maxBudget: number, minBudget = 0): string {
  const matches = machines.filter(m => m.price >= minBudget && m.price <= maxBudget);
  if (!matches.length) return `No machines found between $${minBudget.toLocaleString()} and $${maxBudget.toLocaleString()}.`;
  return [
    `Machines between $${minBudget.toLocaleString()} and $${maxBudget.toLocaleString()}:`,
    ...matches.map(m => `  • ${m.name} — $${m.price.toLocaleString()} (${m.line} line)`),
  ].join('\n');
}

function findMachinesByLine(productLine: string): string {
  const matches = machines.filter(m => m.line.toLowerCase() === productLine.toLowerCase());
  if (!matches.length) {
    const available = [...new Set(machines.map(m => m.line))].sort().join(', ');
    return `No machines found in line '${productLine}'. Available lines: ${available}`;
  }
  return [`${productLine} series machines:`, ...matches.map(m => `  • ${m.name} | $${m.price.toLocaleString()} | SKU: ${m.sku}`)].join('\n');
}

// ── HubSpot Helpers ───────────────────────────────────────────────────────────

async function hubspot(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function lookupContact(email: string): Promise<string> {
  const data = await hubspot('POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
  });
  if (!data.results?.length) return `No contact found with email '${email}'.`;
  const c = data.results[0];
  const p = c.properties;
  return `Contact found — ID: ${c.id}\nName: ${p.firstname} ${p.lastname}\nEmail: ${p.email}\nPhone: ${p.phone || 'N/A'}\nCompany: ${p.company || 'N/A'}`;
}

async function createContact(firstname: string, lastname: string, email: string, phone?: string, company?: string, state?: string): Promise<string> {
  const props: any = { firstname, lastname, email };
  if (phone) props.phone = phone;
  if (company) props.company = company;
  if (state) props.state = state;
  const data = await hubspot('POST', '/crm/v3/objects/contacts', { properties: props });
  return `Contact created — ID: ${data.id}\nName: ${firstname} ${lastname}\nEmail: ${email}`;
}

async function createDeal(dealName: string, contactId: string, stageId: string, amount?: number, machineInterest?: string, qualificationNotes?: string): Promise<string> {
  const props: any = { dealname: dealName, dealstage: stageId, pipeline: 'default' };
  if (amount) props.amount = String(amount);
  if (machineInterest) props.description = machineInterest;
  const deal = await hubspot('POST', '/crm/v3/objects/deals', { properties: props });
  const dealId = deal.id;
  await hubspot('PUT', `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`);
  if (qualificationNotes) await addNote(dealId, contactId, qualificationNotes);
  return `Deal created — ID: ${dealId}\nName: ${dealName}\nStage ID: ${stageId}`;
}

async function advanceDealStage(dealId: string, stageId: string, stageName: string): Promise<string> {
  await hubspot('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties: { dealstage: stageId } });
  return `Deal ${dealId} advanced to '${stageName}' (stage ${stageId}).`;
}

async function addNote(dealId: string, contactId: string, note: string): Promise<string> {
  await hubspot('POST', '/crm/v3/objects/notes', {
    properties: {
      hs_note_body: note,
      hs_timestamp: new Date().toISOString(),
    },
    associations: [
      { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
      { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
    ],
  });
  return `Note added to deal ${dealId}.`;
}

async function getContactDeals(contactId: string): Promise<string> {
  const data = await hubspot('GET', `/crm/v3/objects/contacts/${contactId}/associations/deals`);
  const results = data.results || [];
  if (!results.length) return `No deals found for contact ${contactId}.`;
  const dealDetails = await Promise.all(
    results.map((r: any) =>
      fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/${r.id}?properties=dealname,dealstage,amount`, {
        headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
      }).then(r => r.json())
    )
  );
  const lines = [`Deals for contact ${contactId}:`];
  for (const d of dealDetails) {
    const p = d.properties || {};
    lines.push(`  • Deal ${d.id}: ${p.dealname || 'N/A'} | Stage: ${p.dealstage || 'N/A'} | Amount: $${parseFloat(p.amount || '0').toLocaleString()}`);
  }
  return lines.join('\n');
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_machine_catalog',
    description: 'Return a summary of all available Elevate CNC machines including name, SKU, price, and product line.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_machine_details',
    description: 'Get full details for a specific machine by SKU.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string', description: 'The machine SKU (e.g. ECN-APEX-410-ATC)' } },
      required: ['sku'],
    },
  },
  {
    name: 'find_machines_by_budget',
    description: 'Find machines within a budget range.',
    input_schema: {
      type: 'object',
      properties: {
        max_budget: { type: 'number', description: 'Maximum budget in USD' },
        min_budget: { type: 'number', description: 'Minimum budget in USD (default 0)' },
      },
      required: ['max_budget'],
    },
  },
  {
    name: 'find_machines_by_line',
    description: 'Get all machines in a specific product line.',
    input_schema: {
      type: 'object',
      properties: { product_line: { type: 'string', description: 'Product line name (APEX, Summit, Ridge, Ascent, Prime, ION, Spark, Plasma)' } },
      required: ['product_line'],
    },
  },
  {
    name: 'lookup_contact',
    description: 'Check if a contact already exists in HubSpot CRM by email address.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: "The contact's email address" } },
      required: ['email'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact in HubSpot CRM.',
    input_schema: {
      type: 'object',
      properties: {
        firstname: { type: 'string', description: "Contact's first name" },
        lastname: { type: 'string', description: "Contact's last name" },
        email: { type: 'string', description: "Contact's email address" },
        phone: { type: 'string', description: 'Phone number (optional)' },
        company: { type: 'string', description: 'Company name (optional)' },
        state: { type: 'string', description: 'US state abbreviation, e.g. ID, TX, CA (optional)' },
      },
      required: ['firstname', 'lastname', 'email'],
    },
  },
  {
    name: 'create_deal',
    description: 'Create a new deal in HubSpot and associate it with a contact.',
    input_schema: {
      type: 'object',
      properties: {
        deal_name: { type: 'string', description: "Name of the deal (e.g. 'John Smith - Summit ATC Inquiry')" },
        contact_id: { type: 'string', description: 'HubSpot contact ID to associate the deal with' },
        stage_id: { type: 'string', description: 'Pipeline stage ID (e.g. 3372444347 for Initial Inquiry)' },
        amount: { type: 'number', description: 'Estimated deal value in USD (optional)' },
        machine_interest: { type: 'string', description: 'Machine(s) the prospect is interested in (optional)' },
        qualification_notes: { type: 'string', description: 'Summary of qualification conversation (optional)' },
      },
      required: ['deal_name', 'contact_id', 'stage_id'],
    },
  },
  {
    name: 'advance_deal_stage',
    description: 'Move a deal to a new pipeline stage.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'HubSpot deal ID' },
        stage_id: { type: 'string', description: 'Target stage ID' },
        stage_name: { type: 'string', description: 'Human-readable stage name for confirmation' },
      },
      required: ['deal_id', 'stage_id', 'stage_name'],
    },
  },
  {
    name: 'add_deal_note',
    description: 'Add a note to a deal in HubSpot to document conversation details.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'HubSpot deal ID' },
        contact_id: { type: 'string', description: 'HubSpot contact ID' },
        note: { type: 'string', description: 'Note text' },
      },
      required: ['deal_id', 'contact_id', 'note'],
    },
  },
  {
    name: 'get_contact_deals',
    description: 'Get all existing deals for a contact.',
    input_schema: {
      type: 'object',
      properties: { contact_id: { type: 'string', description: 'HubSpot contact ID' } },
      required: ['contact_id'],
    },
  },
];

// ── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case 'get_machine_catalog':       return getMachineCatalog();
      case 'get_machine_details':       return getMachineDetails(input.sku);
      case 'find_machines_by_budget':   return findMachinesByBudget(input.max_budget, input.min_budget);
      case 'find_machines_by_line':     return findMachinesByLine(input.product_line);
      case 'lookup_contact':            return await lookupContact(input.email);
      case 'create_contact':            return await createContact(input.firstname, input.lastname, input.email, input.phone, input.company, input.state);
      case 'create_deal':               return await createDeal(input.deal_name, input.contact_id, input.stage_id, input.amount, input.machine_interest, input.qualification_notes);
      case 'advance_deal_stage':        return await advanceDealStage(input.deal_id, input.stage_id, input.stage_name);
      case 'add_deal_note':             return await addNote(input.deal_id, input.contact_id, input.note);
      case 'get_contact_deals':         return await getContactDeals(input.contact_id);
      default:                          return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Tool error: ${err.message}`;
  }
}

// ── Dwight System Prompt ──────────────────────────────────────────────────────

const DWIGHT_SYSTEM_PROMPT = `You are Dwight Schrute, Sales Director at Elevate CNC — the top-performing CNC machine sales agent in the entire mid-continent region, possibly the country. You are intense, direct, deeply knowledgeable, and absolutely dedicated to closing deals for Elevate CNC.

## Your Personality
- Speak with authority and confidence. You are the expert.
- You are blunt, no-nonsense, and occasionally intense — but always professional with genuine prospects.
- Occasional Dwight-isms are welcome ("False.", "Fact:", etc.) but keep it mostly professional.
- You genuinely want to help customers find the right machine for their operation.
- Keep responses CONCISE — this is a chat widget, not an essay. 2-4 short paragraphs max.

## Your Mission
Qualify leads and recommend the right machine. For every conversation:
1. Identify who you're talking to (name, company, contact info)
2. Qualify: what they're cutting, bed size needed, budget, timeline, power availability (110V or 220V)
3. Recommend the right machine(s) from the catalog
4. Create/update HubSpot CRM records for every qualified lead
5. Move deal to appropriate pipeline stage

## Pipeline Stages
- Initial Inquiry: 3372444347
- Qualification: 3372444348
- Proposal Sent: 3372444349
- Negotiation: 3372444350
- Order Placed: 3375066847
- Machine Ordered: 3375066848
- In Transit: 3375066849
- QC & Rewire: 3375066850
- Ready to Deliver: 3375066851
- Closed Won: closedwon
- Closed Lost: closedlost

## Machine Selection Guidelines
- Hobbyist / plasma entry (<$2k): Spark series
- Plasma mid-tier ($2k-$4k): ION or Prime series
- Startup / small shop ($5k-$9k): Ascent or Ridge series
- Growing shop ($9k-$18k): Ridge 4x8 or Summit 4x4
- Production shop ($18k-$25k): Summit 4x8 or Summit ATC
- Large production ($25k+): APEX series

## CRM Rules
- Every lead with contact info MUST be entered in HubSpot
- Every qualified conversation MUST have a deal with notes
- Never leave a qualified prospect without a CRM record

## Response Style
- CONCISE — chat format, not a report. Short paragraphs.
- Ask 1-2 qualification questions at a time
- Use bold for machine names and prices
- End every response with a clear next step or question

You have tools to look up machines and manage HubSpot. Use them proactively.`;

// ── Agentic Loop ──────────────────────────────────────────────────────────────

async function runDwight(messages: any[]): Promise<{ response: string; messages: any[] }> {
  const conversation = [...messages];
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: DWIGHT_SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: conversation,
    });

    conversation.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const text = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim();
      return { response: text, messages: conversation };
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      conversation.push({ role: 'user', content: toolResults });
    } else {
      // Unexpected stop reason — extract any text and return
      const text = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
        .trim();
      return { response: text || 'Something went wrong. Please try again.', messages: conversation };
    }

    iteration++;
  }

  return { response: 'I have run a thorough analysis. Please continue with your inquiry.', messages: conversation };
}

// ── API Handler ───────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runDwight(messages);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Dwight API error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
