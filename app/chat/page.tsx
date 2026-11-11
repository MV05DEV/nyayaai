import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { DocumentGenerator } from "@/components/documents/document-generator";

export const metadata = { title: "Legal Assistant | NyayaAI", description: "Understand your consumer legal options with NyayaAI." };

export default function ChatPage() {
  return <><ChatWorkspace /><DocumentGenerator /></>;
}
