import { z } from 'zod'
import { defineCapability, type CapabilityViewProps } from '@captra/core'

const SearchResult = z.object({
  answer: z.string(),
  sources: z.array(z.string()),
})

type SearchResult = z.infer<typeof SearchResult>

function SearchDocsView({ value }: CapabilityViewProps<SearchResult>) {
  return <article className="result-card answer-view"><span className="result-type">SEARCH DOCS</span><p>{value.answer}</p><div className="source-list">{value.sources.map(source => <span key={source}>{source}</span>)}</div></article>
}

SearchDocsView.displayName = 'SearchDocsView'

export const searchDocs = defineCapability({
  name: 'searchDocs',
  description: 'Search product documentation and produce a sourced answer.',
  input: z.object({ query: z.string().min(3) }),
  output: SearchResult,
  scopes: ['user', 'project', 'task'],
  approval: 'never',
  async execute({ query }) {
    return { answer: `The relevant guidance for “${query}” was found in the billing policy.`, sources: ['Billing policy §4', 'Refund operations'] }
  },
  view: SearchDocsView,
})
