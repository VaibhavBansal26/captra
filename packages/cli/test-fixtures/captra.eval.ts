import {capability,capabilityViews,createRuntime,defineApp,type EvaluationSuite} from '@captra-ai/core'
import {z} from 'zod'

const echo=capability({name:'echo',description:'Echo a value.',input:z.object({value:z.string()}),output:z.object({value:z.string()}),async run(input){return input},view:{name:'Echo'}})
const runtime=createRuntime(defineApp({name:'CLI evaluation',scopes:[],capabilities:[echo],surface:capabilityViews()}))
const suite:EvaluationSuite={version:1,name:'CLI suite',cases:[{name:'echoes',capability:'echo',input:{value:'hello'},identity:{tenantId:'test'},assert:result=>(result.value as {value:string}).value==='hello'}]}

export default {runtime,suite,thresholds:{minPassRate:1}}
