import { randomUUID } from "node:crypto";
import { prisma } from "./db.mjs";

const list = (value) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const norm = (value) => String(value || "").trim().toLowerCase();
const compact = (value) => norm(value).replace(/[^a-z0-9]+/g, "");

function includesValue(values, value) {
  if (!values.length) return true;
  const candidate = norm(value);
  const compactCandidate = compact(value);
  return Boolean(candidate) && values.some((item) => {
    const expected = norm(item);
    const compactExpected = compact(item);
    return expected === candidate
      || (expected.length >= 2 && candidate.includes(expected))
      || (compactExpected.length >= 2 && compactCandidate.includes(compactExpected));
  });
}

function leadFieldValue(lead, field) {
  const aliases = {
    mobile: "phone",
    course: "interested_course_slug",
    specialization: "current_situation",
    college: "interested_college_slug",
    exam: "interested_exam_slug",
    campaign: "cta",
    lead_source: "source",
  };
  const key = aliases[norm(field)] || field;
  if (key === "interested_course_slug") return lead.interested_course_slug || lead.current_situation || lead.initial_query || lead.cta;
  if (key === "current_situation") return lead.current_situation || lead.interested_course_slug || lead.initial_query;
  return lead[key];
}

export function ruleMatches(rule, lead) {
  const checks = [
    [list(rule.match_cities), lead.city],
    [list(rule.match_states), lead.state],
    [list(rule.match_courses), lead.interested_course_slug || lead.current_situation || lead.initial_query || lead.cta],
    [list(rule.match_sources), lead.source],
    [list(rule.match_ctas), lead.cta],
  ].filter(([values]) => values.length);
  for (const [field, values] of Object.entries(object(rule.match_fields))) {
    const expected = list(values);
    if (expected.length) checks.push([expected, leadFieldValue(lead, field)]);
  }
  if (!checks.length) return true;
  return rule.match_all
    ? checks.every(([values, value]) => includesValue(values, value))
    : checks.some(([values, value]) => includesValue(values, value));
}

export function isLeadReadyForAutomation(lead) {
  const course = lead?.interested_course_slug || lead?.current_situation || lead?.initial_query || lead?.cta;
  return Boolean(lead?.city && lead?.state && course);
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

async function sendToUniversity(university, lead, rule, flowId = null, multiFlowId = null, deliveryState = {}) {
  const delivered = deliveryState.delivered;
  if (delivered) return { universityId: university.id, status: delivered.status, skipped: true, matchedRuleIds: list(rule.matched_rule_ids || [rule.id]) };
  const recent = Number(deliveryState.recentCount || 0);
  const perMinute = Math.max(0, Number(university.leads_per_minute ?? 5));
  if (recent >= perMinute) {
    await prisma.lp_push_logs.create({ data: { id: randomUUID(), lead_id: lead.id, university_id: university.id, rule_id: rule.id, flow_id: flowId, multi_flow_id: multiFlowId, matched_rule_ids: list(rule.matched_rule_ids || [rule.id]), status: "RateLimited", error: `>${perMinute}/min` } });
    return { universityId: university.id, status: "RateLimited" };
  }
  const overrides = getPrefillOverrides(rule, university.id, lead);
  const { headers, payload } = buildPartnerRequest(university, lead, overrides);
  headers["x-idempotency-key"] = `dc-lead-${lead.id}-${university.id}`;
  let status = "Fail"; let httpStatus = 0; let responseBody = ""; let error = null;
  try {
    const timeoutMs = Math.min(60_000, Math.max(5_000, Number(university.api_timeout_seconds ?? 30) * 1_000));
    const response = await fetch(university.api_url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs) });
    httpStatus = response.status;
    responseBody = (await response.text()).slice(0, 50_000);
    status = categorize(response.status, responseBody, response.ok);
  } catch (cause) { error = String(cause); }
  const matchedRuleIds = list(rule.matched_rule_ids || [rule.id]);
  await prisma.lp_push_logs.create({ data: { id: randomUUID(), lead_id: lead.id, university_id: university.id, rule_id: rule.id, flow_id: flowId, multi_flow_id: multiFlowId, matched_rule_ids: matchedRuleIds, status, http_status: httpStatus, request_payload: payload, response_body: responseBody, error } });
  return { universityId: university.id, status, httpStatus, error, matchedRuleIds };
}

export function buildAutomationPlan(rules, lead) {
  const matchedRules = [...rules]
    .filter((rule) => ruleMatches(rule, lead))
    .sort((left, right) => Number(left.priority ?? 100) - Number(right.priority ?? 100));
  const byUniversity = new Map();
  for (const rule of matchedRules) {
    for (const universityId of list(rule.university_ids)) {
      const current = byUniversity.get(universityId);
      if (current) current.rules.push(rule);
      else byUniversity.set(universityId, { universityId, primaryRule: rule, rules: [rule] });
    }
  }
  return { matchedRules, deliveries: [...byUniversity.values()] };
}

