import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Draft",
  description: "Player check-in and live team drafting.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
