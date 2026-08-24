import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

const list = (value) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const norm = (value) => String(value || "").trim().toLowerCase();

function includesValue(values, value) {
  if (!values.length) return true;
  const candidate = norm(value);
  return Boolean(candidate) && values.some((item) => {
    const expected = norm(item);
    return expected === candidate || (expected.length >= 2 && candidate.includes(expected));
  });
}

export function ruleMatches(rule, lead) {
  const checks = [
    [list(rule.match_cities), lead.city],
    [list(rule.match_states), lead.state],
    [list(rule.match_courses), lead.interested_course_slug || lead.current_situation || lead.initial_query || lead.cta],
    [list(rule.match_sources), lead.source],
    [list(rule.match_ctas), lead.cta],
  ].filter(([values]) => values.length);
  if (!checks.length) return true;
  return rule.match_all
    ? checks.every(([values, value]) => includesValue(values, value))
    : checks.some(([values, value]) => includesValue(values, value));
}

function leadData(lead) {
  return {
    name: lead.name || "", email: lead.email || "", mobile: lead.phone || "", phone: lead.phone || "",
    city: lead.city || "", state: lead.state || "",
    course: lead.interested_course_slug || lead.current_situation || lead.cta || lead.initial_query || "",
    university: lead.interested_college_slug || "", leadSource: lead.source || "",
    leadMedium: lead.medium || "", leadCampaign: lead.campaign || lead.cta || "",
  };
}

function applyTransform(value, transform) {
  const raw = String(value ?? "");
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (transform === "first") return parts[0] || "";
  if (transform === "last") return parts.length > 1 ? parts.slice(1).join(" ") : (parts[0] || "");
  if (transform === "initials") return parts.map((part) => part[0]?.toUpperCase() || "").join("");
  if (transform === "lower") return raw.toLowerCase();
  if (transform === "upper") return raw.toUpperCase();
  if (transform === "digits") return raw.replace(/\D/g, "");
  return raw;
}

function resolvePrefillValue(config, data) {
  if (typeof config === "string") return config;
  if (!config || typeof config !== "object") return "";
  if (config.mode === "static") return String(config.value ?? "");
  if (config.mode === "lead") return applyTransform(data[config.leadField], config.transform);
  return "";
}

export function getPrefillOverrides(rule, universityId, lead) {
  const block = object(object(rule.prefills)[universityId]);
  const selected = {};
  const merge = (value) => Object.assign(selected, object(value));
  merge(block["*"]);
  merge(block.default);

  const course = norm(lead.interested_course_slug || lead.initial_query || lead.cta);
  const campaign = norm(lead.cta || lead.campaign);
  const source = norm(lead.source);
  const city = norm(lead.city);
  for (const [key, value] of Object.entries(block)) {
    const candidate = norm(key);
    if (course && (candidate === course || candidate === `course:${course}`)) merge(value);
  }
  for (const [key, value] of Object.entries(block)) {
    const candidate = norm(key);
    if (campaign && candidate === `campaign:${campaign}`) merge(value);
    if (source && candidate === `source:${source}`) merge(value);
    if (city && candidate === `city:${city}`) merge(value);
  }

  const data = leadData(lead);
  return Object.fromEntries(Object.entries(selected)
    .map(([key, value]) => [key, resolvePrefillValue(value, data)])
    .filter(([, value]) => value !== "" && value != null));
}

function categorize(status, body, ok) {
  const text = norm(body);
  if (status === 409 || text.includes("duplicate") || text.includes("already exist") || text.includes("already registered")) return "Duplicate";
  return ok ? "Success" : "Fail";
}

export function buildPartnerRequest(university, lead, overrides = {}) {
  const data = leadData(lead);
  const mapping = object(university.column_mapping);
  const defaults = object(university.university_defaults || university.default_values);
  const staticFields = object(university.static_fields);
  for (const [key, value] of Object.entries(defaults)) if (!data[key] && value) data[key] = String(value);

  const headers = { "content-type": "application/json", ...object(university.custom_headers) };
  if (university.auth_type === "bearer" && university.auth_header_value) headers.authorization = `Bearer ${university.auth_header_value}`;
  if (university.auth_type === "custom_header" && university.auth_header_key && university.auth_header_value) headers[university.auth_header_key] = university.auth_header_value;

  let payload;
  if (university.api_type === "upgrad") {
    const parts = String(data.name).trim().split(/\s+/).filter(Boolean);
    const firstname = parts.shift() || "Lead";
    const secret = String(university.secret_key || "").trim();
    if (secret) headers.authorization = secret.toLowerCase().startsWith("basic ") ? secret : `Basic ${Buffer.from(secret).toString("base64")}`;
    payload = {
      firstname, lastname: parts.join(" ") || firstname, email: data.email,
      phone: { number: String(data.mobile).replace(/\D/g, "").slice(-10), code: "+91" },
      course: data.course, city: data.city, state: data.state, country: "India",
      sendWelcomeMail: true, isDetectLocation: false,
      leadSource: { platform: "DekhoCampus", platformSection: "" }, ...staticFields, ...overrides,
    };
  } else {
    payload = {};
    for (const [key, value] of Object.entries(data)) if (value) payload[mapping[key] || key] = String(value);
    if (university.college_id) payload.college_id = university.college_id;
    if (university.secret_key) payload.secret_key = university.secret_key;
    if (university.source) payload[mapping.source || "source"] = university.source;
    if (university.medium) payload[mapping.medium || "medium"] = university.medium;
    if (university.campaign) payload[mapping.campaign || "campaign"] = university.campaign;
    Object.assign(payload, staticFields, overrides);
  }
  if ((university.payload_wrapper === "array" || university.api_type === "leadsquared") && !Array.isArray(payload)) payload = [payload];
  return { headers, payload };
}

