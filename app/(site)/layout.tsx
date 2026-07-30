import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QuoteCartProvider from "@/components/QuoteCart";
import RouteScrollManager from "@/components/RouteScrollManager";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuoteCartProvider>
      <RouteScrollManager />
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </QuoteCartProvider>
  );
}
