import { defineConfig } from 'vitepress'

export default defineConfig({
  title:'Captra',
  description:'The capability-first framework for type-safe, memory-aware AI applications.',
  base:'/captra/',
  cleanUrls:true,
  lastUpdated:true,
  head:[
    ['link',{rel:'icon',href:'/captra/captra-mark.svg',type:'image/svg+xml'}],
    ['meta',{name:'theme-color',content:'#07111f'}],
    ['meta',{property:'og:title',content:'Captra — The AI-native JavaScript framework'}],
    ['meta',{property:'og:description',content:'One typed contract for capabilities, agents, memory, state, tools, approvals, and UI.'}],
    ['meta',{property:'og:image',content:'https://vaibhavbansal26.github.io/captra/captra-readme-header.png'}],
  ],
  themeConfig:{
    logo:'/captra-mark.svg',
    siteTitle:'captra',
    nav:[
      {text:'Guide',link:'/getting-started'},
      {text:'Reference',link:'/reference/capabilities'},
      {text:'Integrations',link:'/integrations'},
      {text:'Roadmap',link:'/roadmap'},
      {text:'0.12.0',items:[
        {text:'Changelog',link:'https://github.com/VaibhavBansal26/captra/releases'},
        {text:'npm',link:'https://www.npmjs.com/package/captra'},
      ]},
    ],
    sidebar:{
      '/':[
        {text:'Introduction',items:[
          {text:'Overview',link:'/'},
          {text:'Getting started',link:'/getting-started'},
          {text:'Mental model',link:'/concepts'},
        ]},
        {text:'Core systems',items:[
          {text:'Capabilities & agents',link:'/reference/capabilities'},
          {text:'Tools, hooks & plugins',link:'/reference/extensions'},
          {text:'State & memory',link:'/state-and-memory'},
          {text:'Runtime & durability',link:'/reference/runtime'},
          {text:'Token & cost budgets',link:'/reference/budgets'},
          {text:'Devtools',link:'/reference/devtools'},
          {text:'Replay & evaluations',link:'/reference/evaluations'},
          {text:'React & generated UI',link:'/reference/react'},
        ]},
        {text:'Build and ship',items:[
          {text:'Backend & deployment',link:'/deployment'},
          {text:'Security',link:'/security'},
          {text:'Upgrades & migrations',link:'/migrations'},
          {text:'Integrations',link:'/integrations'},
          {text:'CLI',link:'/reference/cli'},
          {text:'Package map',link:'/reference/packages'},
        ]},
        {text:'Project',items:[
          {text:'Roadmap',link:'/roadmap'},
          {text:'Contributing',link:'https://github.com/VaibhavBansal26/captra/blob/main/CONTRIBUTING.md'},
        ]},
      ],
    },
    socialLinks:[{icon:'github',link:'https://github.com/VaibhavBansal26/captra'}],
    search:{provider:'local'},
    outline:{level:[2,3],label:'On this page'},
    editLink:{pattern:'https://github.com/VaibhavBansal26/captra/edit/main/docs/:path',text:'Edit this page on GitHub'},
    footer:{message:'Released under the MIT License.',copyright:'Captra — capability-first AI applications.'},
  },
})
