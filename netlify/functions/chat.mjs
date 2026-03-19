import Anthropic from '@anthropic-ai/sdk';
import machineCatalogData from '../../src/lib/machine_catalog.json' assert { type: 'json' };

const HUBSPOT_BASE = 'https://api.hubapi.com';
const MODEL = 'claude-sonnet-4-5';
const MAX_ITERATIONS = 10;

// ── Machine Catalog ───────────────────────────────────────────────────────────

const machines = machineCatalogData.machines;

function getMachineCatalog() {
  return machines
    .map(m => `• ${m.name} | SKU: ${m.sku} | Price: $${m.price.toLocaleString()} | Line: ${m.line}`)
    .join('\n');
}

function getMachineDetails(sku) {
  const m = machines.find(m => m.sku.toLowerCase() === sku.toLowerCase());
  if (!m) return `No machine found with SKU '${sku}'. Use get_machine_catalog to see all SKUs.`;
  return `Name: ${m.name}\nSKU: ${m.sku}\nPrice: $${m.price.toLocaleString()}\nLine: ${m.line}\n\nDescription:\n${m.description}`;
}

function findMachinesByBudget(maxBudget, minBudget = 0) {
  const matches = machines.filter(m => m.price >= minBudget && m.price <= maxBudget);
  if (!matches.length) return `No machines found between $${minBudget.toLocaleString()} and $${maxBudget.toLocaleString()}.`;
  return [
    `Machines between $${minBudget.toLocaleString()} and $${maxBudget.toLocaleString()}:`,
    ...matches.map(m => `  • ${m.name} — $${m.price.toLocaleString()} (${m.line} line)`),
  ].join('\n');
}

function findMachinesByLine(productLine) {
  const matches = machines.filter(m => m.line.toLowerCase() === productLine.toLowerCase());
  if (!matches.length) {
    const available = [...new Set(machines.map(m => m.line))].sort().join(', ');
    return `No machines found in line '${productLine}'. Available lines: ${available}`;
  }
  return [`${productLine} series machines:`, ...matches.map(m => `  • ${m.name} | $${m.price.toLocaleString()} | SKU: ${m.sku}`)].join('\n');
}

// ── HubSpot ───────────────────────────────────────────────────────────────────

async function hs(method, path, body) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

async function lookupContact(email) {
  const data = await hs('POST', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['firstname', 'lastname', 'email', 'phone', 'company'],
  });
  if (!data.results?.length) return `No contact found with email '${email}'.`;
  const c = data.results[0], p = c.properties;
  return `Contact found — ID: ${c.id}\nName: ${p.firstname} ${p.lastname}\nEmail: ${p.email}\nPhone: ${p.phone || 'N/A'}\nCompany: ${p.company || 'N/A'}`;
}

async function createContact(firstname, lastname, email, phone, company, state) {
  const props = { firstname, lastname, email };
  if (phone) props.phone = phone;
  if (company) props.company = company;
  if (state) props.state = state;
  const data = await hs('POST', '/crm/v3/objects/contacts', { properties: props });
  return `Contact created — ID: ${data.id}\nName: ${firstname} ${lastname}\nEmail: ${email}`;
}

async function createDeal(dealName, contactId, stageId, amount, machineInterest, qualificationNotes) {
  const props = { dealname: dealName, dealstage: stageId, pipeline: 'default' };
  if (amount) props.amount = String(amount);
  if (machineInterest) props.description = machineInterest;
  const deal = await hs('POST', '/crm/v3/objects/deals', { properties: props });
  const dealId = deal.id;
  await hs('PUT', `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`);
  if (qualificationNotes) await addNote(dealId, contactId, qualificationNotes);
  return `Deal created — ID: ${dealId}\nName: ${dealName}\nStage ID: ${stageId}`;
}

async function advanceDealStage(dealId, stageId, stageName) {
  await hs('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties: { dealstage: stageId } });
  return `Deal ${dealId} advanced to '${stageName}'.`;
}

async function addNote(dealId, contactId, note) {
  await hs('POST', '/crm/v3/objects/notes', {
    properties: { hs_note_body: note, hs_timestamp: new Date().toISOString() },
    associations: [
      { to: { id: dealId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] },
      { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] },
    ],
  });
  return `Note added to deal ${dealId}.`;
}

