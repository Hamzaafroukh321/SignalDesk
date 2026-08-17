import type {
  Assignee,
  Ticket,
  TicketActivity,
  TicketId,
  TicketPriority,
  TicketStatus,
  TicketTag,
} from '../domain/ticket'

const FIXTURE_NOW = Date.parse('2026-08-15T12:00:00.000Z')
const DAY_IN_MS = 86_400_000

export const fixtureAssignees: readonly Assignee[] = [
  { id: 'agent-amina', name: 'Amina Rahal', initials: 'AR' },
  { id: 'agent-daniel', name: 'Daniel Cho', initials: 'DC' },
  { id: 'agent-lina', name: 'Lina Patel', initials: 'LP' },
  { id: 'agent-marcus', name: 'Marcus Reed', initials: 'MR' },
]

export const fixtureTags: readonly TicketTag[] = [
  { id: 'tag-billing', label: 'Billing' },
  { id: 'tag-bug', label: 'Bug' },
  { id: 'tag-enterprise', label: 'Enterprise' },
  { id: 'tag-feedback', label: 'Feedback' },
  { id: 'tag-onboarding', label: 'Onboarding' },
  { id: 'tag-security', label: 'Security' },
  { id: 'tag-shipping', label: 'Shipping' },
]

interface TicketSeed {
  id: TicketId
  title: string
  customer: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  createdDaysAgo: number
  updatedDaysAgo: number
  tagIds: readonly string[]
  description: string
}

