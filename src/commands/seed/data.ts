// Sample records + config used by the seed command. Kept data-only (no logic)
// so reviewers can edit the seed dataset without touching orchestration code.

export const CONTACTS = [
  { firstname: "Alice", lastname: "Martin", email: "alice.martin@acmetech.io", jobtitle: "VP of Engineering", lifecyclestage: "opportunity" },
  { firstname: "Bob", lastname: "Chen", email: "bob.chen@globalsync.co", jobtitle: "CTO", lifecyclestage: "lead" },
  { firstname: "Clara", lastname: "Johansson", email: "clara.johansson@nordicdata.se", jobtitle: "Head of Product", lifecyclestage: "customer" },
];

export const COMPANIES = [
  { name: "AcmeTech", domain: "acmetech.io", industry: "COMPUTER_SOFTWARE", city: "San Francisco", country: "United States", numberofemployees: "150", annualrevenue: "12000000" },
  { name: "GlobalSync", domain: "globalsync.co", industry: "INFORMATION_TECHNOLOGY_AND_SERVICES", city: "London", country: "United Kingdom", numberofemployees: "80", annualrevenue: "5500000" },
  { name: "NordicData", domain: "nordicdata.se", industry: "COMPUTER_SOFTWARE", city: "Stockholm", country: "Sweden", numberofemployees: "200", annualrevenue: "18000000" },
];

export const DEALS = [
  { dealname: "AcmeTech — Platform License", amount: "65000", closedate: "", contactIndex: 0, companyIndex: 0 },
  { dealname: "GlobalSync — API Integration", amount: "38000", closedate: "", contactIndex: 1, companyIndex: 1 },
  { dealname: "NordicData — Enterprise Suite", amount: "150000", closedate: "", contactIndex: 2, companyIndex: 2 },
];

export const TICKETS = [
  { subject: "AcmeTech API rate limit issue", content: "Alice reports intermittent 429 errors during peak hours.", hs_ticket_priority: "HIGH", contactIndex: 0 },
  { subject: "GlobalSync SSO configuration", content: "Bob needs help configuring SAML for their IdP.", hs_ticket_priority: "MEDIUM", contactIndex: 1 },
];

export const NOTES = [
  { hs_note_body: "Call recap: Alice confirmed Q2 budget is approved. EU data residency is a requirement.", contactIndex: 0 },
  { hs_note_body: "Bob sent SAML configuration guide. Follow up in 48h if no progress.", contactIndex: 1 },
];

export const TASKS = [
  { hs_task_subject: "Prepare integration demo for AcmeTech", hs_task_body: "Build demo environment with sample API calls and webhooks.", hs_task_status: "NOT_STARTED", hs_task_priority: "HIGH", contactIndex: 0 },
  { hs_task_subject: "Follow up on GlobalSync SSO issue", hs_task_body: "Check if Bob resolved the SAML configuration.", hs_task_status: "NOT_STARTED", hs_task_priority: "MEDIUM", contactIndex: 1 },
];

export const CALLS = [
  { hs_call_title: "Discovery call — NordicData", hs_call_body: "Discussed multi-region deployment needs. Budget range 120-180K.", hs_call_direction: "OUTBOUND", hs_call_duration: "1800000", contactIndex: 2 },
];

export const MEETINGS = [
  { hs_meeting_title: "Kickoff — AcmeTech onboarding", hs_meeting_body: "Walk through integration plan + Q2 milestones.", hs_meeting_outcome: "COMPLETED", hs_meeting_start_time: new Date(Date.now() + 86400000 * 3).toISOString(), hs_meeting_end_time: new Date(Date.now() + 86400000 * 3 + 3600000).toISOString(), contactIndex: 0 },
  { hs_meeting_title: "Quarterly review — NordicData", hs_meeting_body: "Q1 progress + Q2 expansion discussion.", hs_meeting_outcome: "SCHEDULED", hs_meeting_start_time: new Date(Date.now() + 86400000 * 10).toISOString(), hs_meeting_end_time: new Date(Date.now() + 86400000 * 10 + 1800000).toISOString(), contactIndex: 2 },
];

export const PRODUCTS = [
  { name: "Platform License — Starter", description: "Single-portal license, 10k contacts, standard support.", price: "5000", hs_sku: "HUBCLI-PLAT-STARTER", hs_cost_of_goods_sold: "800" },
  { name: "Platform License — Pro", description: "Multi-portal, 100k contacts, dedicated CSM.", price: "25000", hs_sku: "HUBCLI-PLAT-PRO", hs_cost_of_goods_sold: "2500" },
  { name: "Professional Services — Onboarding", description: "6-week guided onboarding engagement.", price: "12000", hs_sku: "HUBCLI-PS-ONBD", hs_cost_of_goods_sold: "6000" },
];

export const LEADS = [
  { firstname: "Eve", lastname: "Barros", email: "eve.barros@prospecttech.io", jobtitle: "Head of RevOps", lifecyclestage: "subscriber" },
  { firstname: "Marco", lastname: "Keller", email: "marco.keller@inboundco.de", jobtitle: "Founder", lifecyclestage: "marketingqualifiedlead" },
];

export const GOALS = [
  { hs_goal_name: "Q2 Pipeline Coverage Target", hs_goal_description: "Maintain 3x coverage over Q2 booked ARR target." },
];
