import fs from "node:fs";

const file = process.argv[2];
if (!file) fail("Usage: node scripts/validate-coaching-workout.mjs <current-workout.js>");
let source;
try { source = fs.readFileSync(file, "utf8"); } catch (error) { fail(`Cannot read ${file}: ${error.message}`); }
if (/\bTODO\b/i.test(source)) fail("Workout definition contains an obvious placeholder value (TODO).");

// Deliberately parse a small data-only JavaScript subset. Candidate code is never evaluated.
const assignment = source.match(/^\s*window\.CURRENT_WORKOUT\s*=\s*/m);
if (!assignment) fail("window.CURRENT_WORKOUT assignment is missing.");
const input = source.slice(assignment.index + assignment[0].length);
let position = 0;
const ws = () => { while (/\s/.test(input[position] || "")) position++; };
const error = (message) => { throw new Error(`${message} at character ${position + 1}`); };
function string() { const quote = input[position++]; let out = ""; while (position < input.length && input[position] !== quote) { if (input[position] === "\\") { position++; const c = input[position++]; const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" }; out += c === "u" ? String.fromCharCode(Number.parseInt(input.slice(position, position += 4), 16)) : (map[c] ?? c); } else out += input[position++]; } if (input[position++] !== quote) error("Unterminated string"); return out; }
function identifier() { const match = input.slice(position).match(/^[A-Za-z_$][\w$-]*/); if (!match) error("Expected identifier"); position += match[0].length; return match[0]; }
function value() { ws(); const c = input[position]; if (c === "\"" || c === "'") return string(); if (c === "{") return object(); if (c === "[") return array(); const rest = input.slice(position); const number = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/); if (number) { position += number[0].length; return Number(number[0]); } const word = identifier(); if (word === "true") return true; if (word === "false") return false; if (word === "null") return null; error(`Unsupported value '${word}'`); }
function object() { const out = {}; position++; ws(); while (input[position] !== "}") { const key = input[position] === "\"" || input[position] === "'" ? string() : identifier(); ws(); if (input[position++] !== ":") error("Expected ':'"); out[key] = value(); ws(); if (input[position] === ",") { position++; ws(); if (input[position] === "}") break; } else if (input[position] !== "}") error("Expected ',' or '}'"); } position++; return out; }
function array() { const out = []; position++; ws(); while (input[position] !== "]") { out.push(value()); ws(); if (input[position] === ",") { position++; ws(); if (input[position] === "]") break; } else if (input[position] !== "]") error("Expected ',' or ']'"); } position++; return out; }
let workout;
try { workout = value(); ws(); if (input[position] === ";") position++; ws(); if (position !== input.length) error("Only a data assignment is allowed after the workout object"); } catch (e) { fail(`Unsafe or invalid workout definition: ${e.message}`); }

const problems = [];
const required = (name) => { if (!workout[name] || (Array.isArray(workout[name]) && !workout[name].length)) problems.push(`Missing required ${name}.`); };
if (workout.schemaVersion !== 1) problems.push("schemaVersion must be 1.");
["id", "title", "purpose", "steps"].forEach(required);
if (workout.durationMinutes !== 45) problems.push("durationMinutes must equal 45.");
if (!workout.safetySummary || !String(workout.safetySummary).trim()) problems.push("Required safetySummary text is missing.");
const ids = new Set();
let previousEnd = -1;
(workout.steps || []).forEach((step, index) => {
  const label = `Step ${index + 1}`;
  if (!step.id) problems.push(`${label} is missing an id.`); else if (ids.has(step.id)) problems.push(`${label} has duplicate id '${step.id}'.`); else ids.add(step.id);
  if (!step.name) problems.push(`${label} is missing a name.`);
  if (!Number.isFinite(step.startMinute) || !Number.isFinite(step.endMinute)) problems.push(`${label} has invalid startMinute or endMinute.`);
  else { if (step.endMinute < step.startMinute) problems.push(`${label} ends before it starts.`); if (step.startMinute < previousEnd) problems.push(`${label} is not in chronological order.`); previousEnd = step.endMinute; }
  if (!Array.isArray(step.setPlan)) problems.push(`${label} setPlan must be an array.`);
});
if (workout.steps?.[0]?.startMinute !== 0) problems.push("The first step must begin at minute 0.");
if (workout.steps?.at(-1)?.endMinute !== 45) problems.push("The final step must end at minute 45.");
if (problems.length) fail(problems.join("\n"));
console.log(`Valid workout: ${workout.id} (${workout.steps.length} steps, 45 minutes)`);

function fail(message) { console.error(`Validation failed: ${message}`); process.exit(1); }
