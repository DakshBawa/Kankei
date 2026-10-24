import "./globals.css";
import { AppProvider } from "@/lib/context";
import Shell from "@/components/Shell";

export const metadata = {
  title: "KANKEI — Japan-India Bilateral Expansion Platform",
  description: "AI-powered market entry intelligence for Japanese SMEs expanding into India. Research, partner matching, compliance, and GTM strategy.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
