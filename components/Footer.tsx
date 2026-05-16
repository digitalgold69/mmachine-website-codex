import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-racing text-cream mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-racing-dark font-bold">M</div>
              <div>
                <div className="font-display text-lg">M-Machine</div>
                <div className="text-xs opacity-70 -mt-1">Est. 1980</div>
              </div>
            </div>
            <p className="text-sm opacity-75 leading-relaxed">
              Classic Mini panels, engineered parts and metals. Darlington, County Durham.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gold mb-3 text-sm">Catalogues</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link href="/parts" className="hover:text-gold">All parts</Link></li>
              <li><Link href="/parts/classic-mini-panels" className="hover:text-gold">Mini panel categories</Link></li>
              <li><Link href="/parts/engineering-metals" className="hover:text-gold">Metal categories</Link></li>
              <li><Link href="/catalogue/mini" className="hover:text-gold">Classic Mini panels</Link></li>
              <li><Link href="/catalogue/metals" className="hover:text-gold">Engineering metals</Link></li>
              <li><Link href="/featured" className="hover:text-gold">Featured custom work</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gold mb-3 text-sm">Information</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link href="/about" className="hover:text-gold">About us</Link></li>
              <li><Link href="/contact" className="hover:text-gold">Get in touch</Link></li>
              <li><a href="#" className="hover:text-gold">Privacy policy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gold mb-3 text-sm">Contact</h4>
            <address className="not-italic text-sm opacity-80 leading-relaxed">
              Unit 3–7 Forge Way<br />
              Cleveland Trading Estate<br />
              Darlington, DL1 2PJ<br /><br />
              <a href="tel:01325381302" className="hover:text-gold">01325 381302</a><br />
              <a href="mailto:sales@m-machine.co.uk" className="hover:text-gold">sales@m-machine.co.uk</a>
            </address>
          </div>
        </div>

        <div className="border-t border-racing-light pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs opacity-60">
          <p>© {new Date().getFullYear()} M-Machine · Craftgrange Limited · Company no. 01476185</p>
          <p>Proudly British engineering since 1980</p>
        </div>
      </div>
    </footer>
  );
}
