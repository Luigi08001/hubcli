import { CALLS, MEETINGS, NOTES, TASKS } from "./data.js";
import { nowIso, safeAssociate, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/** Notes, tasks, calls, meetings — each associated to a contact. */
export async function seedEngagements(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, ownerId } = ctx;

  const engagementTypes = [
    {
      type: "note", path: "/crm/v3/objects/notes",
      items: NOTES.map(n => ({
        props: { hs_note_body: n.hs_note_body, hs_timestamp: nowIso() },
        contactIndex: n.contactIndex,
      })),
    },
    {
      type: "task", path: "/crm/v3/objects/tasks",
      items: TASKS.map(t => ({
        props: {
          hs_task_subject: t.hs_task_subject,
          hs_task_body: t.hs_task_body,
          hs_task_status: t.hs_task_status,
          hs_task_priority: t.hs_task_priority,
          hs_timestamp: nowIso(),
        },
        contactIndex: t.contactIndex,
      })),
    },
    {
      type: "call", path: "/crm/v3/objects/calls",
      items: CALLS.map(c => ({
        props: {
          hs_call_title: c.hs_call_title,
          hs_call_body: c.hs_call_body,
          hs_call_direction: c.hs_call_direction,
          hs_call_duration: c.hs_call_duration,
          hs_call_status: "COMPLETED",
          hs_timestamp: nowIso(),
        },
        contactIndex: c.contactIndex,
      })),
    },
  ];

  for (const eng of engagementTypes) {
    for (const item of eng.items) {
      const props: Record<string, string> = { ...item.props };
      if (ownerId) props.hubspot_owner_id = ownerId;
      const rec = await safeCreate(client, eng.path, { properties: props });
      if (rec) {
        result.created.push({
          type: eng.type,
          name: props.hs_note_body || props.hs_task_subject || props.hs_call_title || eng.type,
          id: rec.id,
        });
        const contactId = ctx.contactIds[item.contactIndex];
        if (contactId) {
          const plural = eng.type === "call" ? "calls" : eng.type + "s";
          const status = await safeAssociate(client, plural, rec.id, "contacts", contactId);
          result.associations.push({ from: `${eng.type}:${rec.id}`, to: `contact:${contactId}`, status });
        }
      }
    }
  }

  // Meetings (dedicated — use MEETINGS data)
  for (const m of MEETINGS) {
    const props: Record<string, string> = {
      hs_meeting_title: m.hs_meeting_title,
      hs_meeting_body: m.hs_meeting_body,
      hs_meeting_outcome: m.hs_meeting_outcome,
      hs_meeting_start_time: m.hs_meeting_start_time,
      hs_meeting_end_time: m.hs_meeting_end_time,
      hs_timestamp: nowIso(),
    };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/meetings", { properties: props });
    if (rec) {
      result.created.push({ type: "meeting", name: m.hs_meeting_title, id: rec.id });
      const contactId = ctx.contactIds[m.contactIndex];
      if (contactId) {
        const status = await safeAssociate(client, "meetings", rec.id, "contacts", contactId);
        result.associations.push({ from: `meeting:${rec.id}`, to: `contact:${contactId}`, status });
      }
    } else {
      result.skipped.push({ type: "meeting", name: m.hs_meeting_title, reason: "create failed" });
    }
  }
}