async function sendToUniversity(university, lead, rule, flowId = null, multiFlowId = null) {
  const recent = university.leads_per_minute > 0
    ? await prisma.lp_push_logs.count({ where: { university_id: university.id, created_at: { gt: new Date(Date.now() - 60_000) } } })
    : 0;
  if (recent >= university.leads_per_minute) {
    await prisma.lp_push_logs.create({ data: { id: randomUUID(), lead_id: lead.id, university_id: university.id, rule_id: rule.id, flow_id: flowId, multi_flow_id: multiFlowId, status: "RateLimited", error: `>${university.leads_per_minute}/min` } });
    return;
  }
  const overrides = getPrefillOverrides(rule, university.id, lead);
  const { headers, payload } = buildPartnerRequest(university, lead, overrides);
  let status = "Fail"; let httpStatus = 0; let responseBody = ""; let error = null;
  try {
    const response = await fetch(university.api_url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000) });
    httpStatus = response.status;
    responseBody = (await response.text()).slice(0, 50_000);
    status = categorize(response.status, responseBody, response.ok);
  } catch (cause) { error = String(cause); }
  await prisma.lp_push_logs.create({ data: { id: randomUUID(), lead_id: lead.id, university_id: university.id, rule_id: rule.id, flow_id: flowId, multi_flow_id: multiFlowId, status, http_status: httpStatus, request_payload: payload, response_body: responseBody, error } });
}

export async function dispatchLead(leadId) {
  const lead = await prisma.leads.findUnique({ where: { id: leadId } });
  if (!lead || !lead.city || !lead.state || !lead.current_situation) return { dispatched: 0, reason: "lead incomplete" };
  const [directRules, flows, multiFlows] = await Promise.all([
    prisma.lp_automation_rules.findMany({ where: { is_active: true, auto_dispatch: true }, orderBy: { priority: "asc" } }),
    prisma.lp_marketing_flows.findMany({ where: { is_active: true } }),
    prisma.lp_multi_flows.findMany({ where: { is_active: true, trigger_event: "lead_insert" } }),
  ]);
  const activeFlowIds = new Set(multiFlows.flatMap((item) => list(item.flow_ids)));
  const activeFlows = flows.filter((flow) => activeFlowIds.has(flow.id));
  const flowRuleIds = new Set(activeFlows.flatMap((flow) => list(flow.rule_ids)));
  const flowRules = flowRuleIds.size ? await prisma.lp_automation_rules.findMany({ where: { id: { in: [...flowRuleIds] }, is_active: true } }) : [];
  const rules = [...new Map([...directRules, ...flowRules].map((rule) => [rule.id, rule])).values()]
    .filter((rule) => ruleMatches(rule, lead))
    .sort((a, b) => a.priority - b.priority);
  const universityRules = new Map();
  for (const rule of rules) for (const id of list(rule.university_ids)) if (!universityRules.has(id)) universityRules.set(id, rule);
  if (!universityRules.size) return { dispatched: 0, reason: "no rules matched" };
  const universities = await prisma.lp_universities.findMany({ where: { id: { in: [...universityRules.keys()] }, is_active: true } });
  await Promise.all(universities.map((university) => {
    const rule = universityRules.get(university.id);
    const flow = activeFlows.find((item) => list(item.rule_ids).includes(rule.id));
    const multi = multiFlows.find((item) => flow && list(item.flow_ids).includes(flow.id));
    return sendToUniversity(university, lead, rule, flow?.id || null, multi?.id || null);
  }));
  return { dispatched: universities.length };
}

export function queueLeadAutomation(leadId) {
  setImmediate(() => dispatchLead(leadId).catch((error) => console.error("lead automation failed", { leadId, error })));
}
