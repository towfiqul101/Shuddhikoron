import "./globals.css";

export const metadata = {
  title: "News Wizard — বাংলা সংবাদ সম্পাদক",
  description:
    "বাংলা সংবাদের জন্য স্মার্ট বানান পরীক্ষা, সম্পাদনা এবং ইংরেজি অনুবাদ।",
  icons: {
    icon: "📰",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