const seeds: readonly TicketSeed[] = [
  {
    id: 'SD-1048',
    title: 'Invoice shows duplicate annual charge',
    customer: 'Atlas & Pine',
    status: 'new',
    priority: 'urgent',
    assigneeId: null,
    createdDaysAgo: 2,
    updatedDaysAgo: 0,
    tagIds: ['tag-billing', 'tag-enterprise'],
    description:
      'The finance team sees two completed annual charges for the same workspace and needs confirmation before month-end close.',
  },
  {
    id: 'SD-1051',
    title: 'New teammate cannot accept invitation',
    customer: 'Northstar Labs',
    status: 'open',
    priority: 'high',
    assigneeId: 'agent-amina',
    createdDaysAgo: 8,
    updatedDaysAgo: 1,
    tagIds: ['tag-onboarding', 'tag-bug'],
    description:
      'An invitation link returns the member to the sign-in screen after authentication on two different browsers.',
  },
  {
    id: 'SD-1057',
    title: 'Clarify data retention for archived projects',
    customer: 'Cedar Health',
    status: 'pending',
    priority: 'normal',
    assigneeId: 'agent-daniel',
    createdDaysAgo: 15,
    updatedDaysAgo: 3,
    tagIds: ['tag-security', 'tag-enterprise'],
    description:
      'The compliance lead is reviewing internal policy and asked for the exact retention window and deletion process.',
  },
  {
    id: 'SD-1062',
    title: 'Export finished with missing rows',
    customer: 'Beacon Freight',
    status: 'open',
    priority: 'urgent',
    assigneeId: 'agent-lina',
    createdDaysAgo: 5,
    updatedDaysAgo: 0,
    tagIds: ['tag-bug', 'tag-enterprise'],
    description:
      'A quarterly export reports success but contains 8,412 rows instead of the 9,036 rows visible in the filtered workspace. The customer has repeated the export twice, preserved both files, and supplied the exact filter settings so the discrepancy can be reproduced without requesting additional access.',
  },
  {
    id: 'SD-1069',
    title: 'Request for consolidated billing',
    customer: 'Morrow Studio',
    status: 'resolved',
    priority: 'low',
    assigneeId: 'agent-marcus',
    createdDaysAgo: 24,
    updatedDaysAgo: 6,
    tagIds: ['tag-billing', 'tag-feedback'],
    description: 'The customer wanted all team subscriptions represented on one monthly invoice.',
  },
  {
    id: 'SD-1074',
    title: 'Dashboard totals differ after midnight',
    customer: 'Juniper Works',
    status: 'new',
    priority: 'high',
    assigneeId: null,
    createdDaysAgo: 1,
    updatedDaysAgo: 1,
    tagIds: ['tag-bug'],
    description: 'Daily totals briefly disagree between the overview and detail report around UTC midnight.',
  },
  {
    id: 'SD-1080',
    title: 'Help configuring the first workspace',
    customer: 'Solace Legal',
    status: 'pending',
    priority: 'normal',
    assigneeId: 'agent-amina',
    createdDaysAgo: 10,
    updatedDaysAgo: 2,
    tagIds: ['tag-onboarding'],
    description: 'The operations manager would like guidance on roles, queues, and notification defaults.',
  },
  {
    id: 'SD-1086',
    title: 'Package marked delivered but not received',
    customer: 'River & Row',
    status: 'open',
    priority: 'high',
    assigneeId: 'agent-daniel',
    createdDaysAgo: 4,
    updatedDaysAgo: 0,
    tagIds: ['tag-shipping'],
    description: 'The carrier marked the replacement device delivered, but reception has no record of it.',
  },
  {
    id: 'SD-1093',
    title: 'Feature idea for shared response snippets',
    customer: 'Meridian Travel',
    status: 'resolved',
    priority: 'low',
    assigneeId: 'agent-lina',
    createdDaysAgo: 34,
    updatedDaysAgo: 12,
    tagIds: ['tag-feedback'],
    description: 'The support lead proposed team-managed reply snippets with approval and usage history.',
  },
  {
    id: 'SD-1099',
    title: 'SAML metadata certificate rotation',
    customer: 'Stonebridge Bank',
    status: 'pending',
    priority: 'urgent',
    assigneeId: 'agent-marcus',
    createdDaysAgo: 11,
    updatedDaysAgo: 2,
    tagIds: ['tag-security', 'tag-enterprise'],
    description: 'The identity team needs to coordinate a certificate rotation before the existing value expires.',
  },
  {
    id: 'SD-1104',
    title: 'Tax identifier is absent from receipt',
    customer: 'Vela Education',
    status: 'new',
    priority: 'normal',
    assigneeId: null,
    createdDaysAgo: 3,
    updatedDaysAgo: 1,
    tagIds: ['tag-billing'],
    description: 'A newly saved tax identifier does not appear on the most recent downloadable receipt.',
  },
  {
    id: 'SD-1110',
    title: 'Mobile navigation closes unexpectedly',
    customer: 'Fieldnote Media',
    status: 'open',
    priority: 'normal',
    assigneeId: 'agent-amina',
    createdDaysAgo: 7,
    updatedDaysAgo: 2,
    tagIds: ['tag-bug'],
    description: 'The navigation drawer closes when the user scrolls a long project list on a small screen.',
  },
  {
    id: 'SD-1117',
    title: 'Need audit history for permission changes',
    customer: 'Bluepeak Energy',
    status: 'pending',
    priority: 'high',
    assigneeId: 'agent-daniel',
    createdDaysAgo: 18,
    updatedDaysAgo: 4,
    tagIds: ['tag-security', 'tag-feedback'],
    description: 'Administrators need to review who changed a project role and when the change occurred.',
  },
  {
    id: 'SD-1121',
    title: 'Welcome email uses an old company name',
    customer: 'Orbit Foods',
    status: 'resolved',
    priority: 'normal',
    assigneeId: 'agent-lina',
    createdDaysAgo: 29,
    updatedDaysAgo: 8,
    tagIds: ['tag-onboarding', 'tag-bug'],
    description: 'A cached organization name appeared in one invitation email after the workspace was renamed.',
  },
  {
    id: 'SD-1128',
    title: 'Card verification repeatedly fails',
    customer: 'Harbor Dental',
    status: 'open',
    priority: 'urgent',
    assigneeId: 'agent-marcus',
    createdDaysAgo: 3,
    updatedDaysAgo: 0,
    tagIds: ['tag-billing', 'tag-bug'],
    description: 'A valid corporate card fails verification even after the bank confirms there are no blocks.',
  },
  {
    id: 'SD-1135',
    title: 'Can guests comment without edit access?',
    customer: 'Canopy Design',
    status: 'new',
    priority: 'low',
    assigneeId: null,
    createdDaysAgo: 2,
    updatedDaysAgo: 2,
    tagIds: ['tag-onboarding'],
    description: 'The project owner wants reviewers to comment while keeping project fields read-only.',
  },
  {
    id: 'SD-1142',
    title: 'Webhook retries arrive out of order',
    customer: 'Kite Commerce',
    status: 'open',
    priority: 'high',
    assigneeId: 'agent-amina',
    createdDaysAgo: 6,
    updatedDaysAgo: 1,
    tagIds: ['tag-bug', 'tag-enterprise'],
    description: 'Delayed webhook retries can arrive after a newer event and confuse the downstream order state.',
  },
  {
    id: 'SD-1149',
    title: 'Security questionnaire follow-up',
    customer: 'Elm Capital',
    status: 'pending',
    priority: 'high',
    assigneeId: 'agent-daniel',
    createdDaysAgo: 20,
    updatedDaysAgo: 5,
    tagIds: ['tag-security', 'tag-enterprise'],
    description: 'Procurement requested clarification on encryption key ownership and incident notification timing.',
  },
  {
    id: 'SD-1153',
    title: 'Suggestion to pin favorite queues',
    customer: 'Pollen Creative',
    status: 'resolved',
    priority: 'low',
    assigneeId: 'agent-lina',
    createdDaysAgo: 41,
    updatedDaysAgo: 14,
    tagIds: ['tag-feedback'],
    description: 'Agents would like quick access to the queues they review every morning.',
  },
  {
    id: 'SD-1160',
    title: 'Shipment tracking link opens a blank page',
    customer: 'Oakline Supply',
    status: 'new',
    priority: 'normal',
    assigneeId: null,
    createdDaysAgo: 1,
    updatedDaysAgo: 0,
    tagIds: ['tag-shipping', 'tag-bug'],
    description: 'The tracking link in the dispatch email opens a carrier page without a tracking number.',
  },
  {
    id: 'SD-1166',
    title: 'Workspace import needs field mapping help',
    customer: 'Lumen Civic',
    status: 'open',
    priority: 'normal',
    assigneeId: 'agent-marcus',
    createdDaysAgo: 9,
    updatedDaysAgo: 3,
    tagIds: ['tag-onboarding'],
    description: 'The implementation team needs advice mapping three legacy ownership fields into SignalDesk.',
  },
  {
    id: 'SD-1172',
    title: 'Refund status has not updated',
    customer: 'Saffron Market',
    status: 'pending',
    priority: 'high',
    assigneeId: 'agent-amina',
    createdDaysAgo: 13,
    updatedDaysAgo: 3,
    tagIds: ['tag-billing'],
    description: 'A confirmed refund still appears as processing after five business days.',
  },
  {
    id: 'SD-1179',
    title: 'Resolved ticket reopened after reply',
    customer: 'Tandem Robotics',
    status: 'open',
    priority: 'low',
    assigneeId: 'agent-daniel',
    createdDaysAgo: 16,
    updatedDaysAgo: 1,
    tagIds: ['tag-bug'],
    description: 'An automated thank-you reply reopened a resolved conversation unexpectedly.',
  },
  {
    id: 'SD-1185',
    title: 'Quarterly access review completed',
    customer: 'Verde Systems',
    status: 'resolved',
    priority: 'normal',
    assigneeId: 'agent-lina',
    createdDaysAgo: 45,
    updatedDaysAgo: 9,
    tagIds: ['tag-security'],
    description: 'The customer confirmed all inactive accounts were removed after the quarterly review.',
  },
]

