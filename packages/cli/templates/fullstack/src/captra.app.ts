import { capabilityViews,defineApp } from 'captra'
import { hello } from './capabilities/hello.js'

export const app=defineApp({name:'{{appName}}',scopes:['user'],capabilities:[hello],surface:capabilityViews()})
