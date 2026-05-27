import { Sidebar } from "../../../components/sidebar";
import { FacebookSdkProvider } from "../../../components/facebook-sdk-provider";
import { MetaConnectPanel } from "../../../components/meta-connect-panel";

export default function MetaSettingsPage() {
  return (
    <FacebookSdkProvider>
      <main className="dashboard-layout">
        <Sidebar />
        <section className="content">
          <h2>Integração Meta</h2>
          <p>
            Conecte o app <strong>Phoenix Marketing Automat</strong> usando o SDK do Facebook para JavaScript.
            O token é enviado ao backend em <code>{process.env.NEXT_PUBLIC_API_URL}/api/meta/oauth/sdk-token</code>.
          </p>
          <MetaConnectPanel />
        </section>
      </main>
    </FacebookSdkProvider>
  );
}
