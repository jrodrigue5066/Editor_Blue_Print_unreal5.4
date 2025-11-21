import React, { useRef, useState } from 'react';
import { BlueprintNode, Connection } from '../types';
import { Trash2 } from 'lucide-react';

interface BlueprintCanvasProps {
  nodes: BlueprintNode[];
  setNodes: React.Dispatch<React.SetStateAction<BlueprintNode[]>>;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
}

// Fixed dimensions for reliable coordinate calculation without DOM querying during render
// Updated to be more compact
const NODE_WIDTH = 160;
const HEADER_HEIGHT = 28;
const BODY_PADDING = 8;
const PIN_ROW_HEIGHT = 20;
const PIN_GAP = 4; // gap-1
const PIN_OFFSET_Y = 10; // Center of pin relative to row start (half of 20)
const PIN_OFFSET_X = 12; // Center of pin circle from edge (approx padding + half width)

const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({ nodes, setNodes, connections, setConnections }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  
  // Connection Drag State
  const [drawingConnection, setDrawingConnection] = useState<{
    startNodeId: string;
    startPin: string;
    isInput: boolean;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Coordinate Helpers ---
  const getNodePinPos = (node: BlueprintNode, pinIndex: number, isInput: boolean) => {
    const x = isInput 
      ? node.x + PIN_OFFSET_X 
      : node.x + NODE_WIDTH - PIN_OFFSET_X;
    
    // Header + Padding Top + (Row Index * (Height + Gap)) + Center Offset
    const y = node.y + HEADER_HEIGHT + BODY_PADDING + (pinIndex * (PIN_ROW_HEIGHT + PIN_GAP)) + PIN_OFFSET_Y;
    return { x, y };
  };

  // --- Mouse Handlers for Nodes ---
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    // Only drag if not clicking a button/input/pin (handled by stopPropagation there)
    const node = nodes.find((n) => n.id === id);
    if (node) {
      setSelectedNode(id);
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y,
      });
    }
  };

  // --- Mouse Handlers for Pins ---
  const handlePinMouseDown = (e: React.MouseEvent, nodeId: string, pinName: string, isInput: boolean, index: number) => {
    e.stopPropagation(); // Prevent node dragging
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const { x, y } = getNodePinPos(node, index, isInput);
    
    setDrawingConnection({
      startNodeId: nodeId,
      startPin: pinName,
      isInput,
      startX: x,
      startY: y,
      currX: x,
      currY: y
    });
  };

  const handlePinMouseUp = (e: React.MouseEvent, nodeId: string, pinName: string, isInput: boolean) => {
    e.stopPropagation();
    if (!drawingConnection) return;

    // Valid connection logic:
    // 1. Must connect Input to Output (or vice versa)
    // 2. Must not be same node (optional, but usually preventing loops is good)
    if (drawingConnection.startNodeId === nodeId) {
        setDrawingConnection(null);
        return;
    }

    if (drawingConnection.isInput === isInput) {
        // Cannot connect input to input or output to output
        setDrawingConnection(null);
        return;
    }

    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      fromNodeId: isInput ? drawingConnection.startNodeId : nodeId,
      fromPin: isInput ? drawingConnection.startPin : pinName,
      toNodeId: isInput ? nodeId : drawingConnection.startNodeId,
      toPin: isInput ? pinName : drawingConnection.startPin,
    };

    // Prevent duplicates
    const exists = connections.some(c => 
        c.fromNodeId === newConnection.fromNodeId && 
        c.fromPin === newConnection.fromPin &&
        c.toNodeId === newConnection.toNodeId &&
        c.toPin === newConnection.toPin
    );

    if (!exists) {
        setConnections(prev => [...prev, newConnection]);
    }
    setDrawingConnection(null);
  };

  // --- Canvas Mouse Handlers ---
  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectedNode && dragOffset) {
      // Move Node
      setNodes((prev) =>
        prev.map((n) =>
          n.id === selectedNode
            ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
            : n
        )
      );
    } else if (drawingConnection && canvasRef.current) {
      // Drag Connection Line
      const rect = canvasRef.current.getBoundingClientRect();
      setDrawingConnection(prev => prev ? ({
        ...prev,
        currX: e.clientX - rect.left, // Adjust for relative canvas position if needed, usually e.clientX if canvas is full screen
        currY: e.clientY - rect.top
      }) : null);
    }
  };

  const handleMouseUp = () => {
    setSelectedNode(null);
    setDragOffset(null);
    setDrawingConnection(null); // Cancel drag if dropped on canvas
  };

  const deleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((prev) => prev.filter((n) => n.id !== id));
    // Remove associated connections
    setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'event': return 'border-red-500 bg-red-900/40';
      case 'function': return 'border-blue-500 bg-blue-900/40';
      case 'variable': return 'border-yellow-500 bg-yellow-900/40';
      case 'macro': return 'border-gray-400 bg-gray-700/40';
      default: return 'border-blue-500 bg-blue-900/40';
    }
  };

  const getNodeHeaderColor = (type: string) => {
    switch (type) {
      case 'event': return 'bg-red-600';
      case 'function': return 'bg-blue-600';
      case 'variable': return 'bg-yellow-600';
      case 'macro': return 'bg-gray-500';
      default: return 'bg-blue-600';
    }
  };

  // --- SVG Path Generation ---
  const getPathD = (x1: number, y1: number, x2: number, y2: number) => {
    const dist = Math.abs(x2 - x1);
    const cp1x = x1 + dist * 0.5;
    const cp2x = x2 - dist * 0.5;
    return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden blueprint-grid select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      ref={canvasRef}
    >
        <div className="absolute top-4 left-4 bg-neutral-800/80 backdrop-blur p-2 rounded border border-neutral-700 text-xs text-neutral-400 pointer-events-none z-10">
            <p className="font-bold text-white mb-1">Blueprint Sketchpad</p>
            <p>AI places nodes. Drag to move.</p>
            <p>Drag between pins to connect.</p>
        </div>

      {/* SVG Layer for Connections */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0">
        {connections.map(conn => {
          const fromNode = nodes.find(n => n.id === conn.fromNodeId);
          const toNode = nodes.find(n => n.id === conn.toNodeId);
          if (!fromNode || !toNode) return null;

          const fromIdx = fromNode.outputs.indexOf(conn.fromPin);
          const toIdx = toNode.inputs.indexOf(conn.toPin);
          if (fromIdx === -1 || toIdx === -1) return null;

          const start = getNodePinPos(fromNode, fromIdx, false);
          const end = getNodePinPos(toNode, toIdx, true);

          return (
            <path 
                key={conn.id}
                d={getPathD(start.x, start.y, end.x, end.y)}
                stroke="white" 
                strokeWidth="2" 
                fill="none" 
                className="opacity-60"
            />
          );
        })}
        
        {/* Dragging Line */}
        {drawingConnection && (
           <path 
             d={getPathD(drawingConnection.startX, drawingConnection.startY, drawingConnection.currX, drawingConnection.currY)}
             stroke="white"
             strokeWidth="2"
             fill="none"
             strokeDasharray="5,5"
             className="opacity-80"
           />
        )}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className={`absolute rounded-lg border shadow-xl backdrop-blur-sm text-white group z-10 ${getNodeColor(node.type)}`}
          style={{
            left: node.x,
            top: node.y,
            width: `${NODE_WIDTH}px`,
            cursor: 'grab',
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
        >
          {/* Header */}
          <div className={`px-2 py-0.5 h-7 rounded-t-md flex justify-between items-center ${getNodeHeaderColor(node.type)}`}>
             <span className="font-bold text-xs truncate">{node.name}</span>
             <button 
                onClick={(e) => deleteNode(node.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-200 transition-opacity"
             >
                 <Trash2 size={12} />
             </button>
          </div>

          {/* Body */}
          <div className="p-2 flex justify-between text-[10px] h-full relative">
            {/* Inputs */}
            <div className="flex flex-col gap-1 w-1/2">
              {node.inputs.map((input, idx) => (
                <div key={idx} className="flex items-center gap-1 h-5 group/pin">
                  <div 
                    className="w-2 h-2 rounded-full border border-white bg-neutral-800 hover:bg-white cursor-crosshair transition-colors flex-shrink-0"
                    onMouseDown={(e) => handlePinMouseDown(e, node.id, input, true, idx)}
                    onMouseUp={(e) => handlePinMouseUp(e, node.id, input, true)}
                  />
                  <span className="truncate leading-none">{input}</span>
                </div>
              ))}
            </div>

            {/* Outputs */}
            <div className="flex flex-col gap-1 items-end w-1/2">
              {node.outputs.map((output, idx) => (
                <div key={idx} className="flex items-center gap-1 h-5 justify-end group/pin">
                  <span className="truncate leading-none">{output}</span>
                  <div 
                    className="w-2 h-2 rounded-full border border-white bg-neutral-800 hover:bg-white cursor-crosshair transition-colors flex-shrink-0"
                    onMouseDown={(e) => handlePinMouseDown(e, node.id, output, false, idx)}
                    onMouseUp={(e) => handlePinMouseUp(e, node.id, output, false)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BlueprintCanvas;