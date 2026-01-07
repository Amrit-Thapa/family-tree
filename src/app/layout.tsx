import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "@/shared/context/UserContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Tree App",
  description: "Visualize and manage family relationships",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen flex flex-col">
          <header className="border-b p-4 text-center font-semibold">
            Family Tree App
          </header>
          <main className="flex-1 px-4 py-6">
            <div className="mx-auto max-w-6xl">
              <UserProvider>{children}</UserProvider>
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t p-4 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Family Tree
          </footer>
        </div>
      </body>
    </html>
  );
}
