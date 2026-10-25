import {createRuntime,type EvaluationSuite} from 'captra'
import {app} from './src/captra.app.js'

const runtime=createRuntime(app)
const suite:EvaluationSuite={
  version:1,
  name:'Hello AI quality',
  cases:[{
    name:'returns a useful typed answer',
    capability:'hello-ai',
    input:{message:'Help me ship my first AI feature'},
    identity:{tenantId:'eval',userId:'starter'},
    assert:result=>result.run.status==='completed'&&typeof (result.value as {reply?:unknown}).reply==='string',
    limits:{maxTokens:1_200},
  }],
}

export default {runtime,suite,options:{repetitions:3},thresholds:{minPassRate:1,maxTokens:3_600}}
