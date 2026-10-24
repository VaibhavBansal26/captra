import { z } from 'zod'
import { defineCapability, defineTool, type CapabilityViewProps } from '@captra-ai/core'

const RefundResult = z.object({ refundId: z.string(), amount: z.number(), status: z.literal('approved') })
type RefundResult = z.infer<typeof RefundResult>

function RefundApprovalCard({ value }: CapabilityViewProps<RefundResult>) {
  return <article className="result-card refund-view"><span className="result-type">REFUND APPROVED</span><strong>${value.amount.toFixed(2)}</strong><p>{value.refundId} · Visa ending 4242</p><span className="status-chip">{value.status}</span></article>
}

RefundApprovalCard.displayName = 'RefundApprovalCard'

const issueRefundTool = defineTool({
  name: 'billing.issueRefund',
  description: 'Issue one refund through the billing provider.',
  input: z.object({ transactionId: z.string(), amount: z.number().positive().max(500) }),
  output: RefundResult,
  permissions: ['billing:refund'],
  effect: 'write',
  idempotencyKey: ({ transactionId }) => transactionId,
  async execute({ amount }) {
    return { refundId: `ref_${crypto.randomUUID().slice(0, 8)}`, amount, status: 'approved' as const }
  },
})

export const issueRefund = defineCapability({
  name: 'issueRefund',
  description: 'Issue a refund after explicit human approval.',
  input: z.object({ transactionId: z.string(), amount: z.number().positive().max(500) }),
  output: RefundResult,
  scopes: ['user', 'project', 'task'],
  approval: 'required',
  tools: [issueRefundTool],
  async execute({ transactionId, amount }, context) {
    const refund = await context.tools.call<RefundResult>('billing.issueRefund', { transactionId, amount })
    context.memory.remember({ scope: 'user', ownerId: context.userId, type: 'fact', content: `Refunded $${amount.toFixed(2)}`, confidence: 1 })
    return refund
  },
  view: RefundApprovalCard,
})
