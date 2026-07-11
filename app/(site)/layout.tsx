import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QuoteCartProvider from "@/components/QuoteCart";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuoteCartProvider>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </QuoteCartProvider>
  );
}
