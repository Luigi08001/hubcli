import { CliError } from "../../core/output.js";

export type FormPayloadFormat = "auto" | "v2" | "v3";

const LEGAL_CONSENT_TYPES = new Set([
  "none",
  "legitimate_interest",
  "explicit_consent_to_process",
  "implicit_consent_to_process",
]);

const GROUP_TYPES = new Set(["default_group", "progressive", "queued"]);
const RICH_TEXT_TYPES = new Set(["text", "image"]);

const FIELD_TYPE_ALIASES: Record<string, string> = {
  booleancheckbox: "single_checkbox",
  checkbox: "multiple_checkboxes",
  date: "datepicker",
  datepicker: "datepicker",
  dropdown: "dropdown",
  email: "email",
  file: "file",
  mobile_phone: "mobile_phone",
  mobilephone: "mobile_phone",
  multi_line_text: "multi_line_text",
  multiple_checkboxes: "multiple_checkboxes",
  number: "number",
  payment_link_radio: "payment_link_radio",
  phone: "phone",
  phonenumber: "phone",
  radio: "radio",
  select: "dropdown",
  single_checkbox: "single_checkbox",
  single_line_text: "single_line_text",
  string: "single_line_text",
  text: "single_line_text",
  textarea: "multi_line_text",
};

const OPTION_FIELD_TYPES = new Set([
  "dropdown",
  "multiple_checkboxes",
  "payment_link_radio",
  "radio",
  "single_checkbox",
]);

const OBJECT_TYPE_IDS: Record<string, string> = {
  COMPANY: "0-2",
  CONTACT: "0-1",
  DEAL: "0-3",
  TICKET: "0-5",
};

const PROPERTY_ENDPOINT_OBJECT_TYPES: Record<string, string> = {
  "0-1": "contacts",
  "0-2": "companies",
  "0-3": "deals",
  "0-5": "tickets",
  COMPANY: "companies",
  CONTACT: "contacts",
  DEAL: "deals",
  TICKET: "tickets",
};

const MAX_FIELDS_PER_GROUP = 3;

export function parseFormPayloadFormat(raw: string | undefined): FormPayloadFormat {
  if (raw === undefined || raw === "auto") return "auto";
  if (raw === "v2" || raw === "v3") return raw;
  throw new CliError("INVALID_FLAG", "--source-format must be one of: auto, v2, v3");
}

export function normalizeFormPayloadForV3(
  input: Record<string, unknown>,
  format: FormPayloadFormat = "auto",
): Record<string, unknown> {
  if (format === "v3") return input;
  if (format === "auto" && !isLegacyFormV2Payload(input)) return input;
  return translateLegacyFormV2ToV3(input);
}

export function isLegacyFormV2Payload(input: Record<string, unknown>): boolean {
  return Array.isArray(input.formFieldGroups)
    || typeof input.submitText === "string"
    || typeof input.inlineMessage === "string"
    || typeof input.notifyRecipients === "string"
    || typeof input.guid === "string";
}

export function legacyFormFieldPropertyObjectType(field: Record<string, unknown>): string {
  const objectTypeId = stringValue(field.objectTypeId);
  if (objectTypeId) return PROPERTY_ENDPOINT_OBJECT_TYPES[objectTypeId] ?? objectTypeId;

  const propertyObjectType = stringValue(field.propertyObjectType)?.trim().toUpperCase();
  if (propertyObjectType) return PROPERTY_ENDPOINT_OBJECT_TYPES[propertyObjectType] ?? propertyObjectType.toLowerCase();

  return "contacts";
}

export function translateLegacyFormV2ToV3(input: Record<string, unknown>): Record<string, unknown> {
  const name = stringValue(input.name) ?? stringValue(input.title);
  if (!name) {
    throw new CliError("INVALID_FORM_PAYLOAD", "Legacy forms/v2 payload is missing a form name");
  }

  const fieldGroups = mapFieldGroups(input.formFieldGroups);
  if (fieldGroups.length === 0) {
    throw new CliError("INVALID_FORM_PAYLOAD", "Legacy forms/v2 payload contains no enabled fields to translate");
  }

  return cleanRecord({
    formType: "hubspot",
    name,
    createdAt: new Date().toISOString(),
    archived: false,
    fieldGroups,
    configuration: mapConfiguration(input),
    displayOptions: mapDisplayOptions(input),
    legalConsentOptions: mapLegalConsentOptions(input),
  });
}

