import React, { useState } from 'react';
import BlueprintCanvas from './components/BlueprintCanvas';
import ChatInterface from './components/ChatInterface';
import { BlueprintNode, Connection } from './types';

const App: React.FC = () => {
  // Central state for nodes to be shared between Chat (generator) and Canvas (renderer)
  const [nodes, setNodes] = useState<BlueprintNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  return (
    <div className="flex w-screen h-screen bg-neutral-900 text-white overflow-hidden">
      {/* Left Pane: Blueprint Visualizer/Canvas */}
      <div className="flex-1 relative border-r border-neutral-800">
        <BlueprintCanvas 
          nodes={nodes} 
          setNodes={setNodes} 
          connections={connections} 
          setConnections={setConnections} 
        />
      </div>

      {/* Right Pane: Gemini Chat Interface */}
      <div className="w-[450px] h-full flex flex-col z-20 relative">
        <ChatInterface setNodes={setNodes} />
      </div>
    </div>
  );
};

export default App;