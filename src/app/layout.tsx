import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMU × Pitt · In-House Draft",
  description:
    "Eight captains. One live board. The CMU and Pitt League of Legends in-house draft.",
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
