import { Settings as SettingsIcon } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <SettingsIcon className="h-5 w-5 text-accent sm:h-6 sm:w-6" />
        <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary sm:text-2xl lg:text-3xl">
          Settings
        </h1>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Risk Profile */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6">
          <h2 className="mb-3 font-heading text-sm font-semibold text-text-primary sm:mb-4 sm:text-base lg:text-lg">
            Risk Profile
          </h2>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-text-secondary sm:text-xs">
                Default Risk %
              </label>
              <input
                type="number"
                defaultValue={0.5}
                step={0.25}
                className="h-8 w-full rounded-lg border border-border-default bg-bg-base px-3 text-xs text-text-primary outline-none focus:border-accent sm:h-9 sm:text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-text-secondary sm:text-xs">
                Risk Profile
              </label>
              <div className="flex gap-2 sm:gap-3">
                {['Conservative (0.25%)', 'Normal (0.5%)', 'Aggressive (1%)'].map((profile) => (
                  <button
                    key={profile}
                    className="cursor-pointer rounded-lg border border-border-default bg-bg-elevated px-2 py-1.5 text-[10px] text-text-secondary transition-colors hover:border-accent hover:text-accent sm:px-3 sm:py-2 sm:text-xs"
                  >
                    {profile}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chatbot Integration */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6">
          <h2 className="mb-3 font-heading text-sm font-semibold text-text-primary sm:mb-4 sm:text-base lg:text-lg">
            Alert Delivery
          </h2>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border-muted bg-bg-elevated p-3 sm:p-4">
              <div>
                <div className="text-xs font-medium text-text-primary sm:text-sm">WhatsApp</div>
                <div className="text-[10px] text-text-muted sm:text-xs">Not connected</div>
              </div>
              <button className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-accent-hover sm:text-xs">
                Connect
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border-muted bg-bg-elevated p-3 sm:p-4">
              <div>
                <div className="text-xs font-medium text-text-primary sm:text-sm">Telegram</div>
                <div className="text-[10px] text-text-muted sm:text-xs">Not connected</div>
              </div>
              <button className="cursor-pointer rounded-lg bg-accent px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-accent-hover sm:text-xs">
                Connect
              </button>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="rounded-xl border border-border-default bg-bg-surface p-4 sm:p-6 lg:col-span-2">
          <h2 className="mb-3 font-heading text-sm font-semibold text-text-primary sm:mb-4 sm:text-base lg:text-lg">
            Account
          </h2>
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border-muted sm:h-24">
            <span className="text-xs text-text-muted sm:text-sm">Account settings will render here</span>
          </div>
        </div>
      </div>
    </div>
  )
}
