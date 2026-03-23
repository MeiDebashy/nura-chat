import { NextRequest, NextResponse } from "next/server";
import { ChatRequest, ChatResponse } from "@/lib/types";

// Sample responses for demo - replace with actual AI integration
const sampleResponses: Record<string, string[]> = {
  greeting: [
    "It's wonderful to hear from you!",
    "I'm here to listen and support you through whatever you're experiencing.",
  ],
  feeling_good: [
    "That's wonderful to hear!",
    "I'm so glad you're feeling good today.",
    "What's been bringing you joy lately?",
  ],
  feeling_bad: [
    "I'm sorry you're going through a difficult time.",
    "It takes courage to share how you're feeling.",
    "Would you like to tell me more about what's on your mind?",
  ],
  default: [
    "Thank you for sharing that with me.",
    "I'm here to support you in whatever way I can.",
    "How does that make you feel?",
  ],
};

function getResponseSegments(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
    return sampleResponses.greeting;
  }
  
  if (
    lowerMessage.includes("good") ||
    lowerMessage.includes("great") ||
    lowerMessage.includes("happy") ||
    lowerMessage.includes("wonderful")
  ) {
    return sampleResponses.feeling_good;
  }
  
  if (
    lowerMessage.includes("bad") ||
    lowerMessage.includes("sad") ||
    lowerMessage.includes("stressed") ||
    lowerMessage.includes("anxious") ||
    lowerMessage.includes("worried") ||
    lowerMessage.includes("depressed")
  ) {
    return sampleResponses.feeling_bad;
  }
  
  return sampleResponses.default;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Simulate some processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const segments = getResponseSegments(message);

    const response: ChatResponse = { segments };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