function toIso(daysAgo: number, hourOffset = 0): string {
  return new Date(FIXTURE_NOW - daysAgo * DAY_IN_MS + hourOffset * 3_600_000).toISOString()
}

function findAssignee(id: string): Assignee {
  const assignee = fixtureAssignees.find((candidate) => candidate.id === id)
  if (!assignee) {
    throw new Error(`Unknown fixture assignee: ${id}`)
  }
  return { ...assignee }
}

function findTag(id: string): TicketTag {
  const tag = fixtureTags.find((candidate) => candidate.id === id)
  if (!tag) {
    throw new Error(`Unknown fixture tag: ${id}`)
  }
  return { ...tag }
}

function buildActivities(seed: TicketSeed): TicketActivity[] {
  const activities: TicketActivity[] = [
    {
      id: `${seed.id}-created`,
      kind: 'created',
      message: 'Ticket created from the customer support queue.',
      author: 'SignalDesk',
      createdAt: toIso(seed.createdDaysAgo),
    },
  ]

  if (seed.status !== 'new') {
    activities.push({
      id: `${seed.id}-status`,
      kind: 'status-change',
      message: `Status moved to ${seed.status}.`,
      author: seed.assigneeId ? findAssignee(seed.assigneeId).name : 'Queue team',
      createdAt: toIso(seed.updatedDaysAgo, -1),
    })
  }

  return activities
}

export function createTicketFixtures(): Ticket[] {
  return seeds.map((seed) => ({
    id: seed.id,
    title: seed.title,
    customer: {
      name: seed.customer,
      email: `support@${seed.customer.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.example`,
    },
    status: seed.status,
    priority: seed.priority,
    assignee: seed.assigneeId ? findAssignee(seed.assigneeId) : null,
    createdAt: toIso(seed.createdDaysAgo),
    updatedAt: toIso(seed.updatedDaysAgo),
    tags: seed.tagIds.map(findTag),
    description: seed.description,
    version: 1,
    activities: buildActivities(seed),
  }))
}

export const ticketFixtureCount = seeds.length
