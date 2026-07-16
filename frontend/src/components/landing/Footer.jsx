import React from "react";
import { Link } from "react-router-dom";
import logoImg from "../../assets/logo.png";
import { Heart } from "lucide-react";

export default function Footer({
  onScrollToSection,
}) {
  const footerLinks = {
    Product: [
      { label: "Symptom Search", sectionId: "features" },
      { label: "Hospital Discovery", sectionId: "features" },
      { label: "Queue Prediction", sectionId: "features" },
      { label: "Live Dashboard", sectionId: "queue-demo" },
    ],
    Company: [
      { label: "About Us", sectionId: "how-it-works" },
      { label: "Our Mission", sectionId: "how-it-works" },
      { label: "Careers", sectionId: "hero" },
      { label: "Press", sectionId: "hero" },
    ],
    Resources: [
      { label: "Documentation", sectionId: "hero" },
      { label: "Privacy Policy", sectionId: "hero" },
      { label: "Terms of Service", sectionId: "hero" },
      { label: "Support Help", sectionId: "hero" },
    ],
    Contact: [
      { label: "support@medhospi.com", isEmail: true },
      { label: "+1 (555) 019-2834", isPhone: true },
      { label: "Patna, Bihar, India", isText: true },
    ],
  };

  const handleLinkClick = (e, sectionId) => {
    if (sectionId) {
      e.preventDefault();
      if (onScrollToSection) {
        onScrollToSection(sectionId);
      }
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo & Brand Column */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl shadow-md w-fit">
              <div className="bg-white p-1 rounded-lg border border-slate-200/50 shadow-sm shrink-0">
                <img src={logoImg} alt="MediHospi Logo" className="w-7 h-7 object-contain rounded" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-base leading-none tracking-tight">
                  <span className="text-[#0F4C81]">Medi</span>
                  <span className="text-[#14B8A6]">Hospi</span>
                </span>
                <span className="text-[8px] font-bold text-[#64748B] mt-1.5 tracking-wide">
                  Smart HealthCare Access System
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              Discover the right doctor by symptom, view live wait time estimates,
              and join virtual hospital queues with confidence. Empowering smarter care access.
            </p>
            <div className="flex items-center gap-3.5 mt-2">
              <a href="https://twitter.com" aria-label="Twitter" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#0E7490] hover:text-white flex items-center justify-center transition-all">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a href="https://linkedin.com" aria-label="LinkedIn" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#0E7490] hover:text-white flex items-center justify-center transition-all">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0h.003z"/>
                </svg>
              </a>
              <a href="https://github.com" aria-label="GitHub" className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#0E7490] hover:text-white flex items-center justify-center transition-all">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </a>
            </div>
          </div>
 
          {/* Nav columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title} className="flex flex-col gap-3">
              <h6 className="text-sm font-extrabold uppercase tracking-wider text-white">
                {title}
              </h6>
              <ul className="flex flex-col gap-2.5 text-sm">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.isEmail ? (
                      <a href={`mailto:${link.label}`} className="hover:text-[#14B8A6] transition-colors">
                        {link.label}
                      </a>
                    ) : link.isPhone ? (
                      <a href={`tel:${link.label}`} className="hover:text-[#14B8A6] transition-colors">
                        {link.label}
                      </a>
                    ) : link.isText ? (
                      <span>{link.label}</span>
                    ) : (
                      <a
                        href={`#${link.sectionId}`}
                        onClick={(e) => handleLinkClick(e, link.sectionId)}
                        className="hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
 
        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <p>© {new Date().getFullYear()} MediHospi. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="h-3 w-3 fill-rose-500 text-rose-500" /> for smart care.
          </p>
        </div>
      </div>
    </footer>
  );
}