function mapFieldGroups(rawGroups: unknown): Array<Record<string, unknown>> {
  const groups = records(rawGroups);
  return groups.flatMap((group) => {
    const fields = records(group.fields)
      .filter((field) => field.enabled !== false)
      .map(mapField)
      .filter((field): field is Record<string, unknown> => field !== undefined);

    const richText = stringValue(group.richText);
    if (fields.length === 0 && !richText) return undefined;

    const baseGroup = cleanRecord({
      groupType: mapGroupType(group),
      richTextType: mapRichTextType(group.richTextType),
      richText,
      fields: fields.slice(0, MAX_FIELDS_PER_GROUP),
    });
    if (fields.length <= MAX_FIELDS_PER_GROUP) return baseGroup;

    const splitGroups = [baseGroup];
    for (let start = MAX_FIELDS_PER_GROUP; start < fields.length; start += MAX_FIELDS_PER_GROUP) {
      splitGroups.push(cleanRecord({
        groupType: mapGroupType(group),
        richTextType: mapRichTextType(group.richTextType),
        fields: fields.slice(start, start + MAX_FIELDS_PER_GROUP),
      }));
    }
    return splitGroups;
  }).filter((group): group is Record<string, unknown> => group !== undefined);
}

function mapField(field: Record<string, unknown>): Record<string, unknown> | undefined {
  const name = stringValue(field.name);
  if (!name) return undefined;

  const fieldType = mapFieldType(field);
  const hidden = booleanValue(field.hidden, false);
  const translated = cleanRecord({
    objectTypeId: mapObjectTypeId(field),
    name,
    label: stringValue(field.label) ?? name,
    required: hidden ? false : booleanValue(field.required, false),
    hidden,
    fieldType,
    defaultValue: mapDefaultValue(field, fieldType),
    description: stringValue(field.description),
    placeholder: stringValue(field.placeholder),
    validation: mapValidation(field, fieldType),
    useCountryCodeSelect: fieldType === "phone" || fieldType === "mobile_phone"
      ? booleanValue(field.useCountryCodeSelect, true)
      : undefined,
  });

  if (OPTION_FIELD_TYPES.has(fieldType)) {
    const options = mapOptions(field.options);
    if (options.length > 0) translated.options = options;
  }

  return translated;
}

function mapFieldType(field: Record<string, unknown>): string {
  const raw = (stringValue(field.fieldType) ?? stringValue(field.type) ?? "").trim().toLowerCase();
  const fromAlias = FIELD_TYPE_ALIASES[raw];
  if (fromAlias) return fromAlias;

  const name = (stringValue(field.name) ?? "").toLowerCase();
  if (name === "email" || name.endsWith("_email")) return "email";
  if (name.includes("mobile")) return "mobile_phone";
  if (name.includes("phone")) return "phone";
  return "single_line_text";
}

function mapObjectTypeId(field: Record<string, unknown>): string {
  const objectTypeId = stringValue(field.objectTypeId);
  if (objectTypeId) return objectTypeId;

  const propertyObjectType = stringValue(field.propertyObjectType)?.trim().toUpperCase();
  if (propertyObjectType && OBJECT_TYPE_IDS[propertyObjectType]) return OBJECT_TYPE_IDS[propertyObjectType];

  return "0-1";
}

function mapOptions(rawOptions: unknown): Array<Record<string, unknown>> {
  return records(rawOptions).map((option, index) => {
    const value = stringValue(option.value) ?? stringValue(option.internalName) ?? stringValue(option.label);
    const label = stringValue(option.label) ?? value;
    if (!value || !label) return undefined;
    return cleanRecord({
      label,
      value,
      description: stringValue(option.description) ?? "",
      displayOrder: numberValue(option.displayOrder) ?? index,
    });
  }).filter((option): option is Record<string, unknown> => option !== undefined);
}

function mapDefaultValue(field: Record<string, unknown>, fieldType: string): string | undefined {
  const explicit = stringValue(field.defaultValue);
  if (explicit !== undefined) return explicit;

  const selectedOptions = strings(field.selectedOptions);
  if (selectedOptions.length === 0) return undefined;
  if (fieldType === "multiple_checkboxes") return selectedOptions.join(";");
  return selectedOptions[0];
}

