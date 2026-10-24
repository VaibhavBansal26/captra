import { z } from 'zod'
import { defineCapability, type CapabilityViewProps } from '@captra-ai/core'

const TicketResult = z.object({ id: z.string(), title: z.string(), status: z.literal('open') })
type TicketResult = z.infer<typeof TicketResult>

function TicketStatusCard({ value }: CapabilityViewProps<TicketResult>) {
  return <article className="result-card ticket-view"><span className="result-type">TICKET CREATED</span><strong>{value.id}</strong><p>{value.title}</p><span className="status-chip">{value.status}</span></article>
}

TicketStatusCard.displayName = 'TicketStatusCard'

export const createTicket = defineCapability({
  name: 'createTicket',
  description: 'Create a support ticket from a verified customer issue.',
  input: z.object({ title: z.string().min(4) }),
  output: TicketResult,
  scopes: ['user', 'project'],
  approval: 'never',
  async execute({ title }) {
    return { id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`, title, status: 'open' as const }
  },
  view: TicketStatusCard,
})
