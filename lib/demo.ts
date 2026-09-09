import type {
  QANode,
  RequirementsDocument,
  MockupVersion,
  RequirementCategory,
} from "@/types";

const date = "2026-09-08T12:00:00.000Z";
export const samplePrompt =
  "Design a calm daily planning app for independent creative workers. Help people choose three meaningful priorities and see their progress without feeling overwhelmed.";
export const sampleTree: QANode = {
  id: "sample-root",
  question: `Prompt: ${samplePrompt}`,
  children: [
    {
      id: "audience",
      questionNumber: 1,
      question: "Who is this space for?",
      answer:
        "Independent designers and writers who juggle several projects and want a manageable day.",
      children: [
        {
          id: "focus",
          questionNumber: 3,
          question: "What helps when several projects compete for attention?",
          answer:
            "Choose three priorities. Keep the list short and make completed work visible.",
          children: [],
        },
      ],
    },
    {
      id: "experience",
      questionNumber: 2,
      question: "How should the experience feel?",
      answer:
        "Quiet, warm, and encouraging. Progress should feel satisfying without streaks or pressure.",
      children: [
        {
          id: "accessibility",
          questionNumber: 4,
          question: "How can the interactions be clear for everyone?",
          answer:
            "Use labeled controls, visible keyboard focus, clear completion states, and readable contrast.",
          children: [],
        },
        {
          id: "refinement",
          questionNumber: 5,
          question: "What would make the first version more useful?",
          answer:
            "Show a progress summary and let me filter to the tasks that still need attention.",
          children: [],
        },
      ],
    },
  ],
};
function category(
  title: string,
  entries: [
    string,
    string,
    RequirementCategory["requirements"][number]["category"],
  ][],
): RequirementCategory {
  return {
    title,
    requirements: entries.map(([text, questionId, kind], index) => ({
      id: `${questionId}-${index}`,
      text,
      source: "user-qa",
      sourceDetails: { questionId },
      priority: "high",
      category: kind,
      tags: [],
      createdAt: date,
      updatedAt: date,
    })),
  };
}
export const sampleRequirements: RequirementsDocument = {
  id: "sample-requirements",
  prompt: samplePrompt,
  lastUpdated: date,
  categories: {
    basicNeeds: category("A clear focus for today", [
      [
        "Help independent creative workers prioritize a manageable day.",
        "audience",
        "functional",
      ],
    ]),
    functionalRequirements: category("Three meaningful priorities", [
      [
        "Show three priorities with reversible completion controls.",
        "focus",
        "functional",
      ],
    ]),
    userExperience: category("Quiet and encouraging", [
      [
        "Use generous space, warm neutral surfaces, and restrained emerald accents.",
        "experience",
        "ux",
      ],
    ]),
    implementation: category("A lightweight prototype", [
      [
        "Keep prototype interactions in browser memory; no account or persistence is needed for the sample.",
        "focus",
        "technical",
      ],
    ]),
    refinements: category("See what remains", [
      [
        "Add a completion summary and filters for all tasks or remaining tasks in version 2.",
        "refinement",
        "functional",
      ],
    ]),
    constraints: category("Accessible by default", [
      [
        "Label every control, communicate completion with text, and support keyboard operation.",
        "accessibility",
        "accessibility",
      ],
    ]),
  },
};
const colors: MockupVersion["mockupData"]["colorScheme"] = {
  primary: "#047857",
  "primary-focus": "#065f46",
  "primary-content": "#ffffff",
  secondary: "#e7eee9",
  "secondary-focus": "#d1ddd5",
  "secondary-content": "#173d2d",
  accent: "#f6d89c",
  "accent-focus": "#e0bd76",
  "accent-content": "#4e3c16",
  neutral: "#243b31",
  "neutral-focus": "#182c23",
  "neutral-content": "#ffffff",
  "base-100": "#ffffff",
  "base-200": "#f6f8f7",
  "base-300": "#e7eee9",
  "base-content": "#172a25",
};
function prototype(refined: boolean) {
  return `function FocusRoom() {
  const [done, setDone] = React.useState([]);
  const [filter, setFilter] = React.useState('all');
  const tasks = ['Plan the launch', 'Draft the story', 'Make time to explore'];
  const count = done.length;
  return <div style={{maxWidth:780,margin:'0 auto',padding:'40px 24px'}}>
    <header style={{display:'flex',justifyContent:'space-between',marginBottom:52}}><strong style={{color:'#047857'}}>focus room</strong><span style={{fontSize:14,color:'#53665b'}}>A fresh start</span></header>
    <p style={{textTransform:'uppercase',letterSpacing:3,fontSize:12,color:'#047857'}}>Your space for today</p>
    <h1 style={{fontSize:40,lineHeight:1.15,letterSpacing:-1,margin:'14px 0'}}> ${refined ? "Make room for good work." : "Today, with intention."}</h1>
    <p style={{color:'#53665b',lineHeight:1.6,maxWidth:470}}>A few meaningful things. A little breathing room. Choose where your attention goes.</p>
    ${
      refined
        ? `<section aria-label="Daily progress" style={{marginTop:28,padding:20,background:'#e7eee9',borderRadius:16}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><strong>{count} of 3 complete</strong><span>{count===3?'You made room for what matters.':'One small step at a time.'}</span></div><progress aria-label="Completed priorities" value={count} max={3} style={{width:'100%',marginTop:16,accentColor:'#047857'}} /></section>
    <div aria-label="Filter priorities" style={{display:'flex',gap:12,marginTop:28}}>{['all','remaining'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)} style={{border:'1px solid #a6bdb0',borderRadius:20,padding:'8px 16px',background:filter===value?'#047857':'white',color:filter===value?'white':'#173d2d'}}>{value==='all'?'All priorities':'Still to do'}</button>)}</div>`
        : ""
    }
    <div style={{display:'grid',gap:12,marginTop:28}}>{tasks.map((task,index)=>({task,index})).filter(({index})=>filter==='all'||!done.includes(index)).map(({task,index})=><button key={task} aria-label={task} aria-pressed={done.includes(index)} onClick={()=>setDone(previous=>previous.includes(index)?previous.filter(item=>item!==index):[...previous,index])} style={{display:'flex',alignItems:'center',gap:18,textAlign:'left',border:'1px solid #d3dfd7',borderRadius:16,padding:24,background:'white',color:'#173d2d'}}><span aria-hidden="true" style={{color:'#047857',fontSize:22}}>{done.includes(index)?'✓':'○'}</span><span><strong style={{display:'block',textDecoration:done.includes(index)?'line-through':'none'}}>{task}</strong><span style={{display:'block',marginTop:5,fontSize:13,color:'#53665b'}}>{done.includes(index)?'Complete':'A meaningful priority'}</span></span></button>)}</div>
    {filter==='remaining'&&count===3&&<p role="status" style={{padding:24}}>All clear. Take a breath.</p>}
    <footer style={{marginTop:40,fontSize:13,color:'#53665b'}}>Progress at your own pace. This is a prepared interactive prototype.</footer>
  </div>;
}
export default FocusRoom;`;
}
export const sampleVersions: MockupVersion[] = [false, true].map(
  (refined, index) => ({
    id: `sample-v${index + 1}`,
    timestamp: date,
    name: refined
      ? "Version 2: progress and focus"
      : "Version 1: the daily essentials",
    qaTree: sampleTree,
    requirementsDoc: sampleRequirements,
    currentState: { currentNodeId: null, suggestedAnswer: null },
    mockupData: {
      code: prototype(refined),
      colorScheme: colors,
      components: ["FocusRoom"],
      features: refined
        ? ["Three priorities", "Completion summary", "Remaining task filter"]
        : ["Three priorities", "Completion controls"],
      nextSteps: ["Test the concept with creative workers."],
    },
  }),
);