function mapValidation(field: Record<string, unknown>, fieldType: string): Record<string, unknown> | undefined {
  const validation = record(field.validation) ?? {};
  if (fieldType === "email") {
    return {
      blockedEmailDomains: mapBlockedEmailDomains(validation),
      useDefaultBlockList: booleanValue(validation.useDefaultBlockList, false),
    };
  }
  if (fieldType === "phone" || fieldType === "mobile_phone") {
    return cleanRecord({
      minAllowedDigits: numberValue(validation.minAllowedDigits) ?? 7,
      maxAllowedDigits: numberValue(validation.maxAllowedDigits) ?? 20,
    });
  }
  return undefined;
}

function mapBlockedEmailDomains(validation: Record<string, unknown>): string[] {
  const values = [
    ...strings(validation.blockedEmailDomains),
    ...strings(validation.blockedEmailAddresses),
  ];
  return [...new Set(values.map((value) => {
    const trimmed = value.trim().toLowerCase();
    const atIndex = trimmed.lastIndexOf("@");
    return atIndex >= 0 ? trimmed.slice(atIndex + 1) : trimmed;
  }).filter(Boolean))];
}

function mapGroupType(group: Record<string, unknown>): string {
  const groupType = stringValue(group.groupType);
  if (groupType && GROUP_TYPES.has(groupType)) return groupType;
  if (group.isSmartGroup === true || group.progressive === true) return "progressive";
  if (group.queued === true || group.queuedFields === true) return "queued";
  return "default_group";
}

function mapRichTextType(raw: unknown): string {
  const value = stringValue(raw);
  if (value && RICH_TEXT_TYPES.has(value)) return value;
  return "text";
}

function mapConfiguration(input: Record<string, unknown>): Record<string, unknown> {
  return cleanRecord({
    allowLinkToResetKnownValues: booleanValue(input.allowLinkToResetKnownValues, false),
    archivable: booleanValue(input.archivable, true),
    cloneable: booleanValue(input.cloneable, true),
    createNewContactForNewEmail: booleanValue(input.createNewContactForNewEmail, true),
    editable: booleanValue(input.editable, true),
    language: stringValue(input.language) ?? "en",
    notifyContactOwner: booleanValue(input.notifyContactOwner, false),
    notifyRecipients: parseRecipients(input.notifyRecipients),
    postSubmitAction: mapPostSubmitAction(input),
    prePopulateKnownValues: booleanValue(input.prePopulateKnownValues, true),
    recaptchaEnabled: booleanValue(input.recaptchaEnabled, booleanValue(input.captchaEnabled, false)),
    embedType: "V3",
  });
}

function mapPostSubmitAction(input: Record<string, unknown>): Record<string, unknown> {
  const redirect = stringValue(input.redirect) ?? stringValue(input.redirectUrl);
  if (redirect) return { type: "redirect_url", value: redirect };

  const message = stringValue(input.inlineMessage)
    ?? stringValue(input.thankYouMessage)
    ?? "Thanks for submitting the form.";
  return { type: "thank_you", value: message };
}

function mapDisplayOptions(input: Record<string, unknown>): Record<string, unknown> {
  return cleanRecord({
    renderRawHtml: booleanValue(input.renderRawHtml, false),
    submitButtonText: stringValue(input.submitText) ?? "Submit",
    theme: stringValue(input.theme) ?? "canvas",
    cssClass: stringValue(input.cssClass),
  });
}

function mapLegalConsentOptions(input: Record<string, unknown>): Record<string, unknown> {
  const legacy = record(input.legalConsentOptions);
  const type = stringValue(legacy?.type);
  if (legacy && type && LEGAL_CONSENT_TYPES.has(type)) return legacy;
  return { type: "none" };
}

function parseRecipients(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  const value = stringValue(raw);
  if (!value) return [];
  return value.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
}

function records(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(record);
}

function strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value).trim()).filter(Boolean);
}

function record(raw: unknown): Record<string, unknown> | undefined {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return undefined;
}

function stringValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value ? value : undefined;
}

function booleanValue(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    if (raw.toLowerCase() === "true") return true;
    if (raw.toLowerCase() === "false") return false;
  }
  return fallback;
}

function numberValue(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function cleanRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
