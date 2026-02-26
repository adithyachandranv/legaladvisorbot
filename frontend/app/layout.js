import "./globals.css";

export const metadata = {
  title: "Legal Advisor Bot",
  description: "AI-powered legal advice chatbot using OpenRouter",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
