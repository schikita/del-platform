import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className="bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
