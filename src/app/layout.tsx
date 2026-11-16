import type { Metadata } from "next";
import "@/styles/global.scss";

export const metadata: Metadata = {
  title: "Keep in Touch",
  description: "A thoughtful place to keep up with the people in your life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
