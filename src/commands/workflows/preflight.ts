import type { Command } from "commander";
import {
  findPipelineStageTarget,
  isStandardObjectTypeId,
  loadMigrationIdMaps,
  stringifyId,
  type FlatIdMap,
  type MigrationIdMaps,
} from "../../core/id-maps.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { parseJsonPayload } from "../crm/shared.js";

export interface WorkflowRefFinding {
  path: string;
  kind: string;
  source: unknown;
  message: string;
}

export interface WorkflowPreflightWorkflow {
  id?: string;
  name?: string;
  brokenRefs: WorkflowRefFinding[];
  warnings: WorkflowRefFinding[];
}

export interface WorkflowPreflightResult {
  ok: boolean;
  total: number;
  brokenRefCount: number;
  warningCount: number;
  workflows: WorkflowPreflightWorkflow[];
}

const EMPTY_MAPS: MigrationIdMaps = {
  subscriptionTypes: {},
  businessUnits: {},
  emails: {},
  lists: {},
  campaigns: {},
  workflows: {},
  users: {},
  owners: {},
  sequences: {},
  customObjects: {},
  associations: {},
  pipelines: {},
};

const UNKNOWN_ID_KEY = /(?:^|[_-])(?:id|ids)$|(?:Id|Ids)$/;
const SAFE_ID_KEYS = new Set([
  "id",
  "guid",
  "actionId",
  "actionTypeId",
  "portalId",
  "revisionId",
  "createdAt",
  "updatedAt",
]);

export function registerWorkflowPreflight(workflows: Command, getCtx: () => CliContext): void {
  workflows
    .command("preflight")
    .description("Check a workflow export for source-portal IDs before replay")
    .requiredOption("--data <payload>", "Workflow JSON payload, array, or { results|workflows }")
    .option("--id-map-dir <dir>", "Directory containing migration id-map JSON files")
    .option("--strict", "Exit non-zero when broken references are found")
    .action(async (opts) => {
      const ctx = getCtx();
      const result = preflightWorkflowsPayload(parseJsonPayload(opts.data), opts.idMapDir);
      if (opts.strict && !result.ok) {
        throw new CliError(
          "WORKFLOW_PREFLIGHT_BROKEN_REFS",
          `Workflow preflight found ${result.brokenRefCount} unresolved source references`,
          undefined,
          result,
        );
      }
      printResult(ctx, result);
    });
}

export function preflightWorkflowsPayload(input: unknown, idMapDir?: string): WorkflowPreflightResult {
  const maps = idMapDir ? loadMigrationIdMaps(idMapDir) : EMPTY_MAPS;
  const workflows = normalizeWorkflows(input);
  const checked: WorkflowPreflightWorkflow[] = workflows.map((workflow, index) => inspectWorkflow(workflow, maps, index));
  const brokenRefCount = checked.reduce((sum, workflow) => sum + workflow.brokenRefs.length, 0);
  const warningCount = checked.reduce((sum, workflow) => sum + workflow.warnings.length, 0);
  return {
    ok: brokenRefCount === 0,
    total: checked.length,
    brokenRefCount,
    warningCount,
    workflows: checked,
  };
}

function inspectWorkflow(
  workflow: Record<string, unknown>,
  maps: MigrationIdMaps,
  index: number,
): WorkflowPreflightWorkflow {
  const brokenRefs: WorkflowRefFinding[] = [];
  const warnings: WorkflowRefFinding[] = [];
  const seenPaths = new Set<string>();

  const actions = records(workflow.actions);
  actions.forEach((action, actionIndex) => {
    const basePath = `workflows[${index}].actions[${actionIndex}]`;
    inspectKnownRefs(action, basePath, maps, brokenRefs, seenPaths);
    inspectPropertyValueRefs(action, basePath, maps, brokenRefs, seenPaths);
    inspectUnknownIdFields(action, basePath, brokenRefs, seenPaths);
  });

  const enrollmentCriteria = record(workflow.enrollmentCriteria);
  if (enrollmentCriteria) {
    inspectKnownRefs(enrollmentCriteria, `workflows[${index}].enrollmentCriteria`, maps, brokenRefs, seenPaths);
    inspectPropertyValueRefs(enrollmentCriteria, `workflows[${index}].enrollmentCriteria`, maps, brokenRefs, seenPaths);
  }

  const suppressionListIds = Array.isArray(workflow.suppressionListIds) ? workflow.suppressionListIds : [];
  suppressionListIds.forEach((source, listIndex) => {
    checkMapped(
      maps.lists,
      source,
      "suppressionList",
      `workflows[${index}].suppressionListIds[${listIndex}]`,
      brokenRefs,
      seenPaths,
    );
  });

  return {
    id: stringifyId(workflow.id),
    name: typeof workflow.name === "string" ? workflow.name : undefined,
    brokenRefs,
    warnings,
  };
}

