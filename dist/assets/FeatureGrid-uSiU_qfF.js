import{r as d,j as e,I as c}from"./index-CjafWCjW.js";const l=d.memo(({title:r,description:i,icon:n,isActive:t=!1,onClick:o,className:a=""})=>e.jsxs("div",{className:`
        relative p-4 sm:p-6 rounded-xl border transition-all duration-300 cursor-pointer group
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
        transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10 animate-fade-in
        ${t?"bg-gray-800 border-blue-500 shadow-lg shadow-blue-500/20":"bg-gray-900 border-gray-700 hover:border-gray-600 hover:bg-gray-800"}
        ${a}
      `,onClick:o,role:"button",tabIndex:0,onKeyDown:s=>{(s.key==="Enter"||s.key===" ")&&(s.preventDefault(),o?.())},"aria-pressed":t,"aria-describedby":`${r.toLowerCase().replace(/\s+/g,"-")}-description`,children:[e.jsx("div",{className:`
        inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg mb-3 sm:mb-4 transition-all duration-300
        ${t?"bg-blue-600 text-white":"bg-gray-800 text-gray-400 group-hover:bg-gray-700"}
      `,children:e.jsx(c,{name:n,size:20,className:"sm:w-6 sm:h-6","aria-hidden":!0})}),e.jsxs("div",{children:[e.jsx("h3",{className:`
          text-base sm:text-lg font-semibold mb-2 transition-colors
          ${t?"text-white":"text-gray-200 group-hover:text-white"}
        `,children:r}),e.jsx("p",{id:`${r.toLowerCase().replace(/\s+/g,"-")}-description`,className:`
            text-sm leading-relaxed transition-colors
            ${t?"text-gray-300":"text-gray-400 group-hover:text-gray-300"}
          `,children:i})]}),t&&e.jsx("div",{className:"absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"})]}));l.displayName="FeatureCard";const u=({className:r=""})=>{const[i,n]=d.useState("speech-to-text"),t=[{id:"speech-to-text",title:"Speech to Text",description:"Convert audio to text with industry-leading accuracy and speed. Support for 100+ languages and real-time streaming.",icon:"microphone"},{id:"text-to-speech",title:"Text to Speech",description:"Generate natural-sounding speech from text with customizable voices, emotions, and speaking styles.",icon:"speaker"},{id:"voice-agent",title:"Voice Agent",description:"Build conversational AI agents that can understand, process, and respond to voice interactions naturally.",icon:"robot"},{id:"audio-intelligence",title:"Audio Intelligence",description:"Extract insights from audio with sentiment analysis, topic detection, and advanced audio understanding.",icon:"brain"}],o=a=>{n(a)};return e.jsx("section",{className:`bg-gray-900 py-4 ${r}`,children:e.jsx("div",{className:"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",children:e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",children:t.map((a,s)=>e.jsx(l,{...a,isActive:i===a.id,onClick:()=>o(a.id),className:`h-full animate-fade-in animate-delay-${(s+1)*100}`},a.id))})})})};export{u as default};
