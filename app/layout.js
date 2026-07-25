import "./globals.css";

// An emoji is not a URL — `icon: "📰"` made the browser request /%F0%9F%93%B0
// and 404. Inlining it as an SVG data URI keeps the emoji without a file.
const emojiFavicon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".85em" font-size="88">✓</text></svg>'
  );

export const metadata = {
  metadataBase: new URL("https://shuddhikoron.vercel.app"),
  title: "শুদ্ধিকরণ — বাংলা বানান পরীক্ষা",
  description:
    "বাংলা একাডেমি প্রমিত বানানের নিয়ম অনুসারে বানান পরীক্ষা, সংবাদ সম্পাদনা ও ইংরেজি অনুবাদ।",
  applicationName: "শুদ্ধিকরণ",
  keywords: [
    "বাংলা বানান পরীক্ষা",
    "বানান সংশোধন",
    "প্রমিত বাংলা বানান",
    "বাংলা সংবাদ সম্পাদনা",
    "Bangla spell checker",
    "Bengali spelling checker",
  ],
  openGraph: {
    title: "শুদ্ধিকরণ — বাংলা বানান পরীক্ষা",
    description:
      "বাংলা একাডেমি প্রমিত বানানের নিয়ম অনুসারে বানান পরীক্ষা, সংবাদ সম্পাদনা ও ইংরেজি অনুবাদ।",
    siteName: "Shuddhikoron",
    locale: "bn_BD",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "শুদ্ধিকরণ — বাংলা বানান পরীক্ষা",
    description:
      "বাংলা একাডেমি প্রমিত বানানের নিয়ম অনুসারে বানান পরীক্ষা, সংবাদ সম্পাদনা ও ইংরেজি অনুবাদ।",
  },
  icons: {
    icon: emojiFavicon,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