function inspectKnownRefs(
  value: unknown,
  path: string,
  maps: MigrationIdMaps,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectKnownRefs(item, `${path}[${index}]`, maps, brokenRefs, seenPaths));
    return;
  }
  const node = record(value);
  if (!node) return;

  for (const [key, raw] of Object.entries(node)) {
    const keyPath = `${path}.${key}`;
    if (raw === undefined || raw === null) continue;

    if (["content_id", "email_content_id", "emailContentId", "emailId"].includes(key)) {
      checkMapped(maps.emails, raw, "marketingEmail", keyPath, brokenRefs, seenPaths);
    } else if (["subscriptionId", "subscriptionTypeId", "subscription_type_id"].includes(key)) {
      checkMapped(maps.subscriptionTypes, raw, "subscriptionType", keyPath, brokenRefs, seenPaths);
    } else if (["listId", "list_id", "staticListId"].includes(key)) {
      checkMapped(maps.lists, raw, "list", keyPath, brokenRefs, seenPaths);
    } else if (["campaignId", "campaign_id"].includes(key)) {
      checkMapped(maps.campaigns, raw, "campaign", keyPath, brokenRefs, seenPaths);
    } else if (["flow_id", "workflowId", "workflow_id"].includes(key)) {
      checkMapped(maps.workflows, raw, "workflow", keyPath, brokenRefs, seenPaths);
    } else if (["userId", "user_id"].includes(key)) {
      checkAnyMapped([maps.users, maps.owners], raw, "user", keyPath, brokenRefs, seenPaths);
    } else if (["sequenceId", "sequence_id"].includes(key)) {
      checkMapped(maps.sequences, raw, "sequence", keyPath, brokenRefs, seenPaths);
    } else if (["object_type_id", "objectTypeId", "fromObjectType", "toObjectType"].includes(key)) {
      checkCustomObjectMapped(maps.customObjects, raw, keyPath, brokenRefs, seenPaths);
    } else if (["labelToApply", "associationTypeId", "association_label_id"].includes(key)) {
      checkMapped(maps.associations, raw, "associationLabel", keyPath, brokenRefs, seenPaths);
    } else if (["pipelineId", "pipeline_id"].includes(key)) {
      checkPipelineMapped(maps, raw, keyPath, brokenRefs, seenPaths);
    } else if (["stageId", "stage_id"].includes(key)) {
      checkStageMapped(maps, raw, keyPath, brokenRefs, seenPaths);
    }

    inspectKnownRefs(raw, keyPath, maps, brokenRefs, seenPaths);
  }
}

function inspectPropertyValueRefs(
  value: unknown,
  path: string,
  maps: MigrationIdMaps,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPropertyValueRefs(item, `${path}[${index}]`, maps, brokenRefs, seenPaths));
    return;
  }
  const node = record(value);
  if (!node) return;

  const propertyName = stringField(node, "propertyName")
    ?? stringField(node, "targetProperty")
    ?? stringField(node, "property")
    ?? stringField(node, "name");
  const rawValue = node.staticValue ?? node.value ?? node.values;
  if (propertyName && rawValue !== undefined) {
    const normalized = propertyName.toLowerCase();
    if (normalized === "pipeline" || normalized === "hs_pipeline") {
      checkPipelineMapped(maps, rawValue, `${path}.value`, brokenRefs, seenPaths);
    }
    if (normalized === "dealstage" || normalized === "hs_pipeline_stage" || normalized === "ticketstage") {
      checkStageMapped(maps, rawValue, `${path}.value`, brokenRefs, seenPaths);
    }
  }

  for (const [key, raw] of Object.entries(node)) {
    inspectPropertyValueRefs(raw, `${path}.${key}`, maps, brokenRefs, seenPaths);
  }
}

