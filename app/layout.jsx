import "./globals.css";

export const metadata = {
  title: "Mafia Playing",
  description: "Hostuj grę w Mafię bez kont i zapraszaj graczy kodem."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
