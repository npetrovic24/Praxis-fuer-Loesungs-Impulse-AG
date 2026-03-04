"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getChatMessages, sendChatMessage, markChatAsRead } from "@/lib/actions/chat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Send, Loader2, MessageCircle, Hash } from "lucide-react";

interface Course {
  id: string;
  name: string;
}

interface ChatMessage {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; full_name: string; role: string } | null;
}

interface Props {
  courses: Course[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

export function ChatClient({ courses, currentUserId, currentUserName, currentUserRole }: Props) {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(courses[0]?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load messages when course changes
  useEffect(() => {
    if (!activeCourseId) return;
    setIsLoading(true);
    getChatMessages(activeCourseId).then((data) => {
      setMessages(data);
      setIsLoading(false);
      markChatAsRead(activeCourseId);
    });
  }, [activeCourseId]);

  // Realtime subscription
  useEffect(() => {
    if (!activeCourseId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${activeCourseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `course_id=eq.${activeCourseId}`,
        },
        async (payload) => {
          // Fetch the full message with user profile
          const msgs = await getChatMessages(activeCourseId);
          setMessages(msgs);
          markChatAsRead(activeCourseId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCourseId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !activeCourseId) return;
    const content = newMessage;
    setNewMessage("");

    // Optimistic update
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      course_id: activeCourseId,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      user: { id: currentUserId, full_name: currentUserName, role: currentUserRole },
    };
    setMessages((prev) => [...prev, optimistic]);

    startTransition(async () => {
      await sendChatMessage(activeCourseId, content);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const roleColor = (role: string) => {
    if (role === "admin") return "text-red-600";
    if (role === "dozent") return "text-[#0099A8]";
    return "text-foreground";
  };

  const roleLabel = (role: string) => {
    if (role === "admin") return "Admin";
    if (role === "dozent") return "Dozent";
    return null;
  };

  const activeCourse = courses.find((c) => c.id === activeCourseId);

  if (courses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <MessageCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Keine Lehrgänge verfügbar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Course list (left) */}
      <div className="w-56 shrink-0 flex flex-col">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Lehrgänge
        </p>
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => setActiveCourseId(course.id)}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
              activeCourseId === course.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Hash className="h-4 w-4 shrink-0" />
            <span className="truncate">{course.name}</span>
          </button>
        ))}
        </div>
      </div>

      {/* Chat area (right) */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border px-4 py-3 flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{activeCourse?.name || "Chat"}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Noch keine Nachrichten. Starte die Unterhaltung!
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUserId;
              const role = msg.user?.role || "participant";
              const label = roleLabel(role);

              return (
                <div key={msg.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground mt-0.5">
                    {(msg.user?.full_name || "?")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("text-sm font-semibold", roleColor(role))}>
                        {isMe ? "Du" : msg.user?.full_name || "Unbekannt"}
                      </span>
                      {label && !isMe && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {label}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString("de-CH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Nachricht an #${activeCourse?.name || "Chat"}...`}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              disabled={isPending}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isPending || !newMessage.trim()}
              className="shrink-0"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