function inspectUnknownIdFields(
  value: unknown,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectUnknownIdFields(item, `${path}[${index}]`, brokenRefs, seenPaths));
    return;
  }
  const node = record(value);
  if (!node) return;

  for (const [key, raw] of Object.entries(node)) {
    const keyPath = `${path}.${key}`;
    if (!seenPaths.has(keyPath) && UNKNOWN_ID_KEY.test(key) && !SAFE_ID_KEYS.has(key) && hasIdLikeValue(raw)) {
      seenPaths.add(keyPath);
      brokenRefs.push({
        path: keyPath,
        kind: "unknown-id-field",
        source: raw,
        message: `Potential source ID field '${key}' has no explicit workflow remapper`,
      });
    }
    inspectUnknownIdFields(raw, keyPath, brokenRefs, seenPaths);
  }
}

function checkMapped(
  map: FlatIdMap,
  source: unknown,
  kind: string,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  const values = idValues(source);
  if (values.length === 0) return;
  seenPaths.add(path);
  values.forEach((value, index) => {
    if (map[value] !== undefined) return;
    brokenRefs.push({
      path: values.length > 1 ? `${path}[${index}]` : path,
      kind,
      source: value,
      message: `No target ${kind} mapping found for source ID ${value}`,
    });
  });
}

function checkAnyMapped(
  maps: FlatIdMap[],
  source: unknown,
  kind: string,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  const values = idValues(source);
  if (values.length === 0) return;
  seenPaths.add(path);
  values.forEach((value, index) => {
    if (maps.some((map) => map[value] !== undefined)) return;
    brokenRefs.push({
      path: values.length > 1 ? `${path}[${index}]` : path,
      kind,
      source: value,
      message: `No target ${kind} mapping found for source ID ${value}`,
    });
  });
}

function checkCustomObjectMapped(
  map: FlatIdMap,
  source: unknown,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  const value = stringifyId(source);
  if (!value || isStandardObjectTypeId(value)) return;
  checkMapped(map, value, "customObject", path, brokenRefs, seenPaths);
}

function checkPipelineMapped(
  maps: MigrationIdMaps,
  source: unknown,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  const values = idValues(source);
  if (values.length === 0) return;
  seenPaths.add(path);
  values.forEach((value, index) => {
    const found = Object.keys(maps.pipelines).includes(value);
    if (found) return;
    brokenRefs.push({
      path: values.length > 1 ? `${path}[${index}]` : path,
      kind: "pipeline",
      source: value,
      message: `No target pipeline mapping found for source ID ${value}`,
    });
  });
}

function checkStageMapped(
  maps: MigrationIdMaps,
  source: unknown,
  path: string,
  brokenRefs: WorkflowRefFinding[],
  seenPaths: Set<string>,
): void {
  const values = idValues(source);
  if (values.length === 0) return;
  seenPaths.add(path);
  values.forEach((value, index) => {
    if (findPipelineStageTarget(maps.pipelines, value) !== undefined) return;
    brokenRefs.push({
      path: values.length > 1 ? `${path}[${index}]` : path,
      kind: "pipelineStage",
      source: value,
      message: `No target pipeline-stage mapping found for source ID ${value}`,
    });
  });
}

function normalizeWorkflows(input: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(input)) return input.filter(record);
  const root = record(input);
  if (!root) return [];
  for (const key of ["results", "workflows", "flows"]) {
    const candidate = root[key];
    if (Array.isArray(candidate)) return candidate.filter(record);
  }
  return [root];
}

function idValues(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(stringifyId).filter((value): value is string => value !== undefined);
  const value = stringifyId(raw);
  return value ? [value] : [];
}

function hasIdLikeValue(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.some(hasIdLikeValue);
  return stringifyId(raw) !== undefined;
}

function records(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(record);
}

function record(raw: unknown): Record<string, unknown> | undefined {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
