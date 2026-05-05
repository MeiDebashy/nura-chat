import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

const CONSENT_KEY = "nura-consent-v1";

export function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
}

interface Props {
  onAccept(): void;
}

export function ConsentGate({ onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Mount animation
    const t = setTimeout(() => setShow(true), 30);
    return () => clearTimeout(t);
  }, []);

  const accept = () => {
    if (!agreed) return;
    try {
      localStorage.setItem(CONSENT_KEY, "yes");
    } catch {
      // ignore
    }
    onAccept();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0a0a0f]/95 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div
        className={`w-full max-w-[480px] bg-[#12121f] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-200 ${
          show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="px-6 pt-6 pb-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <ShieldCheck size={18} className="text-cyan-400" />
          </div>
          <h1
            id="consent-title"
            className="text-white text-[17px] font-medium tracking-tight"
          >
            Before you start
          </h1>
        </div>
        <div className="px-6 py-4 space-y-3 text-[13.5px] text-gray-300 leading-relaxed">
          <p>
            Nura is an AI companion built to listen. It is{" "}
            <span className="text-white font-medium">not a therapist</span>,
            not a medical service, and not a substitute for professional
            mental-health care.
          </p>
          <p>
            <span className="text-white font-medium">In a crisis</span> —
            thoughts of self-harm, suicide, or being in immediate danger —
            please reach out to a real person right now. In the US dial{" "}
            <span className="text-white font-medium">988</span>. In the UK{" "}
            <span className="text-white font-medium">116 123</span>. Elsewhere,
            see{" "}
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline"
            >
              findahelpline.com
            </a>
            .
          </p>
          <p>
            Conversations are stored in your browser and sent to Nura's server
            to generate replies. Don't share information you wouldn't want
            processed by an LLM provider.
          </p>
        </div>
        <div className="px-6 pb-5">
          <label className="flex items-start gap-3 text-[13px] text-gray-300 cursor-pointer select-none py-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-cyan-500"
            />
            <span>
              I understand Nura isn't a therapist and I know where to get help
              in a crisis.
            </span>
          </label>
        </div>
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={accept}
            disabled={!agreed}
            className={`w-full px-4 py-3 rounded-xl text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
              agreed
                ? "bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f]"
                : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
