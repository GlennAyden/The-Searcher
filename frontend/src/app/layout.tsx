import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Financial Sentiment & Market Intelligence",
  description: "Next-gen investment intelligence platform",
};

import { FilterProvider } from "@/context/filter-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans bg-zinc-950 text-zinc-100 overflow-hidden" suppressHydrationWarning>
        <FilterProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
              {children}
            </main>
          </div>
        </FilterProvider>
      </body>
    </html>
  );
}
