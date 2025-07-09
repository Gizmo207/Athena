'use client'
import { useState } from 'react';

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  systemPrompt: string;
  isOverseer?: boolean;
}

const AVAILABLE_AGENTS: Agent[] = [
  {
    id: 'athena',
    name: 'ATHENA',
    purpose: 'Intelligent Overseer & Strategic Coordination',
    systemPrompt: `You are ATHENA, an advanced AI Overseer Agent with exceptional strategic thinking, problem-solving, and analytical capabilities. You coordinate multiple AI agents and systems, provide strategic insights, and manage complex projects with professional confidence.`,
    isOverseer: true
  },
  {
    id: 'devbot',
    name: 'DevBot',
    purpose: 'Full-Stack Development & Architecture',
    systemPrompt: `You are DevBot, a specialized development agent focused on full-stack programming, system architecture, code review, and technical problem-solving. You excel at JavaScript/TypeScript, React, Node.js, databases, and deployment strategies.`
  },
  {
    id: 'bizbot',
    name: 'BizBot',
    purpose: 'Business Strategy & Market Analysis',
    systemPrompt: `You are BizBot, a business intelligence agent specializing in market analysis, strategic planning, competitive research, financial modeling, and business development. You provide data-driven insights for business decisions.`
  },
  {
    id: 'promptbot',
    name: 'PromptBot',
    purpose: 'AI Prompt Engineering & Optimization',
    systemPrompt: `You are PromptBot, an expert in AI prompt engineering, model optimization, and AI workflow design. You help create effective prompts, optimize AI interactions, and design intelligent automation systems.`
  },
  {
    id: 'designbot',
    name: 'DesignBot',
    purpose: 'UI/UX Design & Creative Direction',
    systemPrompt: `You are DesignBot, a creative design agent specializing in UI/UX design, visual aesthetics, user experience optimization, and creative problem-solving. You help create beautiful, functional, and user-friendly interfaces.`
  }
];

interface AgentSwitcherProps {
  currentAgent: Agent;
  onAgentChange: (agent: Agent) => void;
  className?: string;
}

export default function AgentSwitcher({ currentAgent, onAgentChange, className = '' }: AgentSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {/* Agent Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-athena-cyan/30 bg-athena-dark/80 hover:bg-athena-dark text-white transition-all duration-300 hover:shadow-neon-cyan"
        style={{
          backdropFilter: 'blur(10px)',
        }}
      >
        <span className="text-sm font-mono">
          {currentAgent.isOverseer ? '👑' : '🤖'} {currentAgent.name}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Agent List Panel */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-2 w-80 rounded-lg border-2 border-athena-cyan/30 bg-athena-dark/95 backdrop-blur-lg shadow-2xl z-50"
          style={{
            backdropFilter: 'blur(15px)',
          }}
        >
          <div className="p-4">
            <h3 className="text-athena-cyan font-bold text-lg mb-3 font-mono">
              🧠 AGENT SELECTION
            </h3>
            
            <div className="space-y-2">
              {AVAILABLE_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    onAgentChange(agent);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-300 font-mono ${
                    currentAgent.id === agent.id
                      ? 'border-athena-cyan bg-athena-cyan/10 shadow-neon-cyan'
                      : 'border-gray-600/50 hover:border-athena-cyan/50 hover:bg-athena-cyan/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">
                      {agent.isOverseer ? '👑' : '🤖'}
                    </span>
                    <div className="flex-1">
                      <div className={`font-bold text-sm ${
                        agent.isOverseer ? 'text-athena-green' : 'text-athena-cyan'
                      }`}>
                        {agent.name}
                        {agent.isOverseer && (
                          <span className="ml-2 text-xs px-2 py-1 rounded bg-athena-green/20 text-athena-green">
                            OVERSEER
                          </span>
                        )}
                      </div>
                      <div className="text-gray-300 text-xs mt-1 leading-relaxed">
                        {agent.purpose}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-600/30">
              <p className="text-xs text-gray-400 font-mono">
                💡 Each agent has specialized capabilities and knowledge domains
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { AVAILABLE_AGENTS };
