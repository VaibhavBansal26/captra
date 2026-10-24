import { createCaptraClient } from '@captra/client'
import type { app } from './captra.app.js'

export const client=createCaptraClient<typeof app>({baseUrl:'/api/captra'})
