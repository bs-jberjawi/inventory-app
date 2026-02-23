"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  RotateCcw,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const EXAMPLE_PROMPTS = [
  "What items are currently low on stock?",
  "Show me an overview of inventory analytics",
  "Analyze the stock movements for USB-C Hub and recommend a better threshold",
  "Which categories have the highest inventory value?",
  "Find all electronics products",
  "What are the top moving items in the last 30 days?",
];

export default function AIAssistantPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const retry = () => {
    // Remove the last assistant (error) message, then re-send the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const parts = lastUserMsg.parts.filter((p) => p.type === "text");
      const text = parts.map((p) => (p as { type: "text"; text: string }).text).join("");
      if (text) {
        setMessages(messages.filter((m) => m.role !== "assistant" || m !== messages[messages.length - 1]));
        sendMessage({ text });
      }
    }
  };

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (content?: string) => {
    const text = content || input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Check if the last streaming assistant message has text yet
  const lastMessage = messages[messages.length - 1];
  const lastAssistantHasText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some(
      (p) => p.type === "text" && p.text.length > 0
    );
  const showThinkingIndicator =
    status === "submitted" || (status === "streaming" && !lastAssistantHasText);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Assistant
          </h2>
          <p className="text-muted-foreground">
            Ask questions about your inventory, get analysis, and smart
            recommendations.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChat}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Chat messages */}
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                How can I help you today?
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                I can search inventory, analyze stock trends, identify low-stock
                items, and recommend optimal reorder thresholds.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    className="text-xs text-left h-auto py-2 px-3 justify-start whitespace-normal"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {m.parts.map((part, i) => {
                          if (part.type === "text" && part.text) {
                            return (
                              <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                                {part.text}
                              </ReactMarkdown>
                            );
                          }
                          return null;
                        })}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {m.parts.map((part, i) =>
                          part.type === "text" ? (
                            <span key={i}>{part.text}</span>
                          ) : null
                        )}
                      </p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Thinking / tool-use indicator */}
              {showThinkingIndicator && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing inventory data...</span>
                      <Badge variant="secondary" className="text-xs">
                        Using tools
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Error state */}
              {status === "error" && error && (
                <div className="flex gap-3">
                  <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
                    <p>
                      Sorry, I encountered an error: {error.message}. Please try
                      again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => retry()}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your inventory... (Enter to send, Shift+Enter for newline)"
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                onClick={() => stop()}
                size="icon"
                variant="outline"
                className="shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                size="icon"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Powered by Gemini. Responses may not always be accurate.
          </p>
        </div>
      </Card>
    </div>
  );
}
