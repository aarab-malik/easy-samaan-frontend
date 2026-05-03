import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import { FaXTwitter, FaInstagram, FaYoutube, FaLinkedin } from "react-icons/fa6";
import { AuthProvider } from "./lib/auth-context";
import Logo from "./components/Logo";


const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EasySamaan - Unified Shopping System",
  description: "EasySamaan - Unified Shopping System",
  icons: {
    icon: "/brand-shopping-cart-symbol.png",
    apple: "/brand-shopping-cart-symbol.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${jakarta.variable} ${bricolage.variable} antialiased`}
      >
        <AuthProvider>
          <Header />
          {children}
        {/* Footer */}
        <footer className="border-t border-[#E5E5E5] bg-gradient-to-br from-[#FF9F49] via-[#FF8D28] to-[#E67300] pt-12 pb-8 px-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-10 flex justify-center">
              <Logo variant="full" size={38} className="text-white" />
            </div>
            {/* Social Links */}
            <div className="flex justify-center gap-8 mb-12">
              <a href="#" className="text-black transition-all duration-300 hover:-translate-y-1 hover:opacity-85" title="X (Twitter)">
                <FaXTwitter size={24} />
              </a>
              <a href="#" className="text-black transition-all duration-300 hover:-translate-y-1 hover:opacity-85" title="Instagram">
                <FaInstagram size={24} />
              </a>
              <a href="#" className="text-black transition-all duration-300 hover:-translate-y-1 hover:opacity-85" title="YouTube">
                <FaYoutube size={24} />
              </a>
              <a href="#" className="text-black transition-all duration-300 hover:-translate-y-1 hover:opacity-85" title="LinkedIn">
                <FaLinkedin size={24} />
              </a>
            </div>

            {/* Footer Links Grid */}
            <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
              <div>
                <h4 className="font-bold text-black mb-4">Shop</h4>
                <ul className="space-y-2 text-[#2C2C2C]">
                  <li><a href="#" className="hover:underline">All Products</a></li>
                  <li><a href="#" className="hover:underline">Featured</a></li>
                  <li><a href="#" className="hover:underline">Sale</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-black mb-4">Support</h4>
                <ul className="space-y-2 text-[#2C2C2C]">
                  <li><a href="#" className="hover:underline">FAQ</a></li>
                  <li><a href="#" className="hover:underline">Contact Us</a></li>
                  <li><a href="#" className="hover:underline">Shipping</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-black mb-4">Company</h4>
                <ul className="space-y-2 text-[#2C2C2C]">
                  <li><a href="#" className="hover:underline">About Us</a></li>
                  <li><a href="#" className="hover:underline">Careers</a></li>
                  <li><a href="#" className="hover:underline">Press</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-black mb-4">Legal</h4>
                <ul className="space-y-2 text-[#2C2C2C]">
                  <li><a href="#" className="hover:underline">Privacy</a></li>
                  <li><a href="#" className="hover:underline">Terms</a></li>
                  <li><a href="#" className="hover:underline">Cookies</a></li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
