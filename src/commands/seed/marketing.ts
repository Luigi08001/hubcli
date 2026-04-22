import { errorReason, futureDate, nowIso, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/** Form, campaign, static list, custom property + group, marketing email draft, file import. */
export async function seedMarketing(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, runSuffix } = ctx;

  // --- Marketing Form (discover an active subscription type first) ---
  try {
    let subTypeId: number | undefined;
    try {
      const defs = await client.request("/communication-preferences/v3/definitions") as { subscriptionDefinitions?: Array<{ id?: string | number; active?: boolean }> };
      const activeSub = defs.subscriptionDefinitions?.find(s => s.active !== false);
      if (activeSub?.id) subTypeId = Number(activeSub.id);
    } catch { /* no subs */ }

    if (subTypeId) {
      const formName = `HubCLI Seed Contact Form ${runSuffix}`;
      const now = nowIso();
      const rec = await safeCreate(client, "/marketing/v3/forms/", {
        name: formName,
        formType: "hubspot",
        archived: false,
        createdAt: now,
        updatedAt: now,
        fieldGroups: [{
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { objectTypeId: "0-1", name: "email", label: "Email", required: true, hidden: false, fieldType: "email", validation: { blockedEmailDomains: [], useDefaultBlockList: false } },
            { objectTypeId: "0-1", name: "firstname", label: "First name", required: false, hidden: false, fieldType: "single_line_text" },
          ],
        }],
        configuration: {
          allowLinkToResetForEditors: false, archivable: true, cloneable: true,
          createNewContactForNewEmail: true, editable: true, language: "en",
          notifyContactOwner: false, notifyRecipients: [],
          postSubmitAction: { type: "thank_you", value: "Thanks!" },
          recaptchaEnabled: false, prePopulateKnownValues: false,
        },
        displayOptions: { renderRawHtml: false, theme: "default_style", submitButtonText: "Submit" },
        legalConsentOptions: {
          type: "legitimate_interest",
          lawfulBasis: "lead",
          privacyText: "HubCLI seed test form — not for production use.",
          subscriptionTypeIds: [subTypeId],
        },
      });
      if (rec) result.created.push({ type: "form", name: formName, id: rec.id });
    } else {
      result.skipped.push({ type: "form", name: "HubCLI Seed Form", reason: "no active subscription type on portal" });
    }
  } catch (err) {
    result.skipped.push({ type: "form", name: "HubCLI Seed Form", reason: errorReason(err) });
  }

  // --- Marketing campaign ---
  try {
    const rec = await safeCreate(client, "/marketing/v3/campaigns", {
      properties: {
        hs_name: `HubCLI Seed Campaign ${runSuffix}`,
        hs_start_date: new Date().toISOString().split("T")[0],
        hs_end_date: futureDate(60),
      },
    });
    if (rec) result.created.push({ type: "campaign", name: `HubCLI Seed Campaign ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "campaign", name: "HubCLI Seed Campaign", reason: `${errorReason(err)} (needs Marketing Hub Starter+)` });
  }

  // --- Static contact list ---
  try {
    const listName = `HubCLI Seed — Sample Contacts ${runSuffix}`;
    const rec = await safeCreate(client, "/crm/v3/lists", {
      name: listName,
      processingType: "MANUAL",
      objectTypeId: "0-1",
    });
    if (rec) {
      result.created.push({ type: "list", name: listName, id: rec.id });
      const validContacts = ctx.contactIds.filter((c): c is string => Boolean(c));
      if (validContacts.length > 0) {
        try {
          await client.request(`/crm/v3/lists/${rec.id}/memberships/add`, { method: "PUT", body: validContacts });
          result.associations.push({ from: `list:${rec.id}`, to: `contacts:${validContacts.length}`, status: "ok" });
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    result.skipped.push({ type: "list", name: "HubCLI Seed List", reason: errorReason(err) });
  }

  // --- Custom property group + property on contacts ---
  try {
    const rec = await safeCreate(client, "/crm/v3/properties/contacts/groups", {
      name: "hscli_seed_group",
      label: "HubCLI Seed",
      displayOrder: -1,
    });
    if (rec) result.created.push({ type: "property_group", name: "hscli_seed_group", id: "hscli_seed_group" });
  } catch (err) {
    result.skipped.push({ type: "property_group", name: "hscli_seed_group", reason: errorReason(err) });
  }
  try {
    const rec = await safeCreate(client, "/crm/v3/properties/contacts", {
      name: "hscli_seed_tag",
      label: "HubCLI Seed Tag",
      type: "string",
      fieldType: "text",
      groupName: "hscli_seed_group",
      description: "Tag set by hscli seed command for testing.",
    });
    if (rec) result.created.push({ type: "property", name: "hscli_seed_tag", id: "hscli_seed_tag" });
  } catch (err) {
    result.skipped.push({ type: "property", name: "hscli_seed_tag", reason: errorReason(err) });
  }

  // --- Marketing email (draft) ---
  try {
    const mktgEmailName = `HubCLI Seed Email ${runSuffix}`;
    const rec = await safeCreate(client, "/marketing/v3/emails/", {
      name: mktgEmailName,
      subject: "Test from HubCLI seed",
      language: "en",
      subcategory: "batch",
      sendOnPublish: false,
      useRssHeadlineAsSubject: false,
      content: { html: "<p>Test content from hscli seed.</p>" },
      subscriptionDetails: { subscriptionId: 0 },
    });
    if (rec) result.created.push({ type: "marketing_email", name: mktgEmailName, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "marketing_email", name: "HubCLI Seed Email", reason: errorReason(err) });
  }

  // --- File upload via URL import ---
  try {
    const rec = await client.request("/files/v3/files/import-from-url/async", {
      method: "POST",
      body: {
        access: "PUBLIC_NOT_INDEXABLE",
        name: `hscli-seed-${runSuffix}.ico`,
        url: "https://www.hubspot.com/favicon.ico",
        folderPath: "/hscli-seed",
      },
    }) as { id?: string };
    if (rec?.id) result.created.push({ type: "file_import_task", name: `hscli-seed-${runSuffix}.ico`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "file_import_task", name: "hscli-seed file", reason: errorReason(err) });
  }

  // --- Transactional SMTP token (Marketing Hub Pro+; expected fail on Free) ---
  try {
    const rec = await safeCreate(client, "/marketing/v3/transactional/smtp-tokens", {
      createContact: false,
      campaignName: `HubCLI Seed ${runSuffix}`,
    });
    if (rec) result.created.push({ type: "smtp_token", name: `HubCLI Seed Campaign ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "smtp_token", name: "HubCLI Seed Campaign", reason: errorReason(err) });
  }
}
