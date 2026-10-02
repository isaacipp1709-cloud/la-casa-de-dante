import { ChatShell } from "@/components/chat/chat-shell";
import { MainLayout } from "@/components/layout/main-layout";

export default function Home() {
  return (
    <MainLayout>
      <ChatShell />
    </MainLayout>
  );
}
