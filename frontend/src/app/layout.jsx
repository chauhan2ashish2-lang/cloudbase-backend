import './globals.css';

export const metadata = {
  title: 'AI Marketing Manager',
  description: 'AI-powered Facebook & Instagram marketing automation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
