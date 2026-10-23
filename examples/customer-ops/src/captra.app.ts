import { createTicket } from './capabilities/create-ticket'
import { issueRefund } from './capabilities/issue-refund'
import { searchDocs } from './capabilities/search-docs'
import { capabilityViews, defineApp, defineHook } from '@captra/core'

const privacy = defineHook({
  name: 'privacy',
  async beforeCapability(_name, input) {
    return input
  },
})

const audit = defineHook({
  name: 'audit',
  async afterCapability(_name, output) {
    return output
  },
})

export const supportApp = defineApp({
  name: 'Captra Customer Ops',
  version: '1.0.0',
  scopes: ['user', 'project', 'task'],
  capabilities: [searchDocs, createTicket, issueRefund],
  surface: capabilityViews(),
  hooks: [privacy, audit],
})
