import "./globals.css";
import { LangProvider } from "@/lib/lang";

export const metadata = { title: "India Site Selector", description: "Rank Indian states for your expansion persona." };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><LangProvider>{children}</LangProvider></body>
    </html>
  );
}
