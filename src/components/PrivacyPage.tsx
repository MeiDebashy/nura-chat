import { ArrowLeft } from "lucide-react";

export default function PrivacyPage({ onBack }: { onBack: () => void }) {
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
          Privacy Policy
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 max-w-xl mx-auto w-full">
        <div className="space-y-8">
          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Overview
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              Nura is built to be a private space. We collect only what is
              necessary to provide the service, and we never sell your data.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              What lives on your device
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-[13px] text-gray-400 leading-relaxed">
              <li>Conversation history (until you clear it)</li>
              <li>Your display name and tone preference</li>
              <li>Session tokens (to keep you signed in)</li>
            </ul>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              What lives on the server
            </div>
            <div className="space-y-3 text-[13px] text-gray-400 leading-relaxed">
              <p>
                Messages are stored in Supabase Postgres so you can sync across
                devices and resume conversations. We do not train AI models on
                your conversations.
              </p>
              <p>
                When you send a message, it is forwarded to our LLM provider
                (e.g., OpenAI) for processing. That provider sees the message
                content only for the purpose of generating a response. We do not
                share your identity or metadata with them beyond what is
                required for the API call.
              </p>
            </div>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Data we do not sell
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              We do not sell, rent, or trade your personal information. We do
              not use your conversations for advertising profiling. Period.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Retention
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              Server-side conversation data is retained for as long as your
              account exists. Anonymous sessions are retained until you reset
              your device data or they expire. You can delete your conversation
              history at any time from Settings.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Deletion
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              You can clear all history from the Settings modal. This removes
              server-side messages tied to your account. For a full account
              deletion request, email us at{" "}
              <span className="text-cyan-400">privacy@nura.example</span>.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Changes to this policy
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              If we make material changes, we will update this page and notify
              you in-app. Continued use after changes means you accept the
              revised policy.
            </p>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Contact
            </div>
            <p className="text-[13px] text-gray-400 leading-relaxed">
              Questions? Reach us at{" "}
              <span className="text-cyan-400">privacy@nura.example</span>.
            </p>
          </section>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
