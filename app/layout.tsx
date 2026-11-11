import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NyayaAI | Legal clarity. Practical action.",
  description: "Understand your legal options, organize your case and prepare your next steps with AI assistance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