async function getContactDeals(contactId) {
  const data = await hs('GET', `/crm/v3/objects/contacts/${contactId}/associations/deals`);
  const results = data.results || [];
  if (!results.length) return `No deals found for contact ${contactId}.`;
  const deals = await Promise.all(
    results.map(r =>
      fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals/${r.id}?properties=dealname,dealstage,amount`, {
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
      }).then(r => r.json())
    )
  );
  return [`Deals for contact ${contactId}:`, ...deals.map(d => {
    const p = d.properties || {};
    return `  • Deal ${d.id}: ${p.dealname || 'N/A'} | Stage: ${p.dealstage || 'N/A'} | $${parseFloat(p.amount || '0').toLocaleString()}`;
  })].join('\n');
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  { name: 'get_machine_catalog', description: 'Return all Elevate CNC machines with name, SKU, price, and line.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_machine_details', description: 'Get full details for a machine by SKU.', input_schema: { type: 'object', properties: { sku: { type: 'string', description: 'Machine SKU' } }, required: ['sku'] } },
  { name: 'find_machines_by_budget', description: 'Find machines within a budget range.', input_schema: { type: 'object', properties: { max_budget: { type: 'number' }, min_budget: { type: 'number' } }, required: ['max_budget'] } },
  { name: 'find_machines_by_line', description: 'Get all machines in a product line (APEX, Summit, Ridge, Ascent, Prime, ION, Spark, Plasma).', input_schema: { type: 'object', properties: { product_line: { type: 'string' } }, required: ['product_line'] } },
  { name: 'lookup_contact', description: 'Check if a contact exists in HubSpot by email.', input_schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
  { name: 'create_contact', description: 'Create a new HubSpot contact.', input_schema: { type: 'object', properties: { firstname: { type: 'string' }, lastname: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, company: { type: 'string' }, state: { type: 'string' } }, required: ['firstname', 'lastname', 'email'] } },
  { name: 'create_deal', description: 'Create a deal in HubSpot and associate with a contact.', input_schema: { type: 'object', properties: { deal_name: { type: 'string' }, contact_id: { type: 'string' }, stage_id: { type: 'string' }, amount: { type: 'number' }, machine_interest: { type: 'string' }, qualification_notes: { type: 'string' } }, required: ['deal_name', 'contact_id', 'stage_id'] } },
  { name: 'advance_deal_stage', description: 'Move a deal to a new pipeline stage.', input_schema: { type: 'object', properties: { deal_id: { type: 'string' }, stage_id: { type: 'string' }, stage_name: { type: 'string' } }, required: ['deal_id', 'stage_id', 'stage_name'] } },
  { name: 'add_deal_note', description: 'Add a note to a HubSpot deal.', input_schema: { type: 'object', properties: { deal_id: { type: 'string' }, contact_id: { type: 'string' }, note: { type: 'string' } }, required: ['deal_id', 'contact_id', 'note'] } },
  { name: 'get_contact_deals', description: 'Get all deals for a contact.', input_schema: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] } },
];

// ── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(name, input) {
  try {
    switch (name) {
      case 'get_machine_catalog':     return getMachineCatalog();
      case 'get_machine_details':     return getMachineDetails(input.sku);
      case 'find_machines_by_budget': return findMachinesByBudget(input.max_budget, input.min_budget);
      case 'find_machines_by_line':   return findMachinesByLine(input.product_line);
      case 'lookup_contact':          return await lookupContact(input.email);
      case 'create_contact':          return await createContact(input.firstname, input.lastname, input.email, input.phone, input.company, input.state);
      case 'create_deal':             return await createDeal(input.deal_name, input.contact_id, input.stage_id, input.amount, input.machine_interest, input.qualification_notes);
      case 'advance_deal_stage':      return await advanceDealStage(input.deal_id, input.stage_id, input.stage_name);
      case 'add_deal_note':           return await addNote(input.deal_id, input.contact_id, input.note);
      case 'get_contact_deals':       return await getContactDeals(input.contact_id);
      default:                        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error: ${err.message}`;
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const DWIGHT_SYSTEM_PROMPT = `You are Dwight Schrute, Sales Director at Elevate CNC — the top-performing CNC machine sales agent in the region. Intense, direct, knowledgeable, dedicated.

## Personality
- Speak with authority. You are the expert.
- Blunt and no-nonsense but professional with real prospects.
- Occasional Dwight-isms welcome ("False.", "Fact:") but keep it professional.
- Keep responses CONCISE — this is a chat widget. 2-4 short paragraphs max.

## Mission
Qualify leads and recommend machines. For every conversation:
1. Get their name, company, contact info
2. Qualify: what cutting, bed size, budget, timeline, 110V or 220V power
3. Recommend machines from catalog
4. Create HubSpot CRM records for every qualified lead
5. Move deal to correct pipeline stage

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

## Machine Selection
- Hobbyist plasma (<$2k): Spark series
- Plasma mid ($2k-$4k): ION or Prime
- Small shop ($5k-$9k): Ascent or Ridge
- Growing shop ($9k-$18k): Ridge 4x8 or Summit 4x4
- Production ($18k-$25k): Summit 4x8 or Summit ATC
- Large production ($25k+): APEX

## CRM Rules
- Every lead with contact info MUST be in HubSpot
- Every qualified conversation MUST have a deal with notes

## Style
- CONCISE. Chat format. Short paragraphs.
- Ask 1-2 questions at a time
- Bold machine names and prices
- Always end with a clear next step or question

Use tools proactively.`;

// ── Agentic Loop ──────────────────────────────────────────────────────────────

async function runDwight(client, messages) {
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
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return { response: text, messages: conversation };
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      conversation.push({ role: 'user', content: toolResults });
    } else {
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return { response: text || 'Something went wrong. Please try again.', messages: conversation };
    }

    iteration++;
  }

  return { response: 'Please continue with your inquiry.', messages: conversation };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages } = JSON.parse(event.body || '{}');

    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await runDwight(client, messages);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    console.error('Dwight function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
