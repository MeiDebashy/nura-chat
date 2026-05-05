import { ArrowLeft } from "lucide-react";

export default function TermsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[102] bg-[#12121f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
          <span className="text-[14px]">Back</span>
        </button>
        <h1 className="text-white text-[16px] font-medium tracking-wide">
          Terms of Service
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 max-w-xl mx-auto w-full">
        <div className="space-y-8">
          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Nature of the service
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              Nura is an emotional-AI companion. It is{" "}
              <span className="text-white">not therapy</span>,{" "}
              <span className="text-white">not medical advice</span>, and{" "}
              <span className="text-white">not a crisis service</span>. If you
              are in immediate danger or experiencing a mental-health emergency,
              please contact emergency services or a licensed professional.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Eligibility
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              You must be at least 16 years old to use Nura. By using the
              service, you represent that you meet this requirement.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Acceptable use
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed mb-2">
              Do not use Nura to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-[13px] text-gray-400 leading-relaxed">
              <li>Generate or distribute illegal, harmful, or abusive content</li>
              <li>Impersonate another person or entity</li>
              <li>Reverse-engineer, scrape, or abuse the API</li>
              <li>Upload malware or attempt to compromise the platform</li>
            </ul>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Accounts and data
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              You are responsible for safeguarding your account. Conversations
              may be stored to enable sync and continuity. See our Privacy
              Policy for details on how data is handled.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Disputes
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              If you have a concern, contact us first at{" "}
              <span className="text-cyan-400">support@nura.example</span>. We
              will make a good-faith effort to resolve disputes informally
              within 30 days. If we cannot reach a resolution, disputes will be
              governed by the laws of the jurisdiction where the service
              operator is headquartered, without regard to conflict-of-law
              principles.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Limitation of liability
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              To the fullest extent permitted by law, Nura and its operators
              are not liable for any indirect, incidental, special,
              consequential, or punitive damages arising out of your use of the
              service. Our total liability for any claim shall not exceed the
              amount you paid us in the 12 months preceding the claim, or $50,
              whichever is greater.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Changes to these terms
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              We may update these terms from time to time. Continued use after
              changes constitutes acceptance. If you do not agree, stop using
              Nura and delete your data from Settings.
            </p>
          </section>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
