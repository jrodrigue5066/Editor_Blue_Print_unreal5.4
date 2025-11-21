import { Type } from "@google/genai";

export enum Sender {
  USER = 'user',
  BOT = 'bot'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  isLoading?: boolean;
  attachment?: {
    type: 'image';
    data: string; // base64
    mimeType: string;
  };
}

export interface BlueprintNode {
  id: string;
  name: string;
  type: 'event' | 'function' | 'variable' | 'macro';
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPin: string;
  toNodeId: string;
  toPin: string;
}

export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT_3_4 = "3:4",
  LANDSCAPE_4_3 = "4:3",
  PORTRAIT_9_16 = "9:16",
  LANDSCAPE_16_9 = "16:9",
  ULTRAWIDE_21_9 = "21:9"
}

export interface GeneratedImage {
  url: string;
  prompt: string;
}