export function buildAutomationPreview(plan, universities, lead) {
  const universityMap = new Map(universities.map((university) => [university.id, university]));
  return plan.deliveries.flatMap((delivery) => {
    const university = universityMap.get(delivery.universityId);
    if (!university) return [];
    return [{
      university_id: university.id,
      university: university.name,
      rule: delivery.primaryRule.name,
      matched_rule_ids: delivery.rules.map((rule) => rule.id),
      matched_rules: delivery.rules.map((rule) => rule.name),
      overrides: getPrefillOverrides(delivery.primaryRule, university.id, lead),
      deduplicated: delivery.rules.length > 1,
    }];
  });
}

async function loadAutomationPlan(lead) {
  if (!isLeadReadyForAutomation(lead)) return { plan: buildAutomationPlan([], lead || {}), activeFlows: [], multiFlows: [] };
  const [directRules, flows, multiFlows] = await Promise.all([
    prisma.lp_automation_rules.findMany({ where: { is_active: true, auto_dispatch: true }, orderBy: { priority: "asc" } }),
    prisma.lp_marketing_flows.findMany({ where: { is_active: true } }),
    prisma.lp_multi_flows.findMany({ where: { is_active: true, trigger_event: "lead_insert" } }),
  ]);
  const activeFlowIds = new Set(multiFlows.flatMap((item) => list(item.flow_ids)));
  const activeFlows = flows.filter((flow) => activeFlowIds.has(flow.id));
  const flowRuleIds = new Set(activeFlows.flatMap((flow) => list(flow.rule_ids)));
  const flowRules = flowRuleIds.size ? await prisma.lp_automation_rules.findMany({ where: { id: { in: [...flowRuleIds] }, is_active: true } }) : [];
  const plan = buildAutomationPlan([...new Map([...directRules, ...flowRules].map((rule) => [rule.id, rule])).values()], lead);
  return { plan, activeFlows, multiFlows };
}

export async function previewLeadAutomation(lead) {
  if (!isLeadReadyForAutomation(lead)) return { dispatched: 0, reason: "Add city, state and course to preview routing", matchedRules: [], results: [] };
  const { plan } = await loadAutomationPlan(lead);
  const universityIds = plan.deliveries.map((delivery) => delivery.universityId);
  const universities = universityIds.length
    ? await prisma.universities.findMany({ where: { id: { in: universityIds }, is_active: true } })
    : [];
  const results = buildAutomationPreview(plan, universities, lead);
  return {
    dispatched: results.length,
    matchedRuleIds: plan.matchedRules.map((rule) => rule.id),
    matchedRules: plan.matchedRules.map((rule) => ({ id: rule.id, name: rule.name, priority: rule.priority })),
    results,
  };
}

export async function dispatchLead(leadId) {
  const lead = await prisma.leads.findUnique({ where: { id: leadId } });
  if (!isLeadReadyForAutomation(lead)) return { dispatched: 0, reason: "lead incomplete" };
  const { plan, activeFlows, multiFlows } = await loadAutomationPlan(lead);
  if (!plan.deliveries.length) return { dispatched: 0, reason: "no rules matched", matchedRuleIds: plan.matchedRules.map((rule) => rule.id) };
  const deliveryByUniversity = new Map(plan.deliveries.map((delivery) => [delivery.universityId, delivery]));
  const universityIds = [...deliveryByUniversity.keys()];
  const minuteAgo = new Date(Date.now() - 60_000);
  const [universities, deliveredRows, recentRows] = await Promise.all([
    prisma.universities.findMany({ where: { id: { in: universityIds }, is_active: true } }),
    prisma.lp_push_logs.findMany({
      where: { lead_id: lead.id, university_id: { in: universityIds }, status: { in: ["Success", "Duplicate"] } },
      select: { university_id: true, status: true },
    }),
    prisma.lp_push_logs.groupBy({
      by: ["university_id"],
      where: { university_id: { in: universityIds }, created_at: { gt: minuteAgo } },
      _count: { _all: true },
    }),
  ]);
  const deliveredByUniversity = new Map(deliveredRows.map((row) => [row.university_id, row]));
  const recentByUniversity = new Map(recentRows.map((row) => [row.university_id, row._count._all]));
  const results = await Promise.all(universities.map(async (university) => {
    const delivery = deliveryByUniversity.get(university.id);
    const rule = { ...delivery.primaryRule, matched_rule_ids: delivery.rules.map((item) => item.id) };
    const flow = activeFlows.find((item) => list(item.rule_ids).includes(rule.id));
    const multi = multiFlows.find((item) => flow && list(item.flow_ids).includes(flow.id));
    const result = await sendToUniversity(university, lead, rule, flow?.id || null, multi?.id || null, {
      delivered: deliveredByUniversity.get(university.id),
      recentCount: recentByUniversity.get(university.id) || 0,
    });
    return {
      ...result,
      university: university.name,
      rule: delivery.primaryRule.name,
      matched_rules: delivery.rules.map((item) => item.name),
      deduplicated: delivery.rules.length > 1,
    };
  }));
  const retryable = results.filter((result) => ["Fail", "RateLimited"].includes(result.status));
  if (retryable.length) throw new Error(`Partner delivery pending for ${retryable.length} of ${results.length} universities`);
  return {
    dispatched: results.length,
    matchedRuleIds: plan.matchedRules.map((rule) => rule.id),
    matchedRules: plan.matchedRules.map((rule) => ({ id: rule.id, name: rule.name, priority: rule.priority })),
    results,
  };
}